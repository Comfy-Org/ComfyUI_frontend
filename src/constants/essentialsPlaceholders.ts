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
  iconUrl?: string
  /**
   * When true, render `iconUrl` as a CSS mask tinted with the foreground
   * semantic token instead of an `<img>`. Use for monochrome brand marks
   * (e.g. Grok) that ship with `fill="currentColor"` and need to follow
   * the active theme.
   */
  tintable?: boolean
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

const comfyIcon = (name: string) => `icon-[comfy--${name}]`
const lucideIcon = (name: string) => `icon-s1.5-[lucide--${name}]`
const blueprint = (name: string) => `SubgraphBlueprint.${name}`

export const ESSENTIAL_PLACEHOLDER_SECTIONS: EssentialPlaceholderSection[] = [
  {
    key: 'inputs-outputs',
    label: 'Inputs & Outputs',
    tiles: [
      {
        label: 'Load Image',
        icon: lucideIcon('image-up'),
        media: 'image',
        nodeName: 'LoadImage'
      },
      {
        label: 'Save Image',
        icon: lucideIcon('image-down'),
        media: 'image',
        nodeName: 'SaveImage'
      },
      {
        label: 'Load Video',
        icon: comfyIcon('load-video'),
        media: 'video',
        nodeName: 'LoadVideo'
      },
      {
        label: 'Save Video',
        icon: comfyIcon('save-video'),
        media: 'video',
        nodeName: 'SaveVideo'
      },
      {
        label: 'Load 3D Model',
        icon: comfyIcon('load-3d'),
        media: '3d',
        nodeName: 'Load3D'
      },
      {
        label: 'Save 3D Model',
        icon: comfyIcon('save-3d'),
        media: '3d',
        nodeName: 'SaveGLB'
      },
      {
        label: 'Load Audio',
        icon: comfyIcon('load-audio'),
        media: 'audio',
        nodeName: 'LoadAudio'
      },
      {
        label: 'Save Audio',
        icon: comfyIcon('save-audio'),
        media: 'audio',
        nodeName: 'SaveAudio'
      },
      {
        label: 'Load LoRA',
        icon: comfyIcon('lora-loader'),
        media: 'image',
        nodeName: 'LoraLoader'
      },
      {
        label: 'Input Text',
        icon: lucideIcon('text'),
        media: 'text',
        nodeName: 'PrimitiveStringMultiline'
      },
      {
        label: 'Preview Text',
        icon: lucideIcon('text'),
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
            iconUrl: '/assets/images/brand-logos/gemini-color.svg',
            nodeName: 'Nano Banana (Google Gemini Image)'
          },
          {
            label: 'Grok Image Edit',
            iconUrl: '/assets/images/brand-logos/grok.svg',
            tintable: true,
            nodeName: 'Grok Image Edit'
          },
          {
            label: 'Bytedance Seedream',
            iconUrl: '/assets/images/brand-logos/bytedance-color.svg',
            nodeName: 'ByteDance Seedream 4.5 & 5.0'
          },
          {
            label: 'Text to Image',
            icon: comfyIcon('text-to-image'),
            nodeName: blueprint('Text to Image (Z-Image-Turbo)')
          },
          {
            label: 'Edit Image',
            icon: comfyIcon('image-edit'),
            nodeName: blueprint('Image Edit (Qwen 2511)')
          },
          {
            label: 'Inpaint Image',
            icon: comfyIcon('image-inpaint'),
            nodeName: blueprint('Image Inpainting (Qwen-image)')
          },
          {
            label: 'Outpaint Image',
            icon: comfyIcon('image-outpaint'),
            nodeName: blueprint('Image Outpainting (Qwen-Image)')
          },
          {
            label: 'Image to Layers',
            icon: comfyIcon('image-to-layers'),
            nodeName: blueprint('Image to Layers(Qwen-Image-Layered)')
          },
          {
            label: 'Vectorize',
            icon: comfyIcon('image-vectorize'),
            nodeName: 'Recraft Vectorize Image'
          },
          {
            label: 'Pose to Image',
            icon: comfyIcon('pose-to-image'),
            nodeName: blueprint('Pose to Image (Z-Image-Turbo)')
          },
          {
            label: 'Canny to Image',
            icon: comfyIcon('canny-to-image'),
            nodeName: blueprint('Canny to Image (Z-Image-Turbo)')
          },
          {
            label: 'Depth to Image',
            icon: comfyIcon('depth-to-image'),
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
            iconUrl: '/assets/images/brand-logos/grok.svg',
            tintable: true,
            nodeName: 'Grok Video'
          },
          {
            label: 'Kling Video',
            iconUrl: '/assets/images/brand-logos/kling-color.svg',
            nodeName: 'Kling Image(First Frame) to Video'
          },
          {
            label: 'Bytedance Seedance',
            iconUrl: '/assets/images/brand-logos/bytedance-color.svg',
            nodeName: 'ByteDance Seedance 2.0 Reference to Video'
          },
          {
            label: 'Text to Video',
            icon: comfyIcon('text-to-video'),
            nodeName: blueprint('Text to Video (Wan 2.2)')
          },
          {
            label: 'Image to Video',
            icon: comfyIcon('image-to-video'),
            nodeName: blueprint('Image to Video (Wan 2.2)')
          },
          {
            label: 'First-Last Frame Video',
            icon: comfyIcon('image-to-video'),
            nodeName: blueprint('First-Last-Frame to Video')
          },
          {
            label: 'Edit Video',
            icon: comfyIcon('video-edit'),
            nodeName: 'Kling 3.0 Omni Edit Video'
          },
          {
            label: 'Lipsync Video',
            icon: lucideIcon('mic-vocal'),
            nodeName: 'Kling Lip Sync Video with Audio'
          },
          {
            label: 'Inpaint Video',
            icon: comfyIcon('video-inpaint'),
            nodeName: blueprint('Video Inpaint(Wan2.1 VACE)')
          },
          {
            label: 'Pose to Video',
            icon: comfyIcon('pose-to-video'),
            nodeName: blueprint('Pose to Video (LTX 2.0)')
          },
          {
            label: 'Canny to Video',
            icon: comfyIcon('canny-to-video'),
            nodeName: blueprint('Canny to Video (LTX 2.0)')
          },
          {
            label: 'Depth to Video',
            icon: comfyIcon('depth-to-video'),
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
            iconUrl: '/assets/images/brand-logos/gemini-color.svg',
            nodeName: 'Google Gemini'
          },
          {
            label: 'Anthropic Claude',
            iconUrl: '/assets/images/brand-logos/claude-color.svg',
            nodeName: 'Anthropic Claude'
          },
          {
            label: 'Text Enhancer',
            icon: comfyIcon('text-prompt-enhance'),
            nodeName: blueprint('Prompt Enhance')
          },
          {
            label: 'Image Captioner',
            icon: comfyIcon('image-captioning'),
            nodeName: blueprint('Image Captioning (gemini)')
          },
          {
            label: 'Video Captioner',
            icon: comfyIcon('video-captioning'),
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
            icon: comfyIcon('text-to-audio'),
            nodeName: blueprint('Text to Audio (ACE-Step 1.5)')
          },
          {
            label: 'Text to Speech',
            icon: lucideIcon('speech'),
            nodeName: 'ElevenLabs Text to Speech'
          },
          {
            label: 'Voice Clone',
            icon: comfyIcon('voice-clone'),
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
            icon: comfyIcon('text-to-3d'),
            nodeName: 'Hunyuan3D: Text to Model'
          },
          {
            label: 'Image to Model',
            icon: comfyIcon('image-to-3d'),
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
            icon: comfyIcon('image-canny'),
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
            icon: lucideIcon('crop'),
            nodeName: 'ImageCropV2'
          },
          {
            label: 'Crop Image 2x2',
            icon: lucideIcon('crop'),
            nodeName: blueprint('Crop Images 2x2')
          },
          {
            label: 'Crop Image 3x3',
            icon: lucideIcon('crop'),
            nodeName: blueprint('Crop Images 3x3')
          },
          {
            label: 'Resize Image',
            icon: comfyIcon('image-upscale'),
            nodeName: 'ImageScale'
          },
          {
            label: 'Upscale Image',
            icon: comfyIcon('image-upscale'),
            nodeName: blueprint('Image Upscale(Z-image-Turbo)')
          },
          {
            label: 'Rotate Image',
            icon: comfyIcon('image-rotate'),
            nodeName: 'ImageRotate'
          },
          {
            label: 'Image Collage',
            icon: comfyIcon('image-collage'),
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
            icon: comfyIcon('image-batch'),
            nodeName: 'BatchImagesNode'
          },
          {
            label: 'Compare Image',
            icon: comfyIcon('image-compare'),
            nodeName: 'ImageCompare'
          },
          {
            label: 'Image Frames to Video',
            icon: comfyIcon('frames-to-video'),
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
            icon: comfyIcon('image-invert'),
            nodeName: 'ImageInvert'
          },
          {
            label: 'Chromatic Aberration',
            icon: comfyIcon('chromatic-aberration'),
            nodeName: blueprint('Chromatic Aberration')
          },
          {
            label: 'Film Grain',
            icon: comfyIcon('grain'),
            nodeName: blueprint('Film Grain')
          },
          {
            label: 'Glow',
            icon: comfyIcon('glow'),
            nodeName: blueprint('Glow')
          },
          {
            label: 'Sharpen Image',
            icon: comfyIcon('image-sharpen'),
            nodeName: blueprint('Sharpen')
          },
          {
            label: 'Blur Image',
            icon: comfyIcon('image-blur'),
            nodeName: blueprint('Image Blur')
          },
          {
            label: 'Shader',
            icon: comfyIcon('image-shader'),
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
            icon: comfyIcon('brightness-contrast'),
            nodeName: blueprint('Brightness and Contrast')
          },
          {
            label: 'Hue & Saturation',
            icon: comfyIcon('dial'),
            nodeName: blueprint('Hue and Saturation')
          },
          {
            label: 'Color Balance',
            icon: lucideIcon('sliders-horizontal'),
            nodeName: blueprint('Color Balance')
          },
          {
            label: 'Color Curves',
            icon: lucideIcon('chart-spline'),
            nodeName: blueprint('Color Curves')
          },
          {
            label: 'Levels',
            icon: lucideIcon('sliders-horizontal'),
            nodeName: blueprint('Image Levels')
          },
          {
            label: 'Channels',
            icon: comfyIcon('channels'),
            nodeName: blueprint('Image Channels')
          },
          {
            label: 'Color Adjust',
            icon: lucideIcon('sliders-horizontal'),
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
            icon: comfyIcon('image-select-object-segmentation'),
            nodeName: blueprint('Image Segmentation (SAM3)')
          },
          {
            label: 'Remove Background',
            icon: comfyIcon('image-remove-background'),
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
            icon: comfyIcon('video-trim'),
            nodeName: 'Video Slice'
          },
          {
            label: 'Upscale Video',
            icon: comfyIcon('video-upscale'),
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
            icon: comfyIcon('video-split-screen'),
            nodeName: blueprint('Video Stitch')
          },
          {
            label: 'Extract Frame',
            icon: comfyIcon('video-extract-frame'),
            nodeName: blueprint('Get Any Video Frame')
          },
          {
            label: 'Frame Interpolation',
            icon: comfyIcon('video-interpolation'),
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
            icon: comfyIcon('video-select-object-segmentation'),
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
            icon: lucideIcon('package-open'),
            nodeName: 'Hunyuan3D: Model to UV'
          },
          {
            label: 'Decompose 3D Model',
            icon: comfyIcon('3d-decomp'),
            nodeName: 'Hunyuan3D: 3D Part'
          }
        ]
      }
    ]
  }
]
