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
   * The backing ComfyUI node name (matches `nodeDef.name` in the store).
   * Used to render the real `NodePreviewCard` on hover.
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
        label: 'Input Text',
        icon: lucideIcon('text'),
        media: 'text',
        nodeName: 'PrimitiveStringMultiline'
      },
      { label: 'Preview Text', icon: lucideIcon('text'), media: 'text' }
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
            iconUrl: '/assets/images/brand-logos/gemini-color.svg'
          },
          {
            label: 'Grok Image Edit',
            iconUrl: '/assets/images/brand-logos/grok.svg',
            tintable: true
          },
          {
            label: 'Bytedance Seedream',
            iconUrl: '/assets/images/brand-logos/bytedance-color.svg'
          },
          { label: 'Text to Image', icon: comfyIcon('text-to-image') },
          { label: 'Edit Image', icon: comfyIcon('image-edit') },
          { label: 'Inpaint Image', icon: comfyIcon('image-inpaint') },
          { label: 'Outpaint Image', icon: comfyIcon('image-outpaint') },
          { label: 'Image to Layers', icon: comfyIcon('image-to-layers') },
          { label: 'Vectorize', icon: comfyIcon('image-vectorize') },
          { label: 'Pose to Image', icon: comfyIcon('pose-to-image') },
          { label: 'Canny to Image', icon: comfyIcon('canny-to-image') },
          { label: 'Depth to Image', icon: comfyIcon('depth-to-image') }
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
            tintable: true
          },
          {
            label: 'Kling Video',
            iconUrl: '/assets/images/brand-logos/kling-color.svg'
          },
          {
            label: 'Bytedance Seedance',
            iconUrl: '/assets/images/brand-logos/bytedance-color.svg'
          },
          { label: 'Text to Video', icon: comfyIcon('text-to-video') },
          { label: 'Image to Video', icon: comfyIcon('image-to-video') },
          {
            label: 'First-Last Frame Video',
            icon: comfyIcon('image-to-video')
          },
          { label: 'Edit Video', icon: comfyIcon('video-edit') },
          {
            label: 'Lipsync Video',
            icon: lucideIcon('mic-vocal'),
            nodeName: 'KlingLipSyncAudioToVideoNode'
          },
          { label: 'Inpaint Video', icon: comfyIcon('video-inpaint') },
          { label: 'Pose to Video', icon: comfyIcon('pose-to-video') },
          { label: 'Canny to Video', icon: comfyIcon('canny-to-video') },
          { label: 'Depth to Video', icon: comfyIcon('depth-to-video') }
        ]
      },
      {
        key: 'generate-text',
        label: 'Text',
        media: 'text',
        tiles: [
          {
            label: 'Google Gemini',
            iconUrl: '/assets/images/brand-logos/gemini-color.svg'
          },
          {
            label: 'Anthropic Claude',
            iconUrl: '/assets/images/brand-logos/claude-color.svg'
          },
          { label: 'Text Enhancer', icon: comfyIcon('text-prompt-enhance') },
          { label: 'Image Captioner', icon: comfyIcon('image-captioning') },
          { label: 'Video Captioner', icon: comfyIcon('video-captioning') }
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
            nodeName: 'StabilityTextToAudio'
          },
          { label: 'Text to Speech', icon: lucideIcon('speech') },
          { label: 'Voice Clone', icon: comfyIcon('voice-clone') }
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
            nodeName: 'TencentTextToModelNode'
          },
          {
            label: 'Image to Model',
            icon: comfyIcon('image-to-3d'),
            nodeName: 'TencentImageToModelNode'
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
          { label: 'Extract Pose', icon: comfyIcon('image-pose') },
          {
            label: 'Extract Canny Edge',
            icon: comfyIcon('image-canny'),
            nodeName: 'Canny'
          },
          { label: 'Extract Depth Map', icon: comfyIcon('image-depth') },
          { label: 'Extract Normal Map', icon: comfyIcon('image-normal-map') }
        ]
      },
      {
        key: 'control-video',
        label: 'Video',
        media: 'video',
        tiles: [
          { label: 'Extract Pose', icon: comfyIcon('image-pose') },
          { label: 'Extract Canny Edge', icon: comfyIcon('video-canny') },
          { label: 'Extract Depth Map', icon: comfyIcon('video-depth') },
          { label: 'Extract Normal Map', icon: comfyIcon('video-normal-map') }
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
            nodeName: 'ImageCrop'
          },
          { label: 'Crop Image 2x2', icon: lucideIcon('crop') },
          { label: 'Crop Image 3x3', icon: lucideIcon('crop') },
          {
            label: 'Resize Image',
            icon: comfyIcon('image-upscale'),
            nodeName: 'ImageScale'
          },
          { label: 'Upscale Image', icon: comfyIcon('image-upscale') },
          {
            label: 'Rotate Image',
            icon: comfyIcon('image-rotate'),
            nodeName: 'ImageRotate'
          },
          { label: 'Image Collage', icon: comfyIcon('image-collage') }
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
            nodeName: 'ImageBatch'
          },
          { label: 'Compare Image', icon: comfyIcon('image-compare') },
          {
            label: 'Image Frames to Video',
            icon: comfyIcon('frames-to-video')
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
            icon: comfyIcon('chromatic-aberration')
          },
          { label: 'Film Grain', icon: comfyIcon('grain') },
          { label: 'Glow', icon: comfyIcon('glow') },
          { label: 'Sharpen Image', icon: comfyIcon('image-sharpen') },
          {
            label: 'Blur Image',
            icon: comfyIcon('image-blur'),
            nodeName: 'ImageBlur'
          },
          { label: 'Shader', icon: comfyIcon('image-shader') }
        ]
      },
      {
        key: 'image-color',
        label: 'Image Color',
        media: 'image',
        tiles: [
          {
            label: 'Brightness & Contrast',
            icon: comfyIcon('brightness-contrast')
          },
          { label: 'Hue & Saturation', icon: comfyIcon('dial') },
          { label: 'Color Balance', icon: lucideIcon('sliders-horizontal') },
          { label: 'Color Curves', icon: lucideIcon('chart-spline') },
          { label: 'Levels', icon: lucideIcon('sliders-horizontal') },
          { label: 'Channels', icon: comfyIcon('channels') },
          { label: 'Color Adjust', icon: lucideIcon('sliders-horizontal') }
        ]
      },
      {
        key: 'image-selection-masking',
        label: 'Image Selection & Masking',
        media: 'image',
        tiles: [
          {
            label: 'Select Image Object',
            icon: comfyIcon('image-select-object-segmentation')
          },
          {
            label: 'Remove Background',
            icon: comfyIcon('image-remove-background'),
            nodeName: 'RecraftRemoveBackgroundNode'
          }
        ]
      },
      {
        key: 'video-transform',
        label: 'Video Transform',
        media: 'video',
        tiles: [{ label: 'Upscale Video', icon: comfyIcon('video-upscale') }]
      },
      {
        key: 'video-compose',
        label: 'Video Compose',
        media: 'video',
        tiles: [
          { label: 'Merge Videos', icon: comfyIcon('video-stitch') },
          { label: 'Split-Screen', icon: comfyIcon('video-split-screen') },
          {
            label: 'Extract Frame',
            icon: comfyIcon('video-extract-frame'),
            nodeName: 'VideoSlice'
          },
          {
            label: 'Frame Interpolation',
            icon: comfyIcon('video-interpolation')
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
            icon: comfyIcon('video-select-object-segmentation')
          }
        ]
      },
      {
        key: '3d-transform',
        label: '3D Transform',
        media: '3d',
        tiles: [
          { label: 'Upscale 3D Model', icon: comfyIcon('3d-upscale') },
          { label: 'Decompose 3D Model', icon: comfyIcon('3d-decomp') }
        ]
      }
    ]
  }
]
