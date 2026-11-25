# Exports a .blend file as a .glb for the 3D works gallery (assets/models/<id>/model.glb).
#   blender -b <file.blend> --python tools/blend-to-glb.py -- <out.glb> [--max-texture 4096] [--quality 90] [--all]
# What it does, without touching the .blend (nothing is saved):
#   · textures larger than --max-texture are scaled down first (an 8K map is ~4× the download of a 4K one and
#     a browser cannot show the difference at the size the viewer draws it)
#   · textures are written as WebP (EXT_texture_webp, which the viewer reads)
#   · only what is visible in the viewport is exported, unless --all
#   · meshes, materials, armatures, shape keys and animations go along; cameras and lights stay behind (the viewer
#     lights every model itself)
#   · no Draco or meshopt compression: the viewer carries no decoder for them
import bpy, sys, os

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if not argv:
    raise SystemExit('usage: blender -b file.blend --python tools/blend-to-glb.py -- out.glb [--max-texture 4096] [--quality 90] [--all]')
out = os.path.abspath(argv[0])
opt = lambda name, default: type(default)(argv[argv.index(name) + 1]) if name in argv else default
max_tex, quality, everything = opt('--max-texture', 4096), opt('--quality', 90), '--all' in argv

for img in bpy.data.images:
    w, h = img.size[:]
    if img.source in {'FILE', 'GENERATED'} and max(w, h) > max_tex:
        k = max_tex / max(w, h)
        img.scale(max(1, round(w * k)), max(1, round(h * k)))
        print(f'texture {img.name}: {w}×{h} → {img.size[0]}×{img.size[1]}')

wanted = dict(
    filepath=out, export_format='GLB', use_visible=not everything,
    export_image_format='WEBP', export_image_quality=quality,
    export_animations=True, export_skins=True, export_morph=True, export_yup=True,
    export_cameras=False, export_lights=False, export_draco_mesh_compression_enable=False,
)
# option names move between Blender versions: pass only the ones this version knows
known = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
bpy.ops.export_scene.gltf(**{k: v for k, v in wanted.items() if k in known})
print(f'wrote {out} ({os.path.getsize(out) / 1048576:.1f} MB)')
