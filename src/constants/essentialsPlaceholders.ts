/**
 * Placeholder structure for the redesigned Essentials tab.
 *
 * Mirrors the Figma design exactly. Tiles are non-functional —
 * intended to validate layout, taxonomy, and icons before real
 * nodes/blueprints are wired up.
 */
import type { EssentialsMediaType } from '@/composables/useEssentialsFilters'

export interface EssentialPlaceholderTile {
  label: string
  icon?: string
  media?: EssentialsMediaType
  /**
   * Backing ComfyUI node identifier resolved by the hover popover.
   *   - For NODEs and PARTNER/API nodes: pass either the registered
   *     `name` (class key) OR the friendly `display_name`. The popover
   *     looks up `nodeDefsByName` first, then `nodeDefsByDisplayName`.
   *   - For BLUEPRINTs: pass `SubgraphBlueprint.<filename>` where
   *     `<filename>` is the bare blueprint JSON filename (no extension,
   *     no `local-` prefix), e.g. `Image Inpainting (Qwen-image)`.
   */
  nodeName?: string
}

export interface EssentialPlaceholderSubgroup {
  key: string
  label: string
  media: EssentialsMediaType
  tiles: EssentialPlaceholderTile[]
}

export interface EssentialPlaceholderSection {
  key: string
  label: string
  subgroups?: EssentialPlaceholderSubgroup[]
  tiles?: EssentialPlaceholderTile[]
}

const blueprint = (name: string) => `SubgraphBlueprint.${name}`

