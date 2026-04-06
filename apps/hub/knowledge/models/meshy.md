# Meshy

Meshy is a popular AI 3D model generator enabling text-to-3D and image-to-3D creation with PBR textures and production-ready exports.

## Model Variants

### Meshy-6

- Latest generation with highest quality geometry
- Supports symmetry and pose control (A-pose, T-pose)
- Configurable polygon counts up to 300,000

### Meshy-5

- Previous generation with art style support
- Realistic and sculpture style options

## Key Features

- Text-to-3D with two-stage workflow (preview mesh, then refine textures)
- Image-to-3D from photos, sketches, or illustrations
- Multi-image input for multi-view reconstruction
- AI texturing with PBR maps (diffuse, roughness, metallic, normal)
- Automatic rigging and 500+ animation motion library
- Smart remesh with quad or triangle topology control
- Export in FBX, GLB, OBJ, STL, 3MF, USDZ, BLEND formats

## Hardware Requirements

- Cloud API-based (no local GPU required)
- All generation runs on Meshy servers
- API available on Pro tier and above

## Common Use Cases

- Game development asset creation
- 3D printing and prototyping
- Film and VFX previsualization
- VR/AR content development
- Product design and e-commerce

## Key Parameters

- **prompt**: Text description up to 600 characters
- **ai_model**: Model version (meshy-5, meshy-6, latest)
- **topology**: Mesh type (quad or triangle)
- **target_polycount**: 100 to 300,000 polygons
- **enable_pbr**: Generate PBR material maps
- **pose_mode**: Character pose (a-pose, t-pose, or none)
