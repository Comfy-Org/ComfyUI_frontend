# 3D Generation

3D generation creates three-dimensional models — meshes, point clouds, or multi-view images — from text or image inputs. This enables rapid prototyping of 3D assets without manual modeling. In ComfyUI, several approaches exist: image-to-3D (lifting a single photo into a mesh), text-to-3D (generating a 3D object from a description), and multi-view generation (producing consistent views of an object that can be reconstructed into 3D).

## How It Works in ComfyUI

- Key nodes involved: Model-specific loaders (`TripoSR`, `InstantMesh`, `StableZero123`), `LoadImage`, `Save3D` / `Preview3D`, `CRM` nodes
- Typical workflow pattern: Load image → Load 3D model → Run inference → Preview 3D result → Export mesh

## Key Settings

- **Inference steps**: Number of denoising/reconstruction steps. More steps generally improve quality but increase generation time.
- **Elevation angle**: Camera elevation for multi-view generation, controlling the vertical viewing angle of the generated views.
- **Guidance scale**: How closely the model follows the input image or text. Higher values increase fidelity to the input but may reduce diversity.
- **Output format**: Export format for the 3D mesh — OBJ, GLB, and PLY are common options, each suited to different downstream tools.

## Tips

- Clean single-object images on white or simple backgrounds work best for image-to-3D conversion.
- Multi-view approaches (like Zero123) often produce better geometry than single-view methods.
- Post-process generated meshes in Blender for cleanup, retopology, or texturing before production use.
- Start with TripoSR for quick results — it generates meshes in seconds and is a good baseline to compare against other methods.
