"""
把手繪/描邊的賽道線稿 PNG 轉成適合 THREE.CatmullRomCurve3 的控制點陣列
=====================================================================
基於圖形拓撲導航 (Graph Pathfinding) + RDP 曲線簡化演算法
解決髮夾彎 (Hairpins) 跨彎跳躍、點位極致滑順

功能特點：
  1. 二值化 + 骨架化 (skeletonize) —— 擷取 1px 中心線
  2. 圖形拓撲構建 (8-Neighbor Grid Graph) —— 將骨架像素建構為圖網格
  3. Dijkstra 最短路徑搜尋 / 自動起終點偵測 —— 100% 避免跨彎跳躍
  4. Douglas-Peucker (RDP) 簡化 —— 將像素鏈壓縮成最精確的極值轉折控制點
  5. 座標轉換 + 高程 —— 像素座標 → 世界座標（置中、縮放、下坡坡度）
  6. 路線視覺化比對 (Overlay Visualization) —— 自動繪製平滑曲線與原圖對比疊加圖
  7. 相符度偏差統計 —— 自動計算平均誤差、最大誤差與比對相符度百分比
"""
import argparse
import numpy as np
from PIL import Image, ImageDraw
from skimage.morphology import skeletonize
from scipy.spatial import cKDTree
from scipy.interpolate import CubicSpline
import networkx as nx


def load_skeleton_points(png_path, threshold=128):
    img = Image.open(png_path).convert('L')
    arr = np.array(img)
    binary = arr < threshold
    skel = skeletonize(binary)
    ys, xs = np.where(skel)
    return np.stack([xs, ys], axis=1).astype(float)


def trace_graph_path(pts, start_xy=None, end_xy=None):
    """將骨架建立為 8 鄰域無向圖，修剪跨彎捷徑 (Cycle Chords)，並透過 Dijkstra 最短路徑走完所有髮夾彎"""
    pt_to_idx = {tuple(p): i for i, p in enumerate(pts)}
    G = nx.Graph()

    for i, (x, y) in enumerate(pts):
        G.add_node(i)
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                if dx == 0 and dy == 0:
                    continue
                neighbor = (x + dx, y + dy)
                if neighbor in pt_to_idx:
                    j = pt_to_idx[neighbor]
                    dist = np.sqrt(dx * dx + dy * dy)
                    G.add_edge(i, j, weight=dist)

    # 關鍵修復：自動解開並修剪平行彎道/髮夾彎之間誤觸形成的捷徑邊 (Shortcut Chords)
    # 防止 Dijkstra 演算法走捷徑跳過完整彎道
    max_prune_iters = 100
    for _ in range(max_prune_iters):
        cycles = nx.cycle_basis(G)
        if not cycles:
            break
        removed = False
        for c in cycles:
            junc_nodes = [n for n in c if G.degree(n) >= 3]
            if len(junc_nodes) >= 2:
                for u in junc_nodes:
                    for v in junc_nodes:
                        if u != v and G.has_edge(u, v):
                            G.remove_edge(u, v)
                            removed = True
                            break
                    if removed:
                        break
            elif len(c) >= 3:
                G.remove_edge(c[0], c[1])
                removed = True
            if removed:
                break
        if not removed:
            break

    tree = cKDTree(pts)

    if start_xy is None or end_xy is None:
        deg1 = [node for node, deg in G.degree() if deg == 1]
        max_len = 0
        best_path = []
        for i in range(len(deg1)):
            for j in range(i + 1, len(deg1)):
                n1, n2 = deg1[i], deg1[j]
                if nx.has_path(G, n1, n2):
                    plen = nx.shortest_path_length(G, n1, n2, weight='weight')
                    if plen > max_len:
                        max_len = plen
                        best_path = nx.shortest_path(G, n1, n2, weight='weight')
        return pts[best_path]

    _, start_idx = tree.query(np.array(start_xy))
    _, end_idx = tree.query(np.array(end_xy))

    path_indices = nx.shortest_path(G, source=start_idx, target=end_idx, weight='weight')
    return pts[path_indices]


