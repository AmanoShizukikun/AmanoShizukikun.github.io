"""
🎮 賽道地圖路線 GUI 手動編輯與極致微調工具 (Cyber Race Track GUI Editor with Zoom & Pan)
=================================================================================
功能說明：
  1. 自由縮放與平移 (Zoom & Pan)：
     - 滾輪 (Mouse Wheel)：以游標為中心即時放大/縮小 (0.2x ~ 10.0x)，超清晰微調極致髮夾彎
     - 中鍵拖曳 / Shift+左鍵拖曳：平移移動畫布
     - 工具欄設有 [＋ 放大] [－ 縮小] [100% 原始大小] [適合視窗] 快捷按鈕
  2. 載入底圖：開啟任意賽道 PNG 圖片 (例如 Irohazaka.png, Akagi.png)
  3. 滑鼠點位編輯：
     - 左鍵點擊 + 拖曳：選取並移動控制點
     - 左鍵點擊空白處：新增控制點 (自動插入近鄰線段中)
     - 右鍵點擊控制點：刪除該控制點
  4. 即時平滑 Spline 預覽：即時繪製 Catmull-Rom 三次樣條曲線
  5. 一鍵寫入 cyberrace.html：手動微調滿意後一鍵直接更新至遊戲中！
"""

import os
import sys
import argparse
import threading
import numpy as np
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from PIL import Image, ImageTk
from scipy.interpolate import CubicSpline
from scipy.spatial import cKDTree
from skimage.morphology import skeletonize
import networkx as nx


