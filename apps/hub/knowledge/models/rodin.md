# Rodin

Rodin is a 3D generation API by Hyper3D (DeemosTech) that creates production-ready 3D models from text or images with PBR materials.

## Model Variants

### Rodin Gen-2

- Most advanced model with 10 billion parameters
- Built on the BANG architecture
- 4x improved geometric mesh quality over Gen-1
- Generation time approximately 90 seconds

### Rodin Gen-1.5 Regular

- Detailed 3D assets with customizable quality
- Adjustable polygon counts and 2K textures
- Generation time approximately 70 seconds

### Rodin Sketch

- Fast prototyping with basic geometry and 1K textures
- GLB format only, generation in approximately 20 seconds

## Key Features

- Text-to-3D and image-to-3D generation
- Multi-view image input (up to 5 images) with fuse and concat modes
- PBR and Shaded material options
- Quad and triangle mesh modes
- HighPack add-on for 4K textures and high-poly models
- Bounding box ControlNet for dimension constraints
- T/A pose control for humanoid models

## Hardware Requirements

- Cloud API-based (no local GPU required)
- All generation runs on Hyper3D servers
- API key required via hyper3d.ai dashboard

## Common Use Cases

- Game asset production
- VR/AR content creation
- Product visualization
- Character modeling with pose control
- Rapid 3D prototyping

## Key Parameters

- **prompt**: Text description for text-to-3D mode
- **images**: Up to 5 reference images for image-to-3D
- **quality**: Detail level (high, medium, low, extra-low)
- **mesh_mode**: Face type (Quad or Raw triangles)
- **material**: Material type (PBR, Shaded, or All)
- **geometry_file_format**: Output format (glb, fbx, obj, stl, usdz)
- **seed**: Randomization seed (0-65535)