def rdp(points, epsilon):
    """Ramer-Douglas-Peucker 演算法：保留關鍵轉折點"""
    if len(points) < 3:
        return points
    start, end = points[0], points[-1]
    line_vec = end - start
    line_len = np.linalg.norm(line_vec)
    if line_len == 0:
        d = np.linalg.norm(points[1:-1] - start, axis=1)
    else:
        unit = line_vec / line_len
        vecs = points[1:-1] - start
        proj = np.outer(vecs @ unit, unit)
        d = np.linalg.norm(vecs - proj, axis=1)
    if len(d) == 0:
        return np.array([start, end])
    idx = np.argmax(d)
    if d[idx] > epsilon:
        left = rdp(points[:idx + 2], epsilon)
        right = rdp(points[idx + 1:], epsilon)
        return np.vstack([left[:-1], right])
    return np.array([start, end])


def evaluate_accuracy(raw_path, simplified):
    """評估 Catmull-Rom / Spline 插值曲線與原手繪/描邊骨架的貼合度誤差"""
    t = np.linspace(0, 1, len(simplified))
    t_smooth = np.linspace(0, 1, 2000)
    cs_x = CubicSpline(t, simplified[:, 0])
    cs_y = CubicSpline(t, simplified[:, 1])
    smooth_pts = np.stack([cs_x(t_smooth), cs_y(t_smooth)], axis=1)

    tree = cKDTree(raw_path)
    dists, _ = tree.query(smooth_pts)

    mean_err = float(np.mean(dists))
    max_err = float(np.max(dists))
    img_diagonal = float(np.hypot(raw_path[:, 0].max() - raw_path[:, 0].min(), raw_path[:, 1].max() - raw_path[:, 1].min()))
    accuracy = max(0.0, 100.0 - (mean_err / (img_diagonal or 1.0) * 100.0))

    return smooth_pts, mean_err, max_err, accuracy


def save_verification_overlay(bg_path, raw_path, simplified, smooth_pts, mean_err, max_err, accuracy, out_overlay_path):
    """繪製原圖 overlay 疊加比對圖"""
    try:
        bg = Image.open(bg_path).convert('RGB')
    except Exception:
        w = int(raw_path[:, 0].max() + 50)
        h = int(raw_path[:, 1].max() + 50)
        bg = Image.new('RGB', (w, h), (15, 15, 20))

    draw = ImageDraw.Draw(bg)

    # 1. 畫原始中心骨架線 (青色 Thin Line)
    for i in range(len(raw_path) - 1):
        p1 = tuple(raw_path[i])
        p2 = tuple(raw_path[i + 1])
        draw.line([p1, p2], fill=(0, 220, 255), width=2)

    # 2. 畫 Three.js 樣條曲線 (粉紅亮色 Smooth Spline)
    for i in range(len(smooth_pts) - 1):
        p1 = tuple(smooth_pts[i])
        p2 = tuple(smooth_pts[i + 1])
        draw.line([p1, p2], fill=(255, 0, 128), width=3)

    # 3. 標記 RDP 控制點 (黃色控制點)
    for p in simplified:
        draw.ellipse([p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3], fill=(255, 255, 0), outline=(0, 0, 0))

    # 4. 起終點標記 (綠色起點、紅色終點)
    sp = tuple(raw_path[0])
    ep = tuple(raw_path[-1])
    draw.ellipse([sp[0] - 7, sp[1] - 7, sp[0] + 7, sp[1] + 7], fill=(0, 255, 0), outline=(255, 255, 255))
    draw.ellipse([ep[0] - 7, ep[1] - 7, ep[0] + 7, ep[1] + 7], fill=(255, 0, 0), outline=(255, 255, 255))

    bg.save(out_overlay_path)
    print(f"[Overlay] 成功導出疊加比對驗證圖: {out_overlay_path}")