def sanitize_for_json(obj):
    """將 numpy 數值型態 (int64, float64, ndarray 等) 遞迴轉為 Python 原生型態，防止 json.dump 序列化失敗"""
    if isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(item) for item in obj]
    elif isinstance(obj, (tuple, set)):
        return [sanitize_for_json(item) for item in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return sanitize_for_json(obj.tolist())
    return obj


def parse_float_val(val, default=0.0):
    """安全解析數值 (支援 int, float, 包含 'm' 的字串與空字串)"""
    if val is None:
        return float(default)
    if isinstance(val, (int, float, np.number)):
        return float(val)
    s = str(val).replace('m', '').replace('M', '').strip()
    try:
        return float(s)
    except ValueError:
        return float(default)


class TrackGuiEditor:
    def __init__(self, root, img_path=None, points_file=None):
        self.root = root
        self.root.title("CyberRace 賽道地圖手動編輯器 (Track GUI Editor - Fast & Accurate)")
        self.root.geometry("1280x850")

        # 狀態變數 (預設不打開任何底圖或點位檔)
        self.img_path = img_path
        self.points_file = points_file
        self.bg_image_pil = None

        # 點位資料 (圖像原始像素座標 px, py)
        self.px_points = []                  # 主賽道控制點
        # 捷徑列表 (支援多條捷徑)：每項為 {'start': int|None, 'end': int|None, 'mids': [[x,y], ...]}
        self.shortcuts = [
            {'start': None, 'end': None, 'mids': []}
        ]
        self.active_shortcut_idx = 0          # 當前正在編輯的捷徑 index
        self.edit_mode = 'main'               # 'main' | 'shortcut'
        self.selected_point_idx = None
        self.hovered_point_idx = None

        # 視角縮放與平移狀態
        self.zoom_scale = 1.0
        self.pan_offset_x = 0.0
        self.pan_offset_y = 0.0
        self.is_panning = False
        self.pan_start_x = 0
        self.pan_start_y = 0

        # UI / 賽道設定 (預設皆為空，由編輯者自行設定)
        self.target_length_m = tk.StringVar(value="")
        self.downhill_height_m = tk.StringVar(value="")
        self.difficulty_var = tk.StringVar(value="")
        self.selected_track_key = tk.StringVar(value="")
        self.track_type = tk.StringVar(value="linear")  # 'linear' | 'circuit'
        self.track_name_zh = tk.StringVar(value="")
        self.track_name_en = tk.StringVar(value="")
        self.track_name_ja = tk.StringVar(value="")

        # 特殊點位設定 (起點、終點、檢查點)
        self.start_index = 0
        self.finish_index = None
        self.checkpoints = []

        # 底圖獨立微調 (平移/縮放，但不影響控制點)
        self.img_offset_x = 0.0
        self.img_offset_y = 0.0
        self.img_scale = 1.0
        self.img_offset_x_var = tk.StringVar(value="0.0")
        self.img_offset_y_var = tk.StringVar(value="0.0")
        self.img_scale_var = tk.StringVar(value="100")
        self.is_dragging_img = False
        self.img_drag_start_x = 0
        self.img_drag_start_y = 0

        # 快取與繪圖優化
        self.cached_resized_photo = None
        self.cached_crop_key = None

        self.setup_ui()
        self.bind_keyboard_shortcuts()

        if self.img_path and os.path.exists(self.img_path):
            self.load_image(self.img_path, auto_fit=True)

        if self.points_file and os.path.exists(self.points_file):
            self.load_points_file(self.points_file)

    def setup_ui(self):
        # 1. 頂部主工具列
        toolbar = ttk.Frame(self.root, padding=6)
        toolbar.pack(side=tk.TOP, fill=tk.X)

        ttk.Button(toolbar, text="📂 開啟底圖", command=self.on_btn_load_image).pack(side=tk.LEFT, padx=3)
        ttk.Button(toolbar, text="📥 載入點位檔", command=self.on_btn_load_points).pack(side=tk.LEFT, padx=3)
        ttk.Button(toolbar, text="🎯 對齊底圖", command=self.align_points_to_image).pack(side=tk.LEFT, padx=3)
        ttk.Button(toolbar, text="⚡ 自動追蹤骨架", command=self.auto_trace_async).pack(side=tk.LEFT, padx=3)
        ttk.Button(toolbar, text="🔄 反轉起終點", command=self.reverse_track_direction).pack(side=tk.LEFT, padx=3)
        ttk.Button(toolbar, text="🗑️ 清空點位", command=self.clear_all_points).pack(side=tk.LEFT, padx=3)

        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=6)

        # 編輯模式切換 (主賽道 / 捷徑)
        self.btn_mode = ttk.Button(toolbar, text="✏️ 編輯: 主線", command=self.toggle_edit_mode, width=14)
        self.btn_mode.pack(side=tk.LEFT, padx=3)

        # 捷徑選擇與管理小組件
        self.frame_sc_ctrl = ttk.Frame(toolbar)
        self.cb_sc_select = ttk.Combobox(self.frame_sc_ctrl, values=["捷徑 #1"], width=10, state="readonly")
        self.cb_sc_select.current(0)
        self.cb_sc_select.pack(side=tk.LEFT, padx=2)
        self.cb_sc_select.bind("<<ComboboxSelected>>", self.on_shortcut_selected)

        ttk.Button(self.frame_sc_ctrl, text="➕ 新增捷徑", command=self.add_new_shortcut).pack(side=tk.LEFT, padx=2)
        ttk.Button(self.frame_sc_ctrl, text="🗑️ 刪除此捷徑", command=self.delete_current_shortcut).pack(side=tk.LEFT, padx=2)

        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=6)

        # 賽道類型
        ttk.Label(toolbar, text="類型:").pack(side=tk.LEFT, padx=2)
        cb_type = ttk.Combobox(toolbar, textvariable=self.track_type,
                               values=["linear", "circuit"], width=7, state="readonly")
        cb_type.pack(side=tk.LEFT, padx=2)
        cb_type.bind("<<ComboboxSelected>>", self.on_track_type_changed)

        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=6)

        # 縮放控制群組
        ttk.Label(toolbar, text="縮放:").pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="🔍＋", width=4, command=self.zoom_in).pack(side=tk.LEFT, padx=1)
        ttk.Button(toolbar, text="🔍－", width=4, command=self.zoom_out).pack(side=tk.LEFT, padx=1)
        ttk.Button(toolbar, text="100%", width=5, command=self.zoom_reset).pack(side=tk.LEFT, padx=1)
        ttk.Button(toolbar, text="適合視窗", command=self.zoom_fit).pack(side=tk.LEFT, padx=1)
        self.lbl_zoom = ttk.Label(toolbar, text="100%", width=6, foreground="#0077cc", font=("Arial", 9, "bold"))
        self.lbl_zoom.pack(side=tk.LEFT, padx=2)

        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=6)

        ttk.Label(toolbar, text="賽道 ID:").pack(side=tk.LEFT, padx=2)
        ttk.Entry(toolbar, textvariable=self.selected_track_key, width=10).pack(side=tk.LEFT, padx=2)

        ttk.Label(toolbar, text="難度(1-5):").pack(side=tk.LEFT, padx=2)
        ttk.Entry(toolbar, textvariable=self.difficulty_var, width=4).pack(side=tk.LEFT, padx=2)

        ttk.Label(toolbar, text="總長(m):").pack(side=tk.LEFT, padx=2)
        ttk.Entry(toolbar, textvariable=self.target_length_m, width=6).pack(side=tk.LEFT, padx=2)

        ttk.Label(toolbar, text="高差(m):").pack(side=tk.LEFT, padx=2)
        ttk.Entry(toolbar, textvariable=self.downhill_height_m, width=5).pack(side=tk.LEFT, padx=2)

        ttk.Button(toolbar, text="💾 匯出 .json", command=self.save_track_json_file).pack(side=tk.LEFT, padx=3)
        ttk.Button(toolbar, text="📄 匯出 Vector3", command=self.save_points_file).pack(side=tk.LEFT, padx=3)

        # 1b. 特殊點位工具列 (起點 / 終點 / 檢查點)
        special_bar = ttk.Frame(self.root, padding=4)
        special_bar.pack(side=tk.TOP, fill=tk.X)

        ttk.Label(special_bar, text="🚩 特殊點位:").pack(side=tk.LEFT, padx=3)

        self.btn_set_start = ttk.Button(special_bar, text="🚀 設為起點", command=self.set_selected_as_start)
        self.btn_set_start.pack(side=tk.LEFT, padx=2)

        self.btn_set_finish = ttk.Button(special_bar, text="🏁 設為終點", command=self.set_selected_as_finish)
        self.btn_set_finish.pack(side=tk.LEFT, padx=2)

        self.btn_toggle_cp = ttk.Button(special_bar, text="🚩 切換檢查點", command=self.toggle_selected_as_checkpoint)
        self.btn_toggle_cp.pack(side=tk.LEFT, padx=2)

        self.btn_clear_cp = ttk.Button(special_bar, text="🗑️ 清空檢查點", command=self.clear_checkpoints)
        self.btn_clear_cp.pack(side=tk.LEFT, padx=2)

        ttk.Separator(special_bar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=6)

        self.lbl_special_status = ttk.Label(special_bar, text="起點: #1 | 終點: 未指定 | 檢查點: 無", foreground="#007744", font=("Arial", 9, "bold"))
        self.lbl_special_status.pack(side=tk.LEFT, padx=6)

        # 1c. 底圖微調工具列 (調整底圖位置/縮放但不影響點位)
        img_bar = ttk.Frame(self.root, padding=4)
        img_bar.pack(side=tk.TOP, fill=tk.X)

        ttk.Label(img_bar, text="🖼️ 微調底圖 (按住 Alt+拖曳 可移動底圖):", font=("Arial", 9, "bold")).pack(side=tk.LEFT, padx=3)

        ttk.Label(img_bar, text="X(px):").pack(side=tk.LEFT, padx=2)
        entry_img_x = ttk.Entry(img_bar, textvariable=self.img_offset_x_var, width=6)
        entry_img_x.pack(side=tk.LEFT, padx=1)
        entry_img_x.bind("<Return>", self.on_img_transform_changed)

        ttk.Label(img_bar, text="Y(px):").pack(side=tk.LEFT, padx=2)
        entry_img_y = ttk.Entry(img_bar, textvariable=self.img_offset_y_var, width=6)
        entry_img_y.pack(side=tk.LEFT, padx=1)
        entry_img_y.bind("<Return>", self.on_img_transform_changed)

        ttk.Label(img_bar, text="縮放(%):").pack(side=tk.LEFT, padx=2)
        entry_img_scale = ttk.Entry(img_bar, textvariable=self.img_scale_var, width=5)
        entry_img_scale.pack(side=tk.LEFT, padx=1)
        entry_img_scale.bind("<Return>", self.on_img_transform_changed)

        ttk.Button(img_bar, text="⬅️", width=3, command=lambda: self.nudge_img(-5, 0)).pack(side=tk.LEFT, padx=1)
        ttk.Button(img_bar, text="➡️", width=3, command=lambda: self.nudge_img(5, 0)).pack(side=tk.LEFT, padx=1)
        ttk.Button(img_bar, text="⬆️", width=3, command=lambda: self.nudge_img(0, -5)).pack(side=tk.LEFT, padx=1)
        ttk.Button(img_bar, text="⬇️", width=3, command=lambda: self.nudge_img(0, 5)).pack(side=tk.LEFT, padx=1)
        ttk.Button(img_bar, text="🔍＋", width=3, command=lambda: self.nudge_img_scale(0.02)).pack(side=tk.LEFT, padx=1)
        ttk.Button(img_bar, text="🔍－", width=3, command=lambda: self.nudge_img_scale(-0.02)).pack(side=tk.LEFT, padx=1)

        ttk.Button(img_bar, text="🔄 重置底圖位置", command=self.reset_img_transform).pack(side=tk.LEFT, padx=4)
        ttk.Button(img_bar, text="📌 將底圖偏移套用至點位", command=self.apply_img_transform_to_points).pack(side=tk.LEFT, padx=4)

        # 2. 說明提示列
        info_bar = ttk.Frame(self.root, padding=4)
        info_bar.pack(side=tk.TOP, fill=tk.X)
        self.lbl_info = ttk.Label(info_bar, text="💡 提示：選取點位後點擊 [🚀設為起點]/[🏁設為終點]/[🚩切換檢查點] 自訂賽道起終點與檢查點（環道無檢查點）", foreground="#224488")
        self.lbl_info.pack(side=tk.LEFT, padx=8)

        # 3. 主畫布
        canvas_frame = ttk.Frame(self.root)
        canvas_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

        self.canvas = tk.Canvas(canvas_frame, bg="#121218", highlightthickness=0)
        self.canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # 4. 綁定滑鼠與視窗事件
        self.canvas.bind("<Configure>", lambda e: self.redraw())
        self.canvas.bind("<ButtonPress-1>", self.on_canvas_left_click)
        self.canvas.bind("<B1-Motion>", self.on_canvas_left_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_canvas_left_release)
        self.canvas.bind("<ButtonPress-3>", self.on_canvas_right_click)
        self.canvas.bind("<Motion>", self.on_canvas_mouse_move)

        # Alt + 左鍵拖曳微調底圖
        self.canvas.bind("<Alt-ButtonPress-1>", self.on_pan_start)
        self.canvas.bind("<Alt-B1-Motion>", self.on_pan_move)
        self.canvas.bind("<Alt-ButtonRelease-1>", self.on_pan_end)

        # 中鍵拖曳平移 (Pan)
        self.canvas.bind("<ButtonPress-2>", self.on_pan_start)
        self.canvas.bind("<B2-Motion>", self.on_pan_move)
        self.canvas.bind("<ButtonRelease-2>", self.on_pan_end)

        # 滾輪縮放 (Zoom)
        self.canvas.bind("<MouseWheel>", self.on_mouse_wheel)
        self.canvas.bind("<Button-4>", self.on_mouse_wheel)
        self.canvas.bind("<Button-5>", self.on_mouse_wheel)
        self.canvas.bind("<Alt-MouseWheel>", self.on_alt_mouse_wheel)
        self.canvas.bind("<Alt-Button-4>", self.on_alt_mouse_wheel)
        self.canvas.bind("<Alt-Button-5>", self.on_alt_mouse_wheel)

    def bind_keyboard_shortcuts(self):
        self.root.bind("<Delete>", lambda e: self.delete_selected_point())
        self.root.bind("<BackSpace>", lambda e: self.delete_selected_point())
        self.root.bind("<Up>", lambda e: self.nudge_selected_point(0, -1))
        self.root.bind("<Down>", lambda e: self.nudge_selected_point(0, 1))
        self.root.bind("<Left>", lambda e: self.nudge_selected_point(-1, 0))
        self.root.bind("<Right>", lambda e: self.nudge_selected_point(1, 0))
        self.root.bind("<Alt-Up>", lambda e: self.nudge_img(0, -1))
        self.root.bind("<Alt-Down>", lambda e: self.nudge_img(0, 1))
        self.root.bind("<Alt-Left>", lambda e: self.nudge_img(-1, 0))
        self.root.bind("<Alt-Right>", lambda e: self.nudge_img(1, 0))

    def on_track_type_changed(self, event=None):
        if self.track_type.get() == "circuit":
            self.checkpoints = []
        self.update_special_status_label()
        self.redraw()

    def update_special_status_label(self):
        is_circuit = (self.track_type.get() == "circuit")
        n_pts = len(self.px_points)

        st_str = f"#{self.start_index + 1}" if (self.start_index is not None and 0 <= self.start_index < n_pts) else "#1 (預設)"
        
        if is_circuit:
            fn_str = "環道起終點相同"
            cp_str = "(環道無檢查點)"
            if hasattr(self, 'btn_toggle_cp'): self.btn_toggle_cp.config(state="disabled")
            if hasattr(self, 'btn_clear_cp'): self.btn_clear_cp.config(state="disabled")
        else:
            fn_str = f"#{self.finish_index + 1}" if (self.finish_index is not None and 0 <= self.finish_index < n_pts) else f"#{n_pts} (預設)"
            valid_cps = sorted([cp for cp in self.checkpoints if 0 <= cp < n_pts])
            if valid_cps:
                cp_list_str = ", ".join([f"#{cp + 1}" for cp in valid_cps])
                cp_str = f"{cp_list_str} (共 {len(valid_cps)} 個)"
            else:
                cp_str = "無"
            if hasattr(self, 'btn_toggle_cp'): self.btn_toggle_cp.config(state="normal")
            if hasattr(self, 'btn_clear_cp'): self.btn_clear_cp.config(state="normal")

        if hasattr(self, 'lbl_special_status'):
            self.lbl_special_status.config(text=f"起點: {st_str} | 終點: {fn_str} | 檢查點: {cp_str}")

    def set_selected_as_start(self):
        if self.edit_mode != 'main' or self.selected_point_idx is None:
            messagebox.showinfo("提示", "請先選取主賽道上的控制點！")
            return
        self.start_index = self.selected_point_idx
        self.update_special_status_label()
        self.redraw()

    def set_selected_as_finish(self):
        if self.edit_mode != 'main' or self.selected_point_idx is None:
            messagebox.showinfo("提示", "請先選取主賽道上的控制點！")
            return
        if self.track_type.get() == 'circuit':
            messagebox.showinfo("提示", "環道型賽道起點與終點相同。")
            return
        self.finish_index = self.selected_point_idx
        self.update_special_status_label()
        self.redraw()

    def toggle_selected_as_checkpoint(self):
        if self.track_type.get() == 'circuit':
            messagebox.showinfo("提示", "環道型賽道不需設定檢查點。")
            return
        if self.edit_mode != 'main' or self.selected_point_idx is None:
            messagebox.showinfo("提示", "請先選取主賽道上的控制點！")
            return
        idx = self.selected_point_idx
        if idx in self.checkpoints:
            self.checkpoints.remove(idx)
        else:
            self.checkpoints.append(idx)
            self.checkpoints.sort()
        self.update_special_status_label()
        self.redraw()

    def clear_checkpoints(self):
        self.checkpoints = []
        self.update_special_status_label()
        self.redraw()

    def on_track_select(self, event=None):
        key = self.selected_track_key.get().strip()
        if not key:
            return

        base_dir = os.path.dirname(os.path.abspath(__file__))
        json_path = os.path.join(base_dir, "data", "tracks", f"{key}.json")
        if os.path.exists(json_path):
            import json
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                len_val = str(data.get("length", "")).replace("m", "").strip()
                elev_val = str(data.get("elev", "")).replace("m", "").strip()
                diff_val = str(data.get("difficulty", ""))

                self.target_length_m.set(len_val)
                self.downhill_height_m.set(elev_val)
                self.difficulty_var.set(diff_val)
                self.track_type.set(data.get("type", "linear"))
                self.track_name_zh.set(data.get("name", ""))
                self.track_name_en.set(data.get("nameEn", ""))
                self.track_name_ja.set(data.get("nameJa", ""))

                if "startIndex" in data:
                    self.start_index = data["startIndex"]
                if "finishIndex" in data:
                    self.finish_index = data["finishIndex"]
                if "checkpoints" in data:
                    self.checkpoints = data["checkpoints"]

                self.update_special_status_label()
                self.redraw()
            except Exception as e:
                print(f"讀取賽道 JSON 失敗 [{key}]: {e}")

    # 座標轉換：圖像像素座標 <-> 畫布螢幕座標
    def world_to_canvas(self, px, py):
        cx = (px * self.zoom_scale) + self.pan_offset_x
        cy = (py * self.zoom_scale) + self.pan_offset_y
        return cx, cy

    def canvas_to_world(self, cx, cy):
        px = (cx - self.pan_offset_x) / self.zoom_scale
        py = (cy - self.pan_offset_y) / self.zoom_scale
        return px, py

    # 縮放與平移邏輯
    def zoom_at(self, scale_factor, anchor_cx, anchor_cy):
        old_scale = self.zoom_scale
        new_scale = max(0.15, min(15.0, old_scale * scale_factor))
        if new_scale == old_scale:
            return

        anchor_px = (anchor_cx - self.pan_offset_x) / old_scale
        anchor_py = (anchor_cy - self.pan_offset_y) / old_scale

        self.zoom_scale = new_scale
        self.pan_offset_x = anchor_cx - (anchor_px * new_scale)
        self.pan_offset_y = anchor_cy - (anchor_py * new_scale)

        self.lbl_zoom.config(text=f"{int(self.zoom_scale * 100)}%")
        self.redraw()

    def on_mouse_wheel(self, event):
        is_alt_held = bool(event.state & 0x0020) or bool(event.state & 0x0080) or bool(event.state & 0x20000) or bool(event.state & 0x8) or (self.edit_mode == 'image')
        if is_alt_held:
            return self.on_alt_mouse_wheel(event)

        if event.num == 4 or event.delta > 0:
            factor = 1.15
        else:
            factor = 1.0 / 1.15
        self.zoom_at(factor, event.x, event.y)

    def on_alt_mouse_wheel(self, event):
        """Alt + 滾輪 或 底圖編輯模式下滾輪：縮放底圖 (不影響點位)"""
        if event.num == 4 or (hasattr(event, 'delta') and event.delta > 0):
            d_scale = 0.04
        else:
            d_scale = -0.04
        self.nudge_img_scale(d_scale)
        return "break"

    def zoom_in(self):
        cx = self.canvas.winfo_width() / 2
        cy = self.canvas.winfo_height() / 2
        self.zoom_at(1.25, cx, cy)

    def zoom_out(self):
        cx = self.canvas.winfo_width() / 2
        cy = self.canvas.winfo_height() / 2
        self.zoom_at(1.0 / 1.25, cx, cy)

    def zoom_reset(self):
        self.zoom_scale = 1.0
        self.pan_offset_x = 0.0
        self.pan_offset_y = 0.0
        self.lbl_zoom.config(text="100%")
        self.redraw()

    def zoom_fit(self):
        if not self.bg_image_pil:
            return
        cw = max(100, self.canvas.winfo_width())
        ch = max(100, self.canvas.winfo_height())
        iw, ih = self.bg_image_pil.width, self.bg_image_pil.height

        scale_w = (cw - 40) / iw
        scale_h = (ch - 40) / ih
        self.zoom_scale = min(scale_w, scale_h)

        self.pan_offset_x = (cw - iw * self.zoom_scale) / 2
        self.pan_offset_y = (ch - ih * self.zoom_scale) / 2

        self.lbl_zoom.config(text=f"{int(self.zoom_scale * 100)}%")
        self.redraw()

    def nudge_img(self, dx, dy):
        """平移底圖 (不影響控制點)"""
        self.img_offset_x += dx
        self.img_offset_y += dy
        self.img_offset_x_var.set(f"{self.img_offset_x:.1f}")
        self.img_offset_y_var.set(f"{self.img_offset_y:.1f}")
        self.cached_crop_key = None
        self.redraw()

    def nudge_img_scale(self, d_scale):
        """縮放底圖 (不影響控制點)"""
        self.img_scale = max(0.1, self.img_scale + d_scale)
        self.img_scale_var.set(f"{int(self.img_scale * 100)}")
        self.cached_crop_key = None
        self.redraw()

    def on_img_transform_changed(self, event=None):
        """當文字框輸入 X/Y 偏移或縮放變更時觸發"""
        try:
            self.img_offset_x = float(self.img_offset_x_var.get() or 0)
            self.img_offset_y = float(self.img_offset_y_var.get() or 0)
            scale_val = float(self.img_scale_var.get() or 100)
            self.img_scale = max(0.1, scale_val / 100.0)
            self.cached_crop_key = None
            self.redraw()
        except ValueError:
            pass

    def reset_img_transform(self):
        """重置底圖偏移與縮放 (0, 0, 100%)"""
        self.img_offset_x = 0.0
        self.img_offset_y = 0.0
        self.img_scale = 1.0
        self.img_offset_x_var.set("0.0")
        self.img_offset_y_var.set("0.0")
        self.img_scale_var.set("100")
        self.cached_crop_key = None
        self.redraw()

    def apply_img_transform_to_points(self):
        """將當前底圖相對偏移與縮放逆向套用至點位 (使點位與底圖對齊，並重置底圖偏移)"""
        if not self.px_points:
            messagebox.showwarning("提示", "目前沒有點位可套用！")
            return

        if self.img_offset_x == 0 and self.img_offset_y == 0 and self.img_scale == 1.0:
            messagebox.showinfo("提示", "目前底圖沒有任何偏移或縮放。")
            return

        ox, oy, s = self.img_offset_x, self.img_offset_y, self.img_scale
        aligned = []
        for px, py in self.px_points:
            nx = (px - ox) / s
            ny = (py - oy) / s
            aligned.append([nx, ny])

        for sc in self.shortcuts:
            if sc.get('mids'):
                sc['mids'] = [[(mx - ox) / s, (my - oy) / s] for mx, my in sc['mids']]

        self.px_points = aligned
        self.reset_img_transform()
        messagebox.showinfo("套用成功", "📌 已成功將底圖相對偏移套用至所有控制點！")

    def on_pan_start(self, event):
        is_alt_held = bool(event.state & 0x0020) or bool(event.state & 0x0080) or bool(event.state & 0x20000) or bool(event.state & 0x8) or (self.edit_mode == 'image')
        if is_alt_held:
            self.is_dragging_img = True
            self.img_drag_start_x = event.x
            self.img_drag_start_y = event.y
            self.img_offset_x_start = self.img_offset_x
            self.img_offset_y_start = self.img_offset_y
            self.img_initial_dst_x = getattr(self, 'last_img_dst_x', 0)
            self.img_initial_dst_y = getattr(self, 'last_img_dst_y', 0)
        else:
            self.is_panning = True
            self.pan_start_x = event.x
            self.pan_start_y = event.y
            self.pan_offset_x_start = self.pan_offset_x
            self.pan_offset_y_start = self.pan_offset_y

    def on_pan_move(self, event):
        if hasattr(self, 'is_dragging_img') and self.is_dragging_img:
            dx_canvas = event.x - self.img_drag_start_x
            dy_canvas = event.y - self.img_drag_start_y
            dx_world = dx_canvas / self.zoom_scale
            dy_world = dy_canvas / self.zoom_scale
            self.img_offset_x = self.img_offset_x_start + dx_world
            self.img_offset_y = self.img_offset_y_start + dy_world

            # 超極速平滑移動 Canvas 底圖 (無 CPU 重複裁切開銷，無 0 點漂移與抖動)
            if self.canvas.find_withtag("bg_image"):
                new_dst_x = self.img_initial_dst_x + dx_canvas
                new_dst_y = self.img_initial_dst_y + dy_canvas
                self.canvas.coords("bg_image", new_dst_x, new_dst_y)
            else:
                self.redraw()
        elif self.is_panning:
            dx = event.x - self.pan_start_x
            dy = event.y - self.pan_start_y
            self.pan_offset_x = self.pan_offset_x_start + dx
            self.pan_offset_y = self.pan_offset_y_start + dy
            self.redraw()

    def on_pan_end(self, event):
        if hasattr(self, 'is_dragging_img') and self.is_dragging_img:
            self.is_dragging_img = False
            self.img_offset_x_var.set(f"{self.img_offset_x:.1f}")
            self.img_offset_y_var.set(f"{self.img_offset_y:.1f}")
            self.cached_crop_key = None
            self.redraw()
        self.is_panning = False

    def load_image(self, path, auto_fit=True):
        self.img_path = path
        try:
            self.bg_image_pil = Image.open(path).convert('RGB')
            self.cached_resized_photo = None
            self.cached_crop_key = None
            if auto_fit:
                self.zoom_fit()
        except Exception as e:
            messagebox.showerror("錯誤", f"無法讀取底圖: {e}")

    def get_clean_image_bounds(self):
        """獲取清潔線稿圖中賽道中心與像素範圍 (用於精準 1:1 點位與圖像對齊)"""
        if not self.img_path:
            return None

        clean_path = self.img_path.replace(".png", "_clean.png")
        if not os.path.exists(clean_path):
            clean_path = self.img_path

        try:
            img = Image.open(clean_path).convert('L')
            arr = np.array(img)
            ys, xs = np.where(arr < 128)
            if len(xs) == 0:
                return None
            return {
                'min_x': float(xs.min()), 'max_x': float(xs.max()),
                'min_y': float(ys.min()), 'max_y': float(ys.max()),
                'cx': (float(xs.min()) + float(xs.max())) / 2.0,
                'cy': (float(ys.min()) + float(ys.max())) / 2.0,
                'w': float(xs.max() - xs.min()),
                'h': float(ys.max() - ys.min()),
            }
        except Exception:
            return None

    def align_points_to_image(self):
        """將點位精準 1:1 對齊至當前底圖"""
        if not self.px_points:
            messagebox.showwarning("提示", "目前沒有點位可供對齊！")
            return

        bounds = self.get_clean_image_bounds()
        if not bounds:
            messagebox.showwarning("提示", "無法解析底圖賽道範圍！")
            return

        pts_arr = np.array(self.px_points)
        p_min_x, p_max_x = pts_arr[:, 0].min(), pts_arr[:, 0].max()
        p_min_y, p_max_y = pts_arr[:, 1].min(), pts_arr[:, 1].max()

        p_cx = (p_min_x + p_max_x) / 2.0
        p_cy = (p_min_y + p_max_y) / 2.0
        p_w = (p_max_x - p_min_x) or 1.0
        p_h = (p_max_y - p_min_y) or 1.0

        scale_x = bounds['w'] / p_w
        scale_y = bounds['h'] / p_h
        scale = (scale_x + scale_y) / 2.0

        aligned = []
        for px, py in self.px_points:
            nx = (px - p_cx) * scale + bounds['cx']
            ny = (py - p_cy) * scale + bounds['cy']
            aligned.append([nx, ny])

        self.px_points = aligned
        self.redraw()
        self.lbl_info.config(text=f"🎯 已成功將 {len(self.px_points)} 個點位 1:1 精準對齊至底圖！")

    def reverse_track_direction(self):
        """反轉賽道起終點 (將主線點位順序與捷徑起終點/方向對調)"""
        if not self.px_points:
            messagebox.showwarning("提示", "目前沒有點位可供對調！")
            return

        N = len(self.px_points)
        # 1. 反轉主線點位順序
        self.px_points.reverse()

        # 2. 反轉當前選取點的 Index
        if self.selected_point_idx is not None and self.edit_mode == 'main':
            if 0 <= self.selected_point_idx < N:
                self.selected_point_idx = N - 1 - self.selected_point_idx

        # 3. 反轉起點、終點與檢查點 Index
        old_st = self.start_index if self.start_index is not None else 0
        old_fn = self.finish_index if self.finish_index is not None else (N - 1)

        self.start_index = (N - 1 - old_fn) if (0 <= old_fn < N) else 0
        self.finish_index = (N - 1 - old_st) if (0 <= old_st < N) else (N - 1)

        self.checkpoints = sorted([(N - 1 - cp) for cp in self.checkpoints if 0 <= cp < N])

        # 4. 更新所有捷徑的分岔點/匯合點 Index 與中繼點順序
        for sc in self.shortcuts:
            old_start = sc.get('start')
            old_end = sc.get('end')

            new_start = (N - 1 - old_end) if (old_end is not None and 0 <= old_end < N) else None
            new_end = (N - 1 - old_start) if (old_start is not None and 0 <= old_start < N) else None

            sc['start'] = new_start
            sc['end'] = new_end
            if 'mids' in sc and sc['mids']:
                sc['mids'].reverse()

        self.update_special_status_label()
        self.redraw()
        messagebox.showinfo("對調完成", f"🔄 已成功將賽道起終點對調！\n共 {N} 個控制點，起點 (#{self.start_index+1}) 與終點 (#{self.finish_index+1}) 方向已完成互換。")

    def auto_trace_async(self):
        self.lbl_info.config(text="⏳ 正在自動追蹤賽道骨架，請稍候...")
        threading.Thread(target=self.auto_trace, daemon=True).start()

    def auto_trace(self):
        if not self.img_path or not os.path.exists(self.img_path):
            clean_path = r"c:\Users\timac\Documents\Repository\AmanoShizukikun.github.io\projects\game-center\games\cyberrace\Happougahara_clean.png"
        else:
            clean_path = self.img_path.replace(".png", "_clean.png")
            if not os.path.exists(clean_path):
                clean_path = self.img_path

        try:
            img = Image.open(clean_path).convert('L')
            arr = np.array(img)
            binary = arr < 128
            skel = skeletonize(binary)
            ys, xs = np.where(skel)
            pts = np.stack([xs, ys], axis=1).astype(float)

            pt_to_idx = {tuple(p): i for i, p in enumerate(pts)}
            G = nx.Graph()
            for i, (x, y) in enumerate(pts):
                G.add_node(i)
                for dx in [-1, 0, 1]:
                    for dy in [-1, 0, 1]:
                        if dx == 0 and dy == 0: continue
                        neighbor = (x + dx, y + dy)
                        if neighbor in pt_to_idx:
                            G.add_edge(i, pt_to_idx[neighbor], weight=np.hypot(dx, dy))

            # 自動追蹤骨架 (區分 Linear / Circuit)
            is_circuit = (self.track_type.get() == "circuit")
            if is_circuit:
                cycles = nx.cycle_basis(G)
                if cycles:
                    def cycle_len(c):
                        l = 0.0
                        for k in range(len(c)):
                            u, v = c[k], c[(k + 1) % len(c)]
                            if G.has_edge(u, v):
                                l += G[u][v].get('weight', 1.0)
                        return l
                    best_c = max(cycles, key=cycle_len)
                    subg = G.subgraph(best_c).copy()
                    ordered_nodes = list(nx.dfs_preorder_nodes(subg, source=best_c[0]))
                    raw_path = pts[ordered_nodes]
                else:
                    deg1 = [n for n, d in G.degree() if d == 1]
                    if not deg1 and len(G) > 0:
                        deg1 = [list(G.nodes())[0]]
                    max_len = 0
                    best_path = list(G.nodes())
                    for i in range(len(deg1)):
                        for j in range(i, len(deg1)):
                            n1, n2 = deg1[i], deg1[j]
                            if nx.has_path(G, n1, n2):
                                plen = nx.shortest_path_length(G, n1, n2, weight='weight')
                                if plen > max_len:
                                    max_len = plen
                                    best_path = nx.shortest_path(G, n1, n2, weight='weight')
                    raw_path = pts[best_path]
            else:
                # 修剪捷徑環路
                for _ in range(100):
                    cycles = nx.cycle_basis(G)
                    if not cycles: break
                    removed = False
                    for c in cycles:
                        juncs = [n for n in c if G.degree(n) >= 3]
                        if len(juncs) >= 2:
                            for u in juncs:
                                for v in juncs:
                                    if u != v and G.has_edge(u, v):
                                        G.remove_edge(u, v)
                                        removed = True
                                        break
                                if removed: break
                        elif len(c) >= 3:
                            G.remove_edge(c[0], c[1])
                            removed = True
                        if removed: break
                    if not removed: break

                deg1 = [n for n, d in G.degree() if d == 1]
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

                raw_path = pts[best_path] if best_path else pts

            from trace_track_to_points import rdp
            simplified = rdp(raw_path, 1.5)

            self.px_points = simplified.tolist()
            self.root.after(0, self.on_auto_trace_complete)
        except Exception as e:
            err_msg = str(e)
            self.root.after(0, lambda m=err_msg: messagebox.showerror("追蹤失敗", f"自動追蹤發生錯誤: {m}"))

    def on_auto_trace_complete(self):
        self.redraw()
        self.lbl_info.config(text=f"⚡ 已自動追蹤產生 {len(self.px_points)} 個極致 3D 控制點。您可以滾輪放大微調！")

    def on_btn_load_image(self):
        file_path = filedialog.askopenfilename(filetypes=[("PNG 圖片", "*.png"), ("所有檔案", "*.*")])
        if file_path:
            self.load_image(file_path, auto_fit=True)
            if self.px_points:
                self.align_points_to_image()

    def on_btn_load_points(self):
        file_path = filedialog.askopenfilename(filetypes=[("JSON/TXT 賽道檔", "*.json;*.txt"), ("JSON 檔案", "*.json"), ("文字檔", "*.txt"), ("所有檔案", "*.*")])
        if file_path:
            self.load_points_file(file_path)

    def load_points_file(self, file_path):
        """讀取 JSON 或 TXT (Vector3) 點位檔，還原點位與捷徑資料並對齊底圖"""
        try:
            pts = []
            shortcuts_loaded = []
            is_json = file_path.lower().endswith('.json')
            data = {}

            if is_json:
                import json
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                # 更新賽道元資料選單
                if 'id' in data:
                    self.selected_track_key.set(data['id'])
                if 'type' in data:
                    self.track_type.set(data['type'])
                if 'length' in data:
                    try:
                        len_str = str(data['length']).replace('m', '').strip()
                        self.target_length_m.set(float(len_str))
                    except ValueError:
                        pass

                self.start_index = data.get('startIndex', 0)
                self.finish_index = data.get('finishIndex', None)
                if self.track_type.get() == 'circuit':
                    self.checkpoints = []
                else:
                    self.checkpoints = data.get('checkpoints', [])

                # 讀取主線 points [[x, y, z], ...]
                raw_pts = data.get('points', [])
                for p in raw_pts:
                    if len(p) >= 3:
                        pts.append((float(p[0]), float(p[2])))
                    elif len(p) == 2:
                        pts.append((float(p[0]), float(p[1])))

                # 讀取捷徑 altRoutes
                alt_routes = data.get('altRoutes', [])
                if alt_routes:
                    for ar in alt_routes:
                        st_idx = ar.get('startIdx', None)
                        ed_idx = ar.get('endIdx', None)
                        ar_pts = ar.get('points', [])
                        sc_mids = []
                        for p in ar_pts:
                            if len(p) >= 3:
                                sc_mids.append((float(p[0]), float(p[2])))
                            elif len(p) == 2:
                                sc_mids.append((float(p[0]), float(p[1])))
                        shortcuts_loaded.append({
                            'start': st_idx,
                            'end': ed_idx,
                            'mids_world': sc_mids
                        })
            else:
                # 讀取 .txt THREE.Vector3 文字檔
                with open(file_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()

                for line in lines:
                    if 'Vector3(' in line:
                        parts = line.split('Vector3(')[1].split(')')[0].split(',')
                        wx, wy, wz = float(parts[0]), float(parts[1]), float(parts[2])
                        pts.append((wx, wz))

            if not pts:
                messagebox.showwarning("警告", "未在檔案中找到有效的賽道點位！")
                return

            pts_arr = np.array(pts)
            min_wx, max_wx = pts_arr[:, 0].min(), pts_arr[:, 0].max()
            min_wz, max_wz = pts_arr[:, 1].min(), pts_arr[:, 1].max()

            # 自動尋找與賽道 ID 相符的底圖 PNG
            if is_json and 'id' in data:
                key = data['id']
                base_dir = os.path.dirname(os.path.abspath(file_path))
                possible_images = [
                    os.path.join(base_dir, f"{key}.png"),
                    os.path.join(base_dir, f"{key}_clean.png"),
                    os.path.join(base_dir, f"{key.capitalize()}.png"),
                    os.path.join(base_dir, f"Lihpao_International_Circuit.svg.webp"),
                    os.path.join(os.path.dirname(os.path.abspath(__file__)), f"{key}.png"),
                    os.path.join(os.path.dirname(os.path.abspath(__file__)), f"{key.capitalize()}.png"),
                ]
                for img_p in possible_images:
                    if os.path.exists(img_p):
                        self.load_image(img_p, auto_fit=True)
                        break

            bounds = self.get_clean_image_bounds()
            if bounds:
                img_cx, img_cy = bounds['cx'], bounds['cy']
                scale_x = (max_wx - min_wx) / (bounds['w'] or 1.0)
                scale_z = (max_wz - min_wz) / (bounds['h'] or 1.0)
                scale = (scale_x + scale_z) / 2.0
            else:
                w = self.bg_image_pil.width if self.bg_image_pil else 800
                h = self.bg_image_pil.height if self.bg_image_pil else 800
                img_cx, img_cy = w / 2.0, h / 2.0
                scale = max(max_wx - min_wx, max_wz - min_wz) / (min(w, h) * 0.8)
                if scale <= 0: scale = 1.0

            px_list = []
            for wx, wz in pts:
                px = (wx / scale) + img_cx
                py = (wz / scale) + img_cy
                px_list.append([px, py])

            self.px_points = px_list

            # 還原捷徑
            if shortcuts_loaded:
                sc_list = []
                for sc_item in shortcuts_loaded:
                    sc_px_mids = []
                    for wx, wz in sc_item['mids_world']:
                        px = (wx / scale) + img_cx
                        py = (wz / scale) + img_cy
                        sc_px_mids.append([px, py])
                    sc_list.append({
                        'start': sc_item['start'],
                        'end': sc_item['end'],
                        'mids': sc_px_mids
                    })
                self.shortcuts = sc_list
                self.active_shortcut_idx = 0
                self.update_shortcut_combobox()

            self.update_special_status_label()
            self.redraw()
            sc_msg = f" (含 {len(shortcuts_loaded)} 條捷徑)" if shortcuts_loaded else ""
            messagebox.showinfo("載入成功", f"🎉 成功載入賽道檔案: {os.path.basename(file_path)}\n共 {len(self.px_points)} 個控制點{sc_msg}，已自動繪製至畫布！")
        except Exception as e:
            messagebox.showerror("讀取失敗", f"載入點位檔失敗: {e}")

    def toggle_edit_mode(self):
        """切換主賽道 / 捷徑 / 微調底圖模式"""
        self.selected_point_idx = None
        self.hovered_point_idx = None
        if self.edit_mode == 'main':
            self.edit_mode = 'shortcut'
            self.btn_mode.config(text="✏️ 編輯: 捷徑")
            self.frame_sc_ctrl.pack(side=tk.LEFT, padx=3)
            self.update_shortcut_combobox()
            messagebox.showinfo(
                "捷徑編輯模式",
                "捷徑操作說明：\n"
                "① 點擊主線上的節點 → 設定當前捷徑的分岔點 (起點 🟠) 或 匯合點 (終點 🟡)\n"
                "② 在空白處點擊 → 新增當前捷徑的中繼點\n"
                "③ 可按 [➕ 新增捷徑] 建立多條獨立捷徑路徑！\n"
                "④ 下拉選單可隨時切換正在編輯的捷徑"
            )
        elif self.edit_mode == 'shortcut':
            self.edit_mode = 'image'
            self.btn_mode.config(text="🖼️ 編輯: 底圖 (拖曳/滾輪)")
            self.frame_sc_ctrl.pack_forget()
            messagebox.showinfo(
                "微調底圖模式",
                "底圖微調說明：\n"
                "① 滑鼠左鍵拖曳 → 自由平移底圖位置\n"
                "② 滑鼠滾輪上下滾動 → 縮放底圖大小\n"
                "③ 點位完全固定不變！滿意後可按 [📌 將底圖偏移套用至點位]"
            )
        else:
            self.edit_mode = 'main'
            self.btn_mode.config(text="✏️ 編輯: 主線")
            self.frame_sc_ctrl.pack_forget()
        self.redraw()

    def update_shortcut_combobox(self):
        vals = [f"捷徑 #{i+1}" for i in range(len(self.shortcuts))]
        self.cb_sc_select.config(values=vals)
        if 0 <= self.active_shortcut_idx < len(self.shortcuts):
            self.cb_sc_select.current(self.active_shortcut_idx)

    def on_shortcut_selected(self, event=None):
        idx = self.cb_sc_select.current()
        if 0 <= idx < len(self.shortcuts):
            self.active_shortcut_idx = idx
            self.selected_point_idx = None
            self.redraw()

    def add_new_shortcut(self):
        self.shortcuts.append({'start': None, 'end': None, 'mids': []})
        self.active_shortcut_idx = len(self.shortcuts) - 1
        self.update_shortcut_combobox()
        self.redraw()
        messagebox.showinfo("新增捷徑", f"已新增並選取 捷徑 #{len(self.shortcuts)}，請依序點擊主線節點與空白中繼點！")

    def delete_current_shortcut(self):
        if len(self.shortcuts) <= 1:
            self.shortcuts[0] = {'start': None, 'end': None, 'mids': []}
            self.active_shortcut_idx = 0
        else:
            del self.shortcuts[self.active_shortcut_idx]
            self.active_shortcut_idx = max(0, self.active_shortcut_idx - 1)
        self.update_shortcut_combobox()
        self.redraw()

    def get_shortcut_full_path(self, sc_dict):
        """取得單條捷徑完整路徑: [主線起點, ...中繼點..., 主線終點] (像素座標)"""
        st, ed, mids = sc_dict['start'], sc_dict['end'], sc_dict['mids']
        if st is None or ed is None or st == ed:
            return None
        if not (0 <= st < len(self.px_points) and 0 <= ed < len(self.px_points)):
            return None
        return [self.px_points[st]] + list(mids) + [self.px_points[ed]]

    def get_active_shortcut(self):
        if 0 <= self.active_shortcut_idx < len(self.shortcuts):
            return self.shortcuts[self.active_shortcut_idx]
        return None

    def clear_all_points(self):
        if messagebox.askyesno("確認", "確定要清空主賽道所有控制點嗎？"):
            self.px_points = []
            self.selected_point_idx = None
            self.start_index = 0
            self.finish_index = None
            self.checkpoints = []
            self.update_special_status_label()
            self.redraw()

    def clear_shortcut_points(self):
        if messagebox.askyesno("確認", "確定要清空當前捷徑嗎？"):
            sc = self.get_active_shortcut()
            if sc:
                sc['start'] = None
                sc['end'] = None
                sc['mids'] = []
                self.selected_point_idx = None
                self.redraw()

    def find_nearest_point(self, cx, cy, max_canvas_dist=12.0):
        """在主線 or 當前捷徑中繼點中尋找最近節點"""
        if self.edit_mode == 'shortcut':
            sc = self.get_active_shortcut()
            pts_list = sc['mids'] if sc else []
        else:
            pts_list = self.px_points
        if not pts_list:
            return None
        pts = np.array(pts_list)
        c_pts = np.array([self.world_to_canvas(p[0], p[1]) for p in pts])
        dists = np.hypot(c_pts[:, 0] - cx, c_pts[:, 1] - cy)
        min_idx = np.argmin(dists)
        if dists[min_idx] <= max_canvas_dist:
            return min_idx
        return None

    def find_nearest_main_point(self, cx, cy, max_canvas_dist=18.0):
        """在主線中尋找最近節點（用於捷徑接合點）"""
        if not self.px_points:
            return None
        pts = np.array(self.px_points)
        c_pts = np.array([self.world_to_canvas(p[0], p[1]) for p in pts])
        dists = np.hypot(c_pts[:, 0] - cx, c_pts[:, 1] - cy)
        min_idx = np.argmin(dists)
        if dists[min_idx] <= max_canvas_dist:
            return min_idx
        return None

    def on_canvas_mouse_move(self, event):
        idx = self.find_nearest_point(event.x, event.y)
        if idx != self.hovered_point_idx:
            self.hovered_point_idx = idx
            self.canvas.config(cursor="hand2" if idx is not None else "cross")
            self.redraw()

    def delete_selected_point(self):
        if self.edit_mode == 'shortcut':
            sc = self.get_active_shortcut()
            if sc and self.selected_point_idx is not None and 0 <= self.selected_point_idx < len(sc['mids']):
                del sc['mids'][self.selected_point_idx]
                self.selected_point_idx = None
                self.redraw()
        else:
            if self.selected_point_idx is not None and 0 <= self.selected_point_idx < len(self.px_points):
                del_idx = self.selected_point_idx
                del self.px_points[del_idx]
                self.selected_point_idx = None

                if self.start_index == del_idx:
                    self.start_index = 0
                elif self.start_index is not None and self.start_index > del_idx:
                    self.start_index -= 1

                if self.finish_index == del_idx:
                    self.finish_index = None
                elif self.finish_index is not None and self.finish_index > del_idx:
                    self.finish_index -= 1

                new_cps = []
                for cp in self.checkpoints:
                    if cp < del_idx:
                        new_cps.append(cp)
                    elif cp > del_idx:
                        new_cps.append(cp - 1)
                self.checkpoints = sorted(new_cps)

                self.update_special_status_label()
                self.redraw()

    def nudge_selected_point(self, dx_px, dy_px):
        if self.edit_mode == 'shortcut':
            sc = self.get_active_shortcut()
            lst = sc['mids'] if sc else []
        else:
            lst = self.px_points
        if self.selected_point_idx is not None and 0 <= self.selected_point_idx < len(lst):
            lst[self.selected_point_idx][0] += dx_px / self.zoom_scale
            lst[self.selected_point_idx][1] += dy_px / self.zoom_scale
            self.redraw()

    # ── 主線模式的左鍵點擊 ──────────────────────────────
    def _main_left_click(self, cx, cy):
        idx = self.find_nearest_point(cx, cy)
        if idx is not None:
            self.selected_point_idx = idx
        else:
            px, py = self.canvas_to_world(cx, cy)
            pts = self.px_points
            if len(pts) >= 2:
                best_insert_idx = len(pts)
                best_dist = 999999
                for i in range(len(pts) - 1):
                    p1 = np.array(pts[i])
                    p2 = np.array(pts[i + 1])
                    v = p2 - p1
                    l2 = np.sum(v * v)
                    t = 0 if l2 == 0 else max(0, min(1, np.dot([px, py] - p1, v) / l2))
                    proj = p1 + t * v
                    d = np.hypot(px - proj[0], py - proj[1])
                    if d < best_dist:
                        best_dist = d
                        best_insert_idx = i + 1
                pts.insert(best_insert_idx, [px, py])
                self.selected_point_idx = best_insert_idx
            else:
                pts.append([px, py])
                self.selected_point_idx = len(pts) - 1

    # ── 捷徑模式的左鍵點擊 ──────────────────────────────
    def _shortcut_left_click(self, cx, cy):
        """捷徑模式：
        - 若靠近主線節點 → 設定接合點 (start 優先，再設 end)
        - 否則 → 新增中繼點 (插入到最近的中繼線段)
        """
        sc = self.get_active_shortcut()
        if not sc: return

        main_idx = self.find_nearest_main_point(cx, cy)
        if main_idx is not None:
            if sc['start'] is None:
                sc['start'] = main_idx
            elif sc['end'] is None:
                if main_idx != sc['start']:
                    sc['end'] = main_idx
            else:
                d_start = np.hypot(*[a - b for a, b in zip(
                    self.world_to_canvas(*self.px_points[sc['start']]), (cx, cy))])
                d_end = np.hypot(*[a - b for a, b in zip(
                    self.world_to_canvas(*self.px_points[sc['end']]), (cx, cy))])
                if d_start <= d_end:
                    sc['start'] = main_idx
                else:
                    sc['end'] = main_idx
            self.selected_point_idx = None
            return

        px, py = self.canvas_to_world(cx, cy)
        mid = sc['mids']
        if sc['start'] is None:
            messagebox.showinfo("提示", "請先點擊主線上的節點作為捷徑分岔點 (起點)。")
            return
        idx = self.find_nearest_point(cx, cy)
        if idx is not None:
            self.selected_point_idx = idx
        else:
            if len(mid) >= 2:
                best_i = len(mid)
                best_d = 999999
                for i in range(len(mid) - 1):
                    p1 = np.array(mid[i])
                    p2 = np.array(mid[i + 1])
                    v = p2 - p1
                    l2 = np.sum(v * v)
                    t = 0 if l2 == 0 else max(0, min(1, np.dot([px, py] - p1, v) / l2))
                    proj = p1 + t * v
                    d = np.hypot(px - proj[0], py - proj[1])
                    if d < best_d:
                        best_d = d
                        best_i = i + 1
                mid.insert(best_i, [px, py])
                self.selected_point_idx = best_i
            else:
                mid.append([px, py])
                self.selected_point_idx = len(mid) - 1

    def on_canvas_left_click(self, event):
        is_alt_held = bool(event.state & 0x0020) or bool(event.state & 0x0080) or bool(event.state & 0x20000) or bool(event.state & 0x8) or (self.edit_mode == 'image')
        if is_alt_held or (event.state & 0x0001):  # Alt or Shift key held → drag/pan image
            self.on_pan_start(event)
            return
        cx, cy = event.x, event.y
        if self.edit_mode == 'shortcut':
            self._shortcut_left_click(cx, cy)
        else:
            self._main_left_click(cx, cy)
        self.redraw()

    def on_canvas_left_drag(self, event):
        if getattr(self, 'is_dragging_img', False):
            self.on_pan_move(event)
            return
        if self.is_panning:
            self.on_pan_move(event)
            return
        if self.edit_mode == 'shortcut':
            sc = self.get_active_shortcut()
            lst = sc['mids'] if sc else []
        else:
            lst = self.px_points
        if self.selected_point_idx is not None and 0 <= self.selected_point_idx < len(lst):
            px, py = self.canvas_to_world(event.x, event.y)
            lst[self.selected_point_idx] = [px, py]
            self.redraw()

    def on_canvas_left_release(self, event):
        if getattr(self, 'is_dragging_img', False) or self.is_panning:
            self.on_pan_end(event)

    def on_canvas_right_click(self, event):
        cx, cy = event.x, event.y
        if self.edit_mode == 'shortcut':
            sc = self.get_active_shortcut()
            if sc:
                mid_idx = self.find_nearest_point(cx, cy)
                if mid_idx is not None:
                    del sc['mids'][mid_idx]
                    if self.selected_point_idx == mid_idx:
                        self.selected_point_idx = None
                else:
                    main_idx = self.find_nearest_main_point(cx, cy, max_canvas_dist=18.0)
                    if main_idx is not None:
                        if main_idx == sc['start']:
                            sc['start'] = None
                        elif main_idx == sc['end']:
                            sc['end'] = None
        else:
            idx = self.find_nearest_point(cx, cy)
            if idx is not None:
                del self.px_points[idx]
                if self.selected_point_idx == idx:
                    self.selected_point_idx = None
        self.redraw()

    def redraw(self):
        """超高效極速畫布繪製 (Viewport Crop + Fast Spline & Clip Node Rendering)"""
        self.canvas.delete("all")

        cw = max(10, self.canvas.winfo_width())
        ch = max(10, self.canvas.winfo_height())

        # 1. 極速 Viewport Cropping 繪製底圖 (支援獨立平移/縮放，不影響控制點)
        if self.bg_image_pil:
            iw, ih = self.bg_image_pil.width, self.bg_image_pil.height
            eff_scale = self.zoom_scale * self.img_scale

            src_l = max(0, int((-self.pan_offset_x - self.img_offset_x * self.zoom_scale) / eff_scale))
            src_t = max(0, int((-self.pan_offset_y - self.img_offset_y * self.zoom_scale) / eff_scale))
            src_r = min(iw, int((cw - self.pan_offset_x - self.img_offset_x * self.zoom_scale) / eff_scale))
            src_b = min(ih, int((ch - self.pan_offset_y - self.img_offset_y * self.zoom_scale) / eff_scale))

            if src_r > src_l and src_b > src_t:
                crop_key = (src_l, src_t, src_r, src_b, int(eff_scale * 1000), cw, ch, self.img_offset_x, self.img_offset_y, self.img_scale)
                if self.cached_crop_key != crop_key:
                    cropped = self.bg_image_pil.crop((src_l, src_t, src_r, src_b))
                    dst_w = max(1, int((src_r - src_l) * eff_scale))
                    dst_h = max(1, int((src_b - src_t) * eff_scale))
                    resized_img = cropped.resize((dst_w, dst_h), Image.Resampling.BILINEAR)
                    self.cached_resized_photo = ImageTk.PhotoImage(resized_img)
                    self.cached_crop_key = crop_key

                dst_x = self.pan_offset_x + (self.img_offset_x + src_l * self.img_scale) * self.zoom_scale
                dst_y = self.pan_offset_y + (self.img_offset_y + src_t * self.img_scale) * self.zoom_scale
                self.canvas.create_image(dst_x, dst_y, image=self.cached_resized_photo, anchor=tk.NW)

        # 2a. 繪製主賽道
        if not self.px_points:
            mode_str = '捷徑 🔶' if self.edit_mode == 'shortcut' else '主線 🔷'
            self.lbl_info.config(text=f"✏️ 編輯模式: {mode_str} | 主線: 0點 | 縮放: {int(self.zoom_scale*100)}%")
            return

        pts_arr = np.array(self.px_points)
        canvas_pts = np.array([self.world_to_canvas(p[0], p[1]) for p in pts_arr])
        main_is_active = (self.edit_mode == 'main')
        is_circuit = (self.track_type.get() == "circuit")

        if len(self.px_points) >= 2:
            main_line_color = "#ff0088" if main_is_active else "#882255"
            try:
                draw_pts = np.vstack([canvas_pts, canvas_pts[0]]) if is_circuit else canvas_pts
                num_samples = min(800, max(150, len(draw_pts) * 4))
                t = np.linspace(0, 1, len(draw_pts))
                t_smooth = np.linspace(0, 1, num_samples)
                flat_pts = []
                for sx, sy in zip(CubicSpline(t, draw_pts[:, 0])(t_smooth),
                                   CubicSpline(t, draw_pts[:, 1])(t_smooth)):
                    flat_pts.extend([sx, sy])
                self.canvas.create_line(flat_pts, fill=main_line_color, width=3 if main_is_active else 2)
            except Exception:
                draw_pts = np.vstack([canvas_pts, canvas_pts[0]]) if is_circuit else canvas_pts
                flat_pts = draw_pts.flatten().tolist()
                self.canvas.create_line(flat_pts, fill=main_line_color, width=2)

            for i in range(len(canvas_pts) - (0 if is_circuit else 1)):
                p1 = canvas_pts[i]
                p2 = canvas_pts[(i + 1) % len(canvas_pts)]
                self.canvas.create_line(p1[0], p1[1], p2[0], p2[1], fill="#00ffff", width=1, dash=(3, 3))

        # 收集所有捷徑的分岔點與匯合點
        junc_starts = {sc['start'] for sc in self.shortcuts if sc['start'] is not None}
        junc_ends = {sc['end'] for sc in self.shortcuts if sc['end'] is not None}

        # 繪製主線節點
        margin = 30
        eff_start = self.start_index if (self.start_index is not None and 0 <= self.start_index < len(canvas_pts)) else 0
        eff_finish = self.finish_index if (self.finish_index is not None and 0 <= self.finish_index < len(canvas_pts)) else (0 if is_circuit else len(canvas_pts) - 1)
        valid_cps = sorted([cp for cp in self.checkpoints if 0 <= cp < len(canvas_pts)]) if not is_circuit else []

        for i, p in enumerate(canvas_pts):
            px, py = p[0], p[1]
            if px < -margin or px > cw + margin or py < -margin or py > ch + margin:
                continue
            is_junc_start = (i in junc_starts)
            is_junc_end = (i in junc_ends)
            is_custom_start = (i == eff_start)
            is_custom_finish = (i == eff_finish) and not is_circuit
            is_checkpoint = (i in valid_cps) and not is_circuit
            is_selected = main_is_active and (i == self.selected_point_idx)
            is_hovered = main_is_active and (i == self.hovered_point_idx)

            if is_selected:
                color, r = "#00ffff", 8
            elif is_hovered:
                color, r = "#ffffff", 7
            elif is_custom_start and is_circuit:
                color, r = "#00ffcc", 9   # 🏁 環道起終點 (亮青)
            elif is_custom_start:
                color, r = "#00ff44", 9   # 🚀 起點 (亮綠)
            elif is_custom_finish:
                color, r = "#ff0055", 9   # 🏁 終點 (亮紅)
            elif is_checkpoint:
                color, r = "#ffea00", 8   # 🚩 檢查點 (霓虹黃)
            elif is_junc_start:
                color, r = "#ff6600", 9   # 分岔點 (橘)
            elif is_junc_end:
                color, r = "#ffaa00", 9   # 匯合點 (金)
            else:
                color, r = "#ffff00", 5

            self.canvas.create_oval(px-r, py-r, px+r, py+r, fill=color, outline="#000000",
                                    width=2 if (is_junc_start or is_junc_end or is_custom_start or is_custom_finish or is_checkpoint) else (1.5 if is_selected else 1))

            show_label = (is_selected or is_hovered or is_custom_start or is_custom_finish or is_checkpoint or
                          is_junc_start or is_junc_end or len(canvas_pts) <= 60 or i % 3 == 0)
            if show_label:
                if is_custom_start and is_circuit:
                    label = f"🏁起/終(#{i+1})"
                elif is_custom_start:
                    label = f"🚀起點(#{i+1})"
                elif is_custom_finish:
                    label = f"🏁終點(#{i+1})"
                elif is_checkpoint:
                    cp_seq = valid_cps.index(i) + 1
                    label = f"🚩CP{cp_seq}(#{i+1})"
                elif is_junc_start and is_junc_end:
                    label = f"{i+1}(岔/匯)"
                elif is_junc_start:
                    label = f"{i+1}(分岔)"
                elif is_junc_end:
                    label = f"{i+1}(匯合)"
                else:
                    label = str(i+1)
                self.canvas.create_text(px+10, py-10, text=label, fill="#ffffff", font=("Arial", 9, "bold"))

        # 2b. 繪製所有捷徑路線 (橘色)
        for sc_idx, sc in enumerate(self.shortcuts):
            full_sc = self.get_shortcut_full_path(sc)
            if not full_sc or len(full_sc) < 2:
                continue
            sc_arr = np.array(full_sc)
            sc_canvas = np.array([self.world_to_canvas(p[0], p[1]) for p in sc_arr])
            is_active_sc = (self.edit_mode == 'shortcut' and sc_idx == self.active_shortcut_idx)
            sc_line_color = "#ff8800" if is_active_sc else "#885500"

            try:
                num_s = min(600, max(100, len(sc_canvas) * 4))
                t_sc = np.linspace(0, 1, len(sc_canvas))
                t_sm = np.linspace(0, 1, num_s)
                sc_flat = []
                for sx, sy in zip(CubicSpline(t_sc, sc_canvas[:, 0])(t_sm),
                                   CubicSpline(t_sc, sc_canvas[:, 1])(t_sm)):
                    sc_flat.extend([sx, sy])
                self.canvas.create_line(sc_flat, fill=sc_line_color, width=3 if is_active_sc else 2)
            except Exception:
                sc_flat = sc_canvas.flatten().tolist()
                self.canvas.create_line(sc_flat, fill=sc_line_color, width=2)

            # 只畫中繼點 (sc_canvas[1:-1])
            for i, p in enumerate(sc_canvas[1:-1], start=1):
                px_s, py_s = p[0], p[1]
                if px_s < -margin or px_s > cw + margin or py_s < -margin or py_s > ch + margin:
                    continue
                mid_i = i - 1
                is_sel = is_active_sc and (mid_i == self.selected_point_idx)
                is_hov = is_active_sc and (mid_i == self.hovered_point_idx)
                if is_sel:
                    c, r = "#00ffff", 8
                elif is_hov:
                    c, r = "#ffffff", 7
                else:
                    c, r = "#ffaa00" if is_active_sc else "#aa6600", 5
                self.canvas.create_oval(px_s-r, py_s-r, px_s+r, py_s+r, fill=c, outline="#000000",
                                        width=1.5 if is_sel else 1)
                if is_sel or is_hov or len(sc_canvas) <= 10:
                    self.canvas.create_text(px_s+10, py_s-10, text=f"S{sc_idx+1}-{i}", fill="#ffaa00", font=("Arial", 9, "bold"))

        mode_str = '捷徑 🔶' if self.edit_mode == 'shortcut' else '主線 🔷'
        valid_sc_cnt = sum(1 for sc in self.shortcuts if self.get_shortcut_full_path(sc))
        sc_info = f"已設捷徑: {valid_sc_cnt}/{len(self.shortcuts)}條" if self.edit_mode == 'shortcut' else f"捷徑數: {valid_sc_cnt}條"
        self.lbl_info.config(text=f"✏️ 模式: {mode_str} | 主線: {len(self.px_points)}點 | {sc_info} | 縮放: {int(self.zoom_scale*100)}%")

    def generate_world_vector3_code(self):
        """生成主賽道的 THREE.Vector3 JS 程式碼字串"""
        if len(self.px_points) < 2:
            return ""

        pts = np.array(self.px_points)
        target_len = parse_float_val(self.target_length_m.get(), 5000.0)
        dh_height = parse_float_val(self.downhill_height_m.get(), 200.0)

        raw_len = float(np.linalg.norm(np.diff(pts, axis=0), axis=1).sum())
        scale = float(target_len / raw_len) if raw_len > 0 else 1.0

        cx = (pts[:, 0].min() + pts[:, 0].max()) / 2.0
        cy = (pts[:, 1].min() + pts[:, 1].max()) / 2.0

        world_xz = (pts - [cx, cy]) * scale

        segment_lens = np.linalg.norm(np.diff(world_xz, axis=0), axis=1)
        cum_lens = np.concatenate([[0], np.cumsum(segment_lens)])
        total_world_len = cum_lens[-1]

        key = self.selected_track_key.get()
        lines = []
        for i in range(len(world_xz)):
            x = world_xz[i, 0]
            z = world_xz[i, 1]
            progress = cum_lens[i] / total_world_len if total_world_len > 0 else 0
            y = dh_height * (1.0 - progress)
            tag = f"  // 起點 (山頂 {key})" if i == 0 else (f"  // 終點 (山腳 出口)" if i == len(world_xz) - 1 else "")
            lines.append(f"                    new THREE.Vector3({x:.1f}, {y:.1f}, {z:.1f}),{tag}")

        return "\n".join(lines)

    def generate_shortcut_vector3_code(self):
        """生成多條捷徑分支的 THREE.Vector3 JS 程式碼字串。
        捷徑起點/終點的高度 (Y 座標) 必須 100% 精確對齊主線分岔點與匯合點的高度！
        """
        valid_shortcuts = []
        for sc in self.shortcuts:
            full_sc = self.get_shortcut_full_path(sc)
            if full_sc and len(full_sc) >= 2:
                valid_shortcuts.append((sc, full_sc))

        if not valid_shortcuts or len(self.px_points) < 2:
            return "", False

        pts_main = np.array(self.px_points)
        target_len = parse_float_val(self.target_length_m.get(), 5000.0)
        dh_height = parse_float_val(self.downhill_height_m.get(), 200.0)

        raw_len = float(np.linalg.norm(np.diff(pts_main, axis=0), axis=1).sum())
        scale = float(target_len / raw_len) if raw_len > 0 else 1.0
        cx = (pts_main[:, 0].min() + pts_main[:, 0].max()) / 2.0
        cy = (pts_main[:, 1].min() + pts_main[:, 1].max()) / 2.0

        # 主線累加長度與 progress
        main_world = (pts_main - [cx, cy]) * scale
        main_seg_lens = np.linalg.norm(np.diff(main_world, axis=0), axis=1)
        main_cum_lens = np.concatenate([[0], np.cumsum(main_seg_lens)])
        main_total_len = main_cum_lens[-1] or 1.0

        if len(valid_shortcuts) == 1:
            sc_dict, sc_pts_list = valid_shortcuts[0]
            st_idx, ed_idx = sc_dict['start'], sc_dict['end']
            y_start = dh_height * (1.0 - (main_cum_lens[st_idx] / main_total_len))
            y_end = dh_height * (1.0 - (main_cum_lens[ed_idx] / main_total_len))

            pts = np.array(sc_pts_list)
            world_xz = (pts - [cx, cy]) * scale
            segment_lens = np.linalg.norm(np.diff(world_xz, axis=0), axis=1)
            cum_lens = np.concatenate([[0], np.cumsum(segment_lens)])
            total_sc_len = cum_lens[-1] or 1.0

            lines = []
            for i in range(len(world_xz)):
                x, z = world_xz[i, 0], world_xz[i, 1]
                t_sc = cum_lens[i] / total_sc_len
                y = y_start + t_sc * (y_end - y_start)
                lines.append(f"                    new THREE.Vector3({x:.1f}, {y:.1f}, {z:.1f}),")
            return "\n".join(lines), False
        else:
            sc_blocks = []
            for sc_dict, sc_pts_list in valid_shortcuts:
                st_idx, ed_idx = sc_dict['start'], sc_dict['end']
                y_start = dh_height * (1.0 - (main_cum_lens[st_idx] / main_total_len))
                y_end = dh_height * (1.0 - (main_cum_lens[ed_idx] / main_total_len))

                pts = np.array(sc_pts_list)
                world_xz = (pts - [cx, cy]) * scale
                segment_lens = np.linalg.norm(np.diff(world_xz, axis=0), axis=1)
                cum_lens = np.concatenate([[0], np.cumsum(segment_lens)])
                total_sc_len = cum_lens[-1] or 1.0

                lines = ["                ["]
                for i in range(len(world_xz)):
                    x, z = world_xz[i, 0], world_xz[i, 1]
                    t_sc = cum_lens[i] / total_sc_len
                    y = y_start + t_sc * (y_end - y_start)
                    lines.append(f"                    new THREE.Vector3({x:.1f}, {y:.1f}, {z:.1f}),")
                lines.append("                ],")
                sc_blocks.append("\n".join(lines))
            return "\n".join(sc_blocks), True

    import json

    def generate_world_points_data(self):
        """計算主賽道的 3D 座標數值點位 (list of [x, y, z])"""
        if len(self.px_points) < 2:
            return []

        pts = np.array(self.px_points)
        target_len = parse_float_val(self.target_length_m.get(), 5000.0)
        dh_height = parse_float_val(self.downhill_height_m.get(), 200.0)

        raw_len = float(np.linalg.norm(np.diff(pts, axis=0), axis=1).sum())
        scale = float(target_len / raw_len) if raw_len > 0 else 1.0

        cx = (pts[:, 0].min() + pts[:, 0].max()) / 2.0
        cy = (pts[:, 1].min() + pts[:, 1].max()) / 2.0

        world_xz = (pts - [cx, cy]) * scale

        segment_lens = np.linalg.norm(np.diff(world_xz, axis=0), axis=1)
        cum_lens = np.concatenate([[0], np.cumsum(segment_lens)])
        total_world_len = cum_lens[-1]

        world_pts = []
        for i in range(len(world_xz)):
            x = round(float(world_xz[i, 0]), 1)
            z = round(float(world_xz[i, 1]), 1)
            progress = cum_lens[i] / total_world_len if total_world_len > 0 else 0
            y = round(float(dh_height * (1.0 - progress)), 1)
            world_pts.append([x, y, z])

        return world_pts

    def generate_alt_routes_data(self):
        """計算所有捷徑分支的 3D 座標點位與元資料 (list of dict)"""
        valid_shortcuts = []
        for idx, sc in enumerate(self.shortcuts):
            full_sc = self.get_shortcut_full_path(sc)
            if full_sc and len(full_sc) >= 2:
                valid_shortcuts.append((idx, sc, full_sc))

        if not valid_shortcuts or len(self.px_points) < 2:
            return []

        pts_main = np.array(self.px_points)
        target_len = self.target_length_m.get()
        dh_height = self.downhill_height_m.get()

        raw_len = np.linalg.norm(np.diff(pts_main, axis=0), axis=1).sum()
        scale = target_len / raw_len if raw_len > 0 else 1.0
        cx = (pts_main[:, 0].min() + pts_main[:, 0].max()) / 2.0
        cy = (pts_main[:, 1].min() + pts_main[:, 1].max()) / 2.0

        main_world = (pts_main - [cx, cy]) * scale
        main_seg_lens = np.linalg.norm(np.diff(main_world, axis=0), axis=1)
        main_cum_lens = np.concatenate([[0], np.cumsum(main_seg_lens)])
        main_total_len = main_cum_lens[-1] or 1.0

        alt_routes = []
        for sc_idx, sc_dict, sc_pts_list in valid_shortcuts:
            st_idx, ed_idx = sc_dict['start'], sc_dict['end']
            y_start = dh_height * (1.0 - (main_cum_lens[st_idx] / main_total_len))
            y_end = dh_height * (1.0 - (main_cum_lens[ed_idx] / main_total_len))

            pts = np.array(sc_pts_list)
            world_xz = (pts - [cx, cy]) * scale
            segment_lens = np.linalg.norm(np.diff(world_xz, axis=0), axis=1)
            cum_lens = np.concatenate([[0], np.cumsum(segment_lens)])
            total_sc_len = cum_lens[-1] or 1.0

            route_pts = []
            for i in range(len(world_xz)):
                x = round(float(world_xz[i, 0]), 1)
                z = round(float(world_xz[i, 1]), 1)
                t_sc = cum_lens[i] / total_sc_len
                y = round(float(y_start + t_sc * (y_end - y_start)), 1)
                route_pts.append([x, y, z])

            alt_routes.append({
                "id": f"shortcut_{sc_idx + 1}",
                "name": f"捷徑 #{sc_idx + 1}",
                "startIdx": int(st_idx) if st_idx is not None else None,
                "endIdx": int(ed_idx) if ed_idx is not None else None,
                "points": route_pts
            })

        return alt_routes

    def generate_track_json_obj(self):
        """構建完整新版 CyberRace 賽道 JSON 物件"""
        points = self.generate_world_points_data()
        if not points:
            return None

        key = self.selected_track_key.get().strip()
        if not key:
            messagebox.showwarning("警告", "請先輸入或選擇「賽道 ID」(例如: akagi, my_track)！")
            return None

        length_raw = self.target_length_m.get().strip()
        if not length_raw:
            messagebox.showwarning("警告", "請輸入「總長(m)」(例如: 5800)！")
            return None
        length_str = f"{length_raw}m" if not length_raw.endswith('m') else length_raw

        elev_raw = self.downhill_height_m.get().strip()
        if not elev_raw:
            ys = [p[1] for p in points if len(p) >= 2]
            elev_val = round(max(ys) - min(ys)) if ys else 200
            elev_str = f"{elev_val}m"
        else:
            elev_str = f"{elev_raw}m" if not elev_raw.endswith('m') else elev_raw

        diff_raw = self.difficulty_var.get().strip()
        if not diff_raw:
            messagebox.showwarning("警告", "請輸入「難度(1-5)」(例如: 3)！")
            return None
        try:
            difficulty = int(diff_raw)
        except ValueError:
            difficulty = 3

        track_name = self.track_name_zh.get().strip() or key
        track_name_en = self.track_name_en.get().strip() or key.capitalize()
        track_name_ja = self.track_name_ja.get().strip() or track_name

        N = len(self.px_points)
        is_circuit = (self.track_type.get() == "circuit")
        st_idx = int(self.start_index) if (self.start_index is not None and 0 <= self.start_index < N) else 0
        fn_idx = int(self.finish_index) if (self.finish_index is not None and 0 <= self.finish_index < N) else (0 if is_circuit else N - 1)
        cps = [int(cp) for cp in sorted(self.checkpoints) if 0 < cp < N - 1] if not is_circuit else []

        json_obj = {
            "id": str(key),
            "name": str(track_name),
            "nameEn": str(track_name_en),
            "nameJa": str(track_name_ja),
            "type": str(self.track_type.get()),
            "length": str(length_str),
            "difficulty": int(difficulty),
            "elev": str(elev_str),
            "trackWidth": 18,
            "startIndex": st_idx,
            "finishIndex": fn_idx,
            "checkpoints": cps,
            "points": points
        }

        alt_routes = self.generate_alt_routes_data()
        if alt_routes:
            json_obj["altRoutes"] = alt_routes

        return sanitize_for_json(json_obj)

    def save_track_json_file(self):
        """匯出標準 CyberRace 新版 .json 賽道檔案"""
        json_obj = self.generate_track_json_obj()
        if not json_obj:
            messagebox.showwarning("警告", "沒有足夠的點位可匯出！")
            return

        key = self.selected_track_key.get()
        file_path = filedialog.asksaveasfilename(defaultextension=".json", initialfile=f"{key}.json", filetypes=[("JSON 檔案", "*.json"), ("所有檔案", "*.*")])
        if file_path:
            import json
            json_str = json.dumps(json_obj, ensure_ascii=False, indent=2)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(json_str)
            messagebox.showinfo("匯出成功", f"🎉 成功匯出 CyberRace 新版賽道 JSON: {file_path}")

    def update_tracks_index(self, track_meta, index_json_path):
        """自動更新 data/tracks/tracks_index.json 檔案索引"""
        import json
        if not os.path.exists(index_json_path):
            return
        try:
            with open(index_json_path, 'r', encoding='utf-8') as f:
                index_data = json.load(f)

            found = False
            for entry in index_data:
                if entry.get('id') == track_meta['id']:
                    entry['name'] = track_meta.get('name', entry.get('name'))
                    entry['nameEn'] = track_meta.get('nameEn', entry.get('nameEn'))
                    entry['nameJa'] = track_meta.get('nameJa', entry.get('nameJa', entry['name']))
                    entry['type'] = track_meta.get('type', entry.get('type'))
                    entry['len'] = track_meta.get('length', entry.get('len'))
                    entry['difficulty'] = int(track_meta.get('difficulty', track_meta.get('stars', entry.get('difficulty', 3))))
                    entry['elev'] = track_meta.get('elev', entry.get('elev', '200m'))
                    if 'startIndex' in track_meta: entry['startIndex'] = track_meta['startIndex']
                    if 'finishIndex' in track_meta: entry['finishIndex'] = track_meta['finishIndex']
                    if 'checkpoints' in track_meta: entry['checkpoints'] = track_meta['checkpoints']
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
                    "difficulty": int(track_meta.get('difficulty', track_meta.get('stars', 3))),
                    "region": "日本",
                    "len": track_meta.get('length', '5,000m'),
                    "elev": track_meta.get('elev', '200m'),
                    "startIndex": track_meta.get('startIndex', 0),
                    "finishIndex": track_meta.get('finishIndex', 0),
                    "checkpoints": track_meta.get('checkpoints', [])
                })

            clean_index_data = sanitize_for_json(index_data)
            index_str = json.dumps(clean_index_data, ensure_ascii=False, indent=2)
            with open(index_json_path, 'w', encoding='utf-8') as f:
                f.write(index_str)
        except Exception as e:
            print(f"更新 tracks_index.json 警告: {e}")

    def save_points_file(self):
        js_code = self.generate_world_vector3_code()
        if not js_code:
            messagebox.showwarning("警告", "沒有足夠的點位可匯出！")
            return

        file_path = filedialog.asksaveasfilename(defaultextension=".txt", initialfile=f"{self.selected_track_key.get()}_points.txt", filetypes=[("文字檔", "*.txt"), ("所有檔案", "*.*")])
        if file_path:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(js_code)
            messagebox.showinfo("匯出成功", f"成功儲存至: {file_path}")


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--image', default=None)
    ap.add_argument('--points', default=None)
    args = ap.parse_args()

    root = tk.Tk()
    app = TrackGuiEditor(root, args.image, args.points)
    root.mainloop()