export const ESSENTIAL_PLACEHOLDER_SECTIONS: EssentialPlaceholderSection[] = [
  {
    key: 'inputs-outputs',
    label: 'Inputs & Outputs',
    tiles: [
      {
        label: 'Load Image',
        icon: 'icon-s1.5-[lucide--image-up]',
        media: 'image',
        nodeName: 'LoadImage'
      },
      {
        label: 'Save Image',
        icon: 'icon-s1.5-[lucide--image-down]',
        media: 'image',
        nodeName: 'SaveImage'
      },
      {
        label: 'Load Video',
        icon: 'icon-[comfy--load-video]',
        media: 'video',
        nodeName: 'LoadVideo'
      },
      {
        label: 'Save Video',
        icon: 'icon-[comfy--save-video]',
        media: 'video',
        nodeName: 'SaveVideo'
      },
      {
        label: 'Load 3D Model',
        icon: 'icon-[comfy--load-3d]',
        media: '3d',
        nodeName: 'Load3D'
      },
      {
        label: 'Save 3D Model',
        icon: 'icon-[comfy--save-3d]',
        media: '3d',
        nodeName: 'SaveGLB'
      },
      {
        label: 'Load Audio',
        icon: 'icon-[comfy--load-audio]',
        media: 'audio',
        nodeName: 'LoadAudio'
      },
      {
        label: 'Save Audio',
        icon: 'icon-[comfy--save-audio]',
        media: 'audio',
        nodeName: 'SaveAudio'
      },
      {
        label: 'Load LoRA',
        icon: 'icon-[comfy--lora-loader]',
        media: 'image',
        nodeName: 'LoraLoader'
      },
      {
        label: 'Input Text',
        icon: 'icon-s1.5-[lucide--text]',
        media: 'text',
        nodeName: 'PrimitiveStringMultiline'
      },
      {
        label: 'Preview Text',
        icon: 'icon-s1.5-[lucide--text]',
        media: 'text',
        nodeName: 'Preview as Text'
      }
    ]
  },
  {
    key: 'generate',
    label: 'Generate',
    subgroups: [
      {
        key: 'generate-image',
        label: 'Image',
        media: 'image',
        tiles: [
          {
            label: 'Nano Banana',
            icon: 'icon-[comfy--gemini]',
            nodeName: 'Nano Banana (Google Gemini Image)'
          },
          {
            label: 'Grok Image Edit',
            icon: 'icon-[comfy--grok] text-[#B6B6B6]',
            nodeName: 'Grok Image Edit'
          },
          {
            label: 'Bytedance Seedream',
            icon: 'icon-[comfy--bytedance]',
            nodeName: 'ByteDance Seedream 4.5 & 5.0'
          },
          {
            label: 'Text to Image',
            icon: 'icon-[comfy--text-to-image]',
            nodeName: blueprint('Text to Image (Z-Image-Turbo)')
          },
          {
            label: 'Edit Image',
            icon: 'icon-[comfy--image-edit]',
            nodeName: blueprint('Image Edit (Qwen 2511)')
          },
          {
            label: 'Inpaint Image',
            icon: 'icon-[comfy--image-inpaint]',
            nodeName: blueprint('Image Inpainting (Qwen-image)')
          },
          {
            label: 'Outpaint Image',
            icon: 'icon-[comfy--image-outpaint]',
            nodeName: blueprint('Image Outpainting (Qwen-Image)')
          },
          {
            label: 'Image to Layers',
            icon: 'icon-[comfy--image-to-layers]',
            nodeName: blueprint('Image to Layers(Qwen-Image-Layered)')
          },
          {
            label: 'Vectorize',
            icon: 'icon-[comfy--image-vectorize]',
            nodeName: 'Recraft Vectorize Image'
          },
          {
            label: 'Pose to Image',
            icon: 'icon-[comfy--pose-to-image]',
            nodeName: blueprint('Pose to Image (Z-Image-Turbo)')
          },
          {
            label: 'Canny to Image',
            icon: 'icon-[comfy--canny-to-image]',
            nodeName: blueprint('Canny to Image (Z-Image-Turbo)')
          },
          {
            label: 'Depth to Image',
            icon: 'icon-[comfy--depth-to-image]',
            nodeName: blueprint('Depth to Image (Z-Image-Turbo)')
          }
        ]
      },
      {
        key: 'generate-video',
        label: 'Video',
        media: 'video',
        tiles: [
          {
            label: 'Grok Video',
            icon: 'icon-[comfy--grok] text-[#B6B6B6]',
            nodeName: 'Grok Video'
          },
          {
            label: 'Kling Video',
            icon: 'icon-[comfy--kling]',
            nodeName: 'Kling Image(First Frame) to Video'
          },
          {
            label: 'Bytedance Seedance',
            icon: 'icon-[comfy--bytedance]',
            nodeName: 'ByteDance Seedance 2.0 Reference to Video'
          },
          {
            label: 'Text to Video',
            icon: 'icon-[comfy--text-to-video]',
            nodeName: blueprint('Text to Video (Wan 2.2)')
          },
          {
            label: 'Image to Video',
            icon: 'icon-[comfy--image-to-video]',
            nodeName: blueprint('Image to Video (Wan 2.2)')
          },
          {
            label: 'First-Last Frame Video',
            icon: 'icon-[comfy--image-to-video]',
            nodeName: blueprint('First-Last-Frame to Video')
          },
          {
            label: 'Edit Video',
            icon: 'icon-[comfy--video-edit]',
            nodeName: 'Kling 3.0 Omni Edit Video'
          },
          {
            label: 'Lipsync Video',
            icon: 'icon-s1.5-[lucide--mic-vocal]',
            nodeName: 'Kling Lip Sync Video with Audio'
          },
          {
            label: 'Inpaint Video',
            icon: 'icon-[comfy--video-inpaint]',
            nodeName: blueprint('Video Inpaint(Wan2.1 VACE)')
          },
          {
            label: 'Pose to Video',
            icon: 'icon-[comfy--pose-to-video]',
            nodeName: blueprint('Pose to Video (LTX 2.0)')
          },
          {
            label: 'Canny to Video',
            icon: 'icon-[comfy--canny-to-video]',
            nodeName: blueprint('Canny to Video (LTX 2.0)')
          },
          {
            label: 'Depth to Video',
            icon: 'icon-[comfy--depth-to-video]',
            nodeName: blueprint('Depth to Video (ltx 2.0)')
          }
        ]
      },
      {
        key: 'generate-text',
        label: 'Text',
        media: 'text',
        tiles: [
          {
            label: 'Google Gemini',
            icon: 'icon-[comfy--gemini]',
            nodeName: 'Google Gemini'
          },
          {
            label: 'Anthropic Claude',
            // FIXME: Don't hard code color here
            icon: 'icon-[comfy--claude] text-[#D97757]',
            nodeName: 'Anthropic Claude'
          },
          {
            label: 'Text Enhancer',
            icon: 'icon-[comfy--text-prompt-enhance]',
            nodeName: blueprint('Prompt Enhance')
          },
          {
            label: 'Image Captioner',
            icon: 'icon-[comfy--image-captioning]',
            nodeName: blueprint('Image Captioning (gemini)')
          },
          {
            label: 'Video Captioner',
            icon: 'icon-[comfy--video-captioning]',
            nodeName: blueprint('Video Captioning (Gemini)')
          }
        ]
      },
      {
        key: 'generate-audio',
        label: 'Audio',
        media: 'audio',
        tiles: [
          {
            label: 'Text to Audio',
            icon: 'icon-[comfy--text-to-audio]',
            nodeName: blueprint('Text to Audio (ACE-Step 1.5)')
          },
          {
            label: 'Text to Speech',
            icon: 'icon-s1.5-[lucide--speech]',
            nodeName: 'ElevenLabs Text to Speech'
          },
          {
            label: 'Voice Clone',
            icon: 'icon-[comfy--voice-clone]',
            nodeName: 'ElevenLabs Instant Voice Clone'
          }
        ]
      },
      {
        key: 'generate-3d',
        label: '3D',
        media: '3d',
        tiles: [
          {
            label: 'Text to Model',
            icon: 'icon-[comfy--text-to-3d]',
            nodeName: 'Hunyuan3D: Text to Model'
          },
          {
            label: 'Image to Model',
            icon: 'icon-[comfy--image-to-3d]',
            nodeName: blueprint('Image to Model (Hunyuan3d 2.1)')
          }
        ]
      }
    ]
  },
  {
    key: 'control-guidance',
    label: 'Control & Guidance',
    subgroups: [
      {
        key: 'control-image',
        label: 'Image',
        media: 'image',
        tiles: [
          {
            label: 'Extract Canny Edge',
            icon: 'icon-[comfy--image-canny]',
            nodeName: 'Canny'
          }
        ]
      }
    ]
  },
  {
    key: 'editing-utilities',
    label: 'Editing & Utilities',
    subgroups: [
      {
        key: 'image-transform',
        label: 'Image Transform',
        media: 'image',
        tiles: [
          {
            label: 'Crop Image',
            icon: 'icon-s1.5-[lucide--crop]',
            nodeName: 'ImageCropV2'
          },
          {
            label: 'Crop Image 2x2',
            icon: 'icon-s1.5-[lucide--crop]',
            nodeName: blueprint('Crop Images 2x2')
          },
          {
            label: 'Crop Image 3x3',
            icon: 'icon-s1.5-[lucide--crop]',
            nodeName: blueprint('Crop Images 3x3')
          },
          {
            label: 'Resize Image',
            icon: 'icon-[comfy--image-upscale]',
            nodeName: 'ImageScale'
          },
          {
            label: 'Upscale Image',
            icon: 'icon-[comfy--image-upscale]',
            nodeName: blueprint('Image Upscale(Z-image-Turbo)')
          },
          {
            label: 'Rotate Image',
            icon: 'icon-[comfy--image-rotate]',
            nodeName: 'ImageRotate'
          },
          {
            label: 'Image Collage',
            icon: 'icon-[comfy--image-collage]',
            nodeName: 'ImageStitch'
          }
        ]
      },
      {
        key: 'image-utilities',
        label: 'Image Utilities',
        media: 'image',
        tiles: [
          {
            label: 'Batch Image',
            icon: 'icon-[comfy--image-batch]',
            nodeName: 'BatchImagesNode'
          },
          {
            label: 'Compare Image',
            icon: 'icon-[comfy--image-compare]',
            nodeName: 'ImageCompare'
          },
          {
            label: 'Image Frames to Video',
            icon: 'icon-[comfy--frames-to-video]',
            nodeName: 'Create Video'
          }
        ]
      },
      {
        key: 'image-filters-effects',
        label: 'Image Filters & Effects',
        media: 'image',
        tiles: [
          {
            label: 'Invert Image',
            icon: 'icon-[comfy--image-invert]',
            nodeName: 'ImageInvert'
          },
          {
            label: 'Chromatic Aberration',
            icon: 'icon-[comfy--chromatic-aberration]',
            nodeName: blueprint('Chromatic Aberration')
          },
          {
            label: 'Film Grain',
            icon: 'icon-[comfy--grain]',
            nodeName: blueprint('Film Grain')
          },
          {
            label: 'Glow',
            icon: 'icon-[comfy--glow]',
            nodeName: blueprint('Glow')
          },
          {
            label: 'Sharpen Image',
            icon: 'icon-[comfy--image-sharpen]',
            nodeName: blueprint('Sharpen')
          },
          {
            label: 'Blur Image',
            icon: 'icon-[comfy--image-blur]',
            nodeName: blueprint('Image Blur')
          },
          {
            label: 'Shader',
            icon: 'icon-[comfy--image-shader]',
            nodeName: 'GLSL Shader'
          }
        ]
      },
      {
        key: 'image-color',
        label: 'Image Color',
        media: 'image',
        tiles: [
          {
            label: 'Brightness & Contrast',
            icon: 'icon-[comfy--brightness-contrast]',
            nodeName: blueprint('Brightness and Contrast')
          },
          {
            label: 'Hue & Saturation',
            icon: 'icon-[comfy--dial]',
            nodeName: blueprint('Hue and Saturation')
          },
          {
            label: 'Color Balance',
            icon: 'icon-s1.5-[lucide--sliders-horizontal]',
            nodeName: blueprint('Color Balance')
          },
          {
            label: 'Color Curves',
            icon: 'icon-s1.5-[lucide--chart-spline]',
            nodeName: blueprint('Color Curves')
          },
          {
            label: 'Levels',
            icon: 'icon-s1.5-[lucide--sliders-horizontal]',
            nodeName: blueprint('Image Levels')
          },
          {
            label: 'Channels',
            icon: 'icon-[comfy--channels]',
            nodeName: blueprint('Image Channels')
          },
          {
            label: 'Color Adjust',
            icon: 'icon-s1.5-[lucide--sliders-horizontal]',
            nodeName: blueprint('Color Adjustment')
          }
        ]
      },
      {
        key: 'image-selection-masking',
        label: 'Image Selection & Masking',
        media: 'image',
        tiles: [
          {
            label: 'Select Image Object',
            icon: 'icon-[comfy--image-select-object-segmentation]',
            nodeName: blueprint('Image Segmentation (SAM3)')
          },
          {
            label: 'Remove Background',
            icon: 'icon-[comfy--image-remove-background]',
            nodeName: 'Recraft Remove Background'
          }
        ]
      },
      {
        key: 'video-transform',
        label: 'Video Transform',
        media: 'video',
        tiles: [
          {
            label: 'Trim Video',
            icon: 'icon-[comfy--video-trim]',
            nodeName: 'Video Slice'
          },
          {
            label: 'Upscale Video',
            icon: 'icon-[comfy--video-upscale]',
            nodeName: 'Topaz Video Enhance'
          }
        ]
      },
      {
        key: 'video-compose',
        label: 'Video Compose',
        media: 'video',
        tiles: [
          {
            label: 'Split-Screen',
            icon: 'icon-[comfy--video-split-screen]',
            nodeName: blueprint('Video Stitch')
          },
          {
            label: 'Extract Frame',
            icon: 'icon-[comfy--video-extract-frame]',
            nodeName: blueprint('Get Any Video Frame')
          },
          {
            label: 'Frame Interpolation',
            icon: 'icon-[comfy--video-interpolation]',
            nodeName: blueprint('Frame Interpolation')
          }
        ]
      },
      {
        key: 'video-selection-masking',
        label: 'Video Selection & Masking',
        media: 'video',
        tiles: [
          {
            label: 'Select Video Object',
            icon: 'icon-[comfy--video-select-object-segmentation]',
            nodeName: blueprint('Video Segmentation (SAM3)')
          }
        ]
      },
      {
        key: '3d-transform',
        label: '3D Transform',
        media: '3d',
        tiles: [
          {
            label: 'UV Unwrapping',
            icon: 'icon-s1.5-[lucide--package-open]',
            nodeName: 'Hunyuan3D: Model to UV'
          },
          {
            label: 'Decompose 3D Model',
            icon: 'icon-[comfy--3d-decomp]',
            nodeName: 'Hunyuan3D: 3D Part'
          }
        ]
      }
    ]
  }
]
