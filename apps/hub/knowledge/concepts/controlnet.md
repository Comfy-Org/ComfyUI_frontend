# ControlNet

ControlNet guides image generation using structural conditions extracted from reference images — such as edge maps, depth information, or human poses. Instead of relying solely on text prompts for composition, ControlNet lets you specify the spatial layout precisely. This bridges the gap between text-to-image flexibility and the structural precision needed for professional workflows.

## How It Works in ComfyUI

- Key nodes involved: `ControlNetLoader`, `ControlNetApplyAdvanced`, preprocessor nodes (`CannyEdgePreprocessor`, `DepthAnythingPreprocessor`, `DWPosePreprocessor`, `LineartPreprocessor`)
- Typical workflow pattern: Load reference image → preprocess to extract condition (edges/depth/pose) → load ControlNet model → apply condition to sampling → generate image with structural guidance

## ControlNet Types

- **Canny**: Detects edges to preserve outlines and shapes
- **Depth**: Captures spatial depth for accurate foreground/background placement
- **OpenPose**: Extracts human body and hand poses for character positioning
- **Normal Map**: Encodes surface orientation for consistent lighting and geometry
- **Lineart**: Follows line drawings and illustrations as generation guides
- **Scribble**: Uses rough sketches as loose compositional guides

## Key Settings

- **Strength**: Controls how strongly the condition guides generation (0.0–1.0). Values of 0.5–1.0 are typical. Higher values enforce the structure more rigidly; lower values allow the model more creative freedom.
- **start_percent / end_percent**: Controls when the ControlNet activates during the sampling process. Starting at 0.0 and ending at 1.0 applies guidance throughout. Ending earlier (e.g., 0.8) lets the model refine fine details freely in final steps.

## Tips

- Always preprocess your input image with the appropriate preprocessor node before feeding it to ControlNet. Raw images will not produce correct conditioning.
- Combine multiple ControlNets for precise control — for example, Depth for spatial layout plus OpenPose for character positioning. Stack them by chaining `ControlNetApplyAdvanced` nodes.
- If your generation looks distorted or overcooked, lower the ControlNet strength. Values above 0.8 can fight with the text prompt and produce artifacts.