def to_world_coords(simplified_px, target_length_m, downhill_height=140.0):
    """置中並縮放至世界單位，同時計算下坡 Y 軸高程"""
    raw_len = np.linalg.norm(np.diff(simplified_px, axis=0), axis=1).sum()
    scale = target_length_m / raw_len if target_length_m else 1.0
    cx = (simplified_px[:, 0].min() + simplified_px[:, 0].max()) / 2
    cy = (simplified_px[:, 1].min() + simplified_px[:, 1].max()) / 2

    world_xz = (simplified_px - [cx, cy]) * scale

    segment_lens = np.linalg.norm(np.diff(world_xz, axis=0), axis=1)
    cum_lens = np.concatenate([[0], np.cumsum(segment_lens)])
    total_world_len = cum_lens[-1]

    world_pts = []
    for i in range(len(world_xz)):
        x = world_xz[i, 0]
        z = world_xz[i, 1]
        progress = cum_lens[i] / total_world_len if total_world_len > 0 else 0
        y = downhill_height * (1.0 - progress)
        world_pts.append((x, y, z))

    return world_pts


import json
import os

def to_json_dict(world_pts, track_id, name, name_en, track_type, target_length_m, name_ja="", difficulty=3, track_width=18):
    """將 3D 控制點轉換為 CyberRace 新版動態 JSON 物件格式"""
    pts_list = [[round(x, 1), round(y, 1), round(z, 1)] for x, y, z in world_pts]
    ys = [p[1] for p in world_pts]
    elev_val = round(max(ys) - min(ys)) if ys else 200
    return {
        "id": track_id,
        "name": name,
        "nameEn": name_en,
        "nameJa": name_ja or name,
        "type": track_type,
        "length": f"{int(target_length_m)}m",
        "difficulty": difficulty,
        "elev": f"{elev_val}m",
        "trackWidth": track_width,
        "points": pts_list
    }

def update_tracks_index(track_meta, index_json_path):
    """自動新增/更新 data/tracks/tracks_index.json 中的賽道元資料索引"""
    if not os.path.exists(index_json_path):
        return
    try:
        with open(index_json_path, 'r', encoding='utf-8') as f:
            index_data = json.load(f)

        found = False
        for entry in index_data:
            if entry.get('id') == track_meta['id']:
                entry['name'] = track_meta['name']
                entry['nameEn'] = track_meta['nameEn']
                entry['nameJa'] = track_meta.get('nameJa', entry.get('nameJa', track_meta['name']))
                entry['type'] = track_meta['type']
                entry['len'] = track_meta.get('length', entry.get('len'))
                entry['difficulty'] = track_meta.get('difficulty', entry.get('difficulty', 3))
                entry['elev'] = track_meta.get('elev', entry.get('elev', '200m'))
                if 'stars' in entry: del entry['stars']
                if 'corners' in entry: del entry['corners']
                found = True
                break
        if not found:
            index_data.append({
                "id": track_meta['id'],
                "name": track_meta['name'],
                "nameEn": track_meta['nameEn'],
                "nameJa": track_meta.get('nameJa', track_meta['name']),
                "type": track_meta['type'],
                "difficulty": track_meta.get('difficulty', 3),
                "region": "日本",
                "len": track_meta.get('length', '5,000m'),
                "elev": track_meta.get('elev', '200m')
            })

        with open(index_json_path, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, ensure_ascii=False, indent=2)
        print(f"[Index] 成功更新 {index_json_path} 中的賽道索引 '{track_meta['id']}'")
    except Exception as e:
        print(f"[Index] 更新 index.json 警告: {e}")


def to_js(world_pts):
    lines = []
    for i, (x, y, z) in enumerate(world_pts):
        tag = "  // 起點 (山頂 赤城)" if i == 0 else ("  // 終點 (山腳 出口)" if i == len(world_pts) - 1 else "")
        lines.append(f"                    new THREE.Vector3({x:.1f}, {y:.1f}, {z:.1f}),{tag}")
    return "\n".join(lines)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('image', help='賽道線稿 PNG 圖片 (例如 Akagi_clean.png)')
    ap.add_argument('--bg', help='原圖背景 PNG 圖片 (例如 Akagi.png)，用於疊加顯示比對')
    ap.add_argument('--length', type=float, default=5804, help='目標賽道長度（世界單位，預設 5804m）')
    ap.add_argument('--epsilon', type=float, default=1.5, help='RDP 簡化強度 (預設 1.5)')
    ap.add_argument('--downhill', type=float, default=140.0, help='山道下坡總高度差 (Y 軸，預設 140m)')
    ap.add_argument('--start_x', type=float, default=None, help='起點像素 X (不指定則自動尋找端點)')
    ap.add_argument('--start_y', type=float, default=None, help='起點像素 Y (不指定則自動尋找端點)')
    ap.add_argument('--end_x', type=float, default=None, help='終點像素 X (不指定則自動尋找端點)')
    ap.add_argument('--end_y', type=float, default=None, help='終點像素 Y (不指定則自動尋找端點)')
    ap.add_argument('--track_id', default=None, help='賽道 ID (例如 akagi，未指定則自動根據圖片檔名生成)')
    ap.add_argument('--track_name', default=None, help='賽道中文名稱 (例如 赤城)')
    ap.add_argument('--track_name_en', default=None, help='賽道英文名稱 (例如 Akagi)')
    ap.add_argument('--type', choices=['linear', 'circuit'], default='linear', help='賽道類型: linear (直線山道) 或 circuit (封閉環狀)')
    ap.add_argument('--stars', type=int, default=3, help='難度星級 (1-5，預設 3)')
    ap.add_argument('--track_width', type=float, default=18.0, help='賽道寬度 (預設 18m)')
    ap.add_argument('--json', default=None, help='輸出 CyberRace 新版 .json 賽道檔案路徑 (例如 data/tracks/akagi.json)')
    ap.add_argument('--out', default=None, help='輸出舊版 Three.js Vector3 代碼檔案 (.txt)')
    ap.add_argument('--overlay', default='Akagi_overlay.png', help='輸出路線疊加驗證圖檔案')
    args = ap.parse_args()

    pts = load_skeleton_points(args.image)
    start_pt = [args.start_x, args.start_y] if (args.start_x is not None and args.start_y is not None) else None
    end_pt = [args.end_x, args.end_y] if (args.end_x is not None and args.end_y is not None) else None

    print(f"解析圖形拓撲導航路徑追蹤...")
    raw_path = trace_graph_path(pts, start_pt, end_pt)
    print(f"找到 {len(raw_path)} 個連續骨架像素點，起點: {raw_path[0]}, 終點: {raw_path[-1]}")

    simplified = rdp(raw_path, args.epsilon)
    print(f"RDP 簡化 (epsilon={args.epsilon}) 後共 {len(simplified)} 個控制點")

    # 評估與原圖吻合度
    smooth_pts, mean_err, max_err, accuracy = evaluate_accuracy(raw_path, simplified)
    print("==========================================")
    print(f"[Match] 賽道路線與原圖相符度 (Accuracy Match): {accuracy:.2f}%")
    print(f"[Match] 平均曲線偏差 (Mean Error): {mean_err:.2f} pixels")
    print(f"[Match] 最大曲線偏差 (Max Error): {max_err:.2f} pixels")
    print("==========================================")

    # 輸出疊加比對驗證圖
    bg_img = args.bg if args.bg else args.image
    save_verification_overlay(bg_img, raw_path, simplified, smooth_pts, mean_err, max_err, accuracy, args.overlay)

    world = to_world_coords(simplified, args.length, args.downhill)

    # 自動推算賽道 ID 與名稱
    base_name = os.path.splitext(os.path.basename(args.image))[0].lower().replace('_clean', '')
    track_id = args.track_id or base_name
    track_name = args.track_name or track_id.capitalize()
    track_name_en = args.track_name_en or track_id.capitalize()

    # 導出新版 CyberRace 相容的 JSON 格式
    json_data = to_json_dict(world, track_id, track_name, track_name_en, args.type, args.length, args.stars, args.track_width)
    
    json_path = args.json or f"{track_id}.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)
    print(f"🎉 成功導出新版 CyberRace 賽道 JSON 檔案: {json_path} (共 {len(world)} 個控制點)")

    # 若輸出至 data/tracks/ 目錄，自動同步更新 index.json
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_tracks_dir = os.path.join(script_dir, "data", "tracks")
    if os.path.exists(data_tracks_dir):
        index_json = os.path.join(data_tracks_dir, "index.json")
        update_tracks_index(json_data, index_json)

    # 舊版相容輸出 (如指定 --out)
    if args.out:
        js = to_js(world)
        with open(args.out, 'w', encoding='utf-8') as f:
            f.write(js)
        print(f"成功導出舊版 Vector3 文字檔: {args.out}")

