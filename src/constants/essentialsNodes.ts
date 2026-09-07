import { mapValues } from 'es-toolkit'

import { BLUEPRINT_TYPE_PREFIX } from '@/utils/blueprintUtils'

export type EssentialsMediaType = 'image' | 'video' | 'text' | 'audio' | '3d'

interface EssentialsPath {
  section: string
  subgroup?: string
}

export interface EssentialTile {
  icon?: string
  media?: EssentialsMediaType
  partnerLogo?: string
  /**
   * Backing ComfyUI node identifier resolved by the hover popover.
   *   - For NODEs and PARTNER/API nodes: pass the registered
   *     `name` (class key)
   *   - For BLUEPRINTs: pass `SubgraphBlueprint.<filename>` where
   *     `<filename>` is the bare blueprint JSON filename (no extension,
   *     no `local-` prefix), e.g. `Image Inpainting (Qwen-image)`.
   */
  nodeName: string
}

interface EssentialSubgroup {
  key: string
  media: EssentialsMediaType
  tiles: EssentialTile[]
}

export interface EssentialSection {
  key: string
  subgroups?: EssentialSubgroup[]
  tiles?: EssentialTile[]
}

function blueprint(name: string) {
  return BLUEPRINT_TYPE_PREFIX + name
}

export const ESSENTIAL_SECTIONS: EssentialSection[] = [
  {
    key: 'inputs-outputs',
    tiles: [
      {
        icon: 'icon-s1.5-[lucide--image-up]',
        media: 'image',
        nodeName: 'LoadImage'
      },
      {
        icon: 'icon-s1.5-[lucide--image-down]',
        media: 'image',
        nodeName: 'SaveImage'
      },
      {
        icon: 'icon-[comfy--load-video]',
        media: 'video',
        nodeName: 'LoadVideo'
      },
      {
        icon: 'icon-[comfy--save-video]',
        media: 'video',
        nodeName: 'SaveVideo'
      },
      {
        icon: 'icon-[comfy--load-3d]',
        media: '3d',
        nodeName: 'Load3D'
      },
      {
        icon: 'icon-[comfy--save-3d]',
        media: '3d',
        nodeName: 'SaveGLB'
      },
      {
        icon: 'icon-[comfy--load-audio]',
        media: 'audio',
        nodeName: 'LoadAudio'
      },
      {
        icon: 'icon-[comfy--save-audio]',
        media: 'audio',
        nodeName: 'SaveAudioAdvanced'
      },
      {
        icon: 'icon-s1.5-[lucide--text]',
        media: 'text',
        nodeName: 'PrimitiveStringMultiline'
      },
      {
        icon: 'icon-s1.5-[lucide--text]',
        media: 'text',
        nodeName: 'PreviewAny'
      },
      {
        icon: 'icon-[comfy--lora-loader]',
        media: 'image',
        nodeName: 'LoraLoader'
      }
    ]
  },
  {
    key: 'generate',
    subgroups: [
      {
        key: 'generate-image',
        media: 'image',
        tiles: [
          {
            icon: 'icon-[comfy--text-to-image]',
            partnerLogo: 'icon-[comfy--gemini]',
            nodeName: 'GeminiImageNode'
          },
          {
            icon: 'icon-[comfy--image-edit]',
            partnerLogo: 'icon-[comfy--grok]',
            nodeName: 'GrokImageEditNodeV2'
          },
          {
            icon: 'icon-[comfy--text-to-image]',
            partnerLogo: 'icon-[comfy--bytedance]',
            nodeName: 'ByteDanceSeedreamNode'
          },
          {
            icon: 'icon-[comfy--text-to-image]',
            nodeName: blueprint('Text to Image (Z-Image-Turbo)')
          },
          {
            icon: 'icon-[comfy--image-edit]',
            nodeName: blueprint('Image Edit (Qwen 2511)')
          },
          {
            icon: 'icon-[comfy--image-inpaint]',
            nodeName: blueprint('Image Inpainting (Qwen-image)')
          },
          {
            icon: 'icon-[comfy--image-outpaint]',
            nodeName: blueprint('Image Outpainting (Qwen-Image)')
          },
          {
            icon: 'icon-[comfy--image-to-layers]',
            nodeName: blueprint('Image to Layers(Qwen-Image-Layered)')
          },
          {
            icon: 'icon-[comfy--image-vectorize]',
            partnerLogo: 'icon-[comfy--recraft]',
            nodeName: 'RecraftVectorizeImageNode'
          },
          {
            icon: 'icon-[comfy--pose-to-image]',
            nodeName: blueprint('Pose to Image (Z-Image-Turbo)')
          },
          {
            icon: 'icon-[comfy--canny-to-image]',
            nodeName: blueprint('Canny to Image (Z-Image-Turbo)')
          },
          {
            icon: 'icon-[comfy--depth-to-image]',
            nodeName: blueprint('Depth to Image (Z-Image-Turbo)')
          }
        ]
      },
      {
        key: 'generate-video',
        media: 'video',
        tiles: [
          {
            icon: 'icon-[comfy--text-to-video]',
            partnerLogo: 'icon-[comfy--grok]',
            nodeName: 'GrokVideoNode'
          },
          {
            icon: 'icon-[comfy--image-to-video]',
            partnerLogo: 'icon-[comfy--kling]',
            nodeName: 'KlingImage2VideoNode'
          },
          {
            icon: 'icon-[comfy--image-to-video]',
            partnerLogo: 'icon-[comfy--bytedance]',
            nodeName: 'ByteDance2ReferenceNode'
          },
          {
            icon: 'icon-[comfy--text-to-video]',
            nodeName: blueprint('Text to Video (Wan 2.2)')
          },
          {
            icon: 'icon-[comfy--image-to-video]',
            nodeName: blueprint('Image to Video (Wan 2.2)')
          },
          {
            icon: 'icon-[comfy--image-to-video]',
            nodeName: blueprint('First-Last-Frame to Video')
          },
          {
            icon: 'icon-[comfy--video-edit]',
            partnerLogo: 'icon-[comfy--kling]',
            nodeName: 'KlingOmniProEditVideoNode'
          },
          {
            icon: 'icon-s1.5-[lucide--mic-vocal]',
            partnerLogo: 'icon-[comfy--kling]',
            nodeName: 'KlingLipSyncAudioToVideoNode'
          },
          {
            icon: 'icon-[comfy--video-inpaint]',
            nodeName: blueprint('Video Inpainting (Wan2.1 VACE)')
          },
          {
            icon: 'icon-[comfy--pose-to-video]',
            nodeName: blueprint('Pose to Video (LTX 2.0)')
          },
          {
            icon: 'icon-[comfy--canny-to-video]',
            nodeName: blueprint('Canny to Video (LTX 2.0)')
          },
          {
            icon: 'icon-[comfy--depth-to-video]',
            nodeName: blueprint('Depth to Video (ltx 2.0)')
          }
        ]
      },
      {
        key: 'generate-text',
        media: 'text',
        tiles: [
          {
            icon: 'icon-[comfy--text-prompt-enhance]',
            partnerLogo: 'icon-[comfy--gemini]',
            nodeName: 'GeminiNode'
          },
          {
            icon: 'icon-[comfy--text-prompt-enhance]',
            partnerLogo: 'icon-[comfy--claude]',
            nodeName: 'ClaudeNode'
          },
          {
            icon: 'icon-[comfy--text-prompt-enhance]',
            nodeName: blueprint('Prompt Enhance')
          },
          {
            icon: 'icon-[comfy--image-captioning]',
            nodeName: blueprint('Image Captioning (gemini)')
          },
          {
            icon: 'icon-[comfy--video-captioning]',
            nodeName: blueprint('Video Captioning (Gemini)')
          }
        ]
      },
      {
        key: 'generate-audio',
        media: 'audio',
        tiles: [
          {
            icon: 'icon-[comfy--text-to-audio]',
            nodeName: blueprint('Text to Audio (ACE-Step 1.5)')
          },
          {
            icon: 'icon-s1.5-[lucide--speech]',
            partnerLogo: 'icon-[comfy--elevenlabs]',
            nodeName: 'ElevenLabsTextToSpeech'
          },
          {
            icon: 'icon-[comfy--voice-clone]',
            partnerLogo: 'icon-[comfy--elevenlabs]',
            nodeName: 'ElevenLabsInstantVoiceClone'
          }
        ]
      },
      {
        key: 'generate-3d',
        media: '3d',
        tiles: [
          {
            icon: 'icon-[comfy--text-to-3d]',
            partnerLogo: 'icon-[comfy--tencent]',
            nodeName: 'TencentTextToModelNode'
          },
          {
            icon: 'icon-[comfy--image-to-3d]',
            nodeName: blueprint('Image to Model (Hunyuan3d 2.1)')
          }
        ]
      }
    ]
  },
  {
    key: 'control-guidance',
    subgroups: [
      {
        key: 'control-image',
        media: 'image',
        tiles: [
          {
            icon: 'icon-[comfy--image-canny]',
            nodeName: 'Canny'
          }
        ]
      }
    ]
  },
  {
    key: 'editing-utilities',
    subgroups: [
      {
        key: 'image-transform',
        media: 'image',
        tiles: [
          {
            icon: 'icon-s1.5-[lucide--crop]',
            nodeName: 'ImageCropV2'
          },
          {
            icon: 'icon-s1.5-[lucide--crop]',
            nodeName: blueprint('Crop Images 2x2')
          },
          {
            icon: 'icon-s1.5-[lucide--crop]',
            nodeName: blueprint('Crop Images 3x3')
          },
          {
            icon: 'icon-[comfy--image-upscale]',
            nodeName: 'ImageScale'
          },
          {
            icon: 'icon-[comfy--image-upscale]',
            nodeName: blueprint('Image Upscale(Z-image-Turbo)')
          },
          {
            icon: 'icon-[comfy--image-rotate]',
            nodeName: 'ImageRotate'
          },
          {
            icon: 'icon-[comfy--image-collage]',
            nodeName: 'ImageStitch'
          }
        ]
      },
      {
        key: 'image-utilities',
        media: 'image',
        tiles: [
          {
            icon: 'icon-[comfy--image-batch]',
            nodeName: 'BatchImagesNode'
          },
          {
            icon: 'icon-[comfy--image-compare]',
            nodeName: 'ImageCompare'
          },
          {
            icon: 'icon-[comfy--frames-to-video]',
            nodeName: 'CreateVideo'
          }
        ]
      },
      {
        key: 'image-filters-effects',
        media: 'image',
        tiles: [
          {
            icon: 'icon-[comfy--image-invert]',
            nodeName: 'ImageInvert'
          },
          {
            icon: 'icon-[comfy--chromatic-aberration]',
            nodeName: blueprint('Chromatic Aberration')
          },
          {
            icon: 'icon-[comfy--grain]',
            nodeName: blueprint('Film Grain')
          },
          {
            icon: 'icon-[comfy--glow]',
            nodeName: blueprint('Glow')
          },
          {
            icon: 'icon-[comfy--image-sharpen]',
            nodeName: blueprint('Sharpen')
          },
          {
            icon: 'icon-[comfy--image-blur]',
            nodeName: blueprint('Image Blur')
          },
          {
            icon: 'icon-[comfy--image-shader]',
            nodeName: 'GLSLShader'
          }
        ]
      },
      {
        key: 'image-color',
        media: 'image',
        tiles: [
          {
            icon: 'icon-[comfy--brightness-contrast]',
            nodeName: blueprint('Brightness and Contrast')
          },
          {
            icon: 'icon-[comfy--dial]',
            nodeName: blueprint('Hue and Saturation')
          },
          {
            icon: 'icon-s1.5-[lucide--sliders-horizontal]',
            nodeName: blueprint('Color Balance')
          },
          {
            icon: 'icon-s1.5-[lucide--chart-spline]',
            nodeName: blueprint('Color Curves')
          },
          {
            icon: 'icon-s1.5-[lucide--sliders-horizontal]',
            nodeName: blueprint('Image Levels')
          },
          {
            icon: 'icon-[comfy--channels]',
            nodeName: blueprint('Image Channels')
          },
          {
            icon: 'icon-s1.5-[lucide--sliders-horizontal]',
            nodeName: blueprint('Color Adjustment')
          }
        ]
      },
      {
        key: 'image-selection-masking',
        media: 'image',
        tiles: [
          {
            icon: 'icon-[comfy--image-select-object-segmentation]',
            nodeName: blueprint('Image Segmentation (SAM3)')
          },
          {
            icon: 'icon-[comfy--image-remove-background]',
            partnerLogo: 'icon-[comfy--recraft]',
            nodeName: 'RecraftRemoveBackgroundNode'
          }
        ]
      },
      {
        key: 'video-transform',
        media: 'video',
        tiles: [
          {
            icon: 'icon-[comfy--video-trim]',
            nodeName: 'Video Slice'
          },
          {
            icon: 'icon-[comfy--video-upscale]',
            partnerLogo: 'icon-[comfy--topaz]',
            nodeName: 'TopazVideoEnhanceV2'
          }
        ]
      },
      {
        key: 'video-compose',
        media: 'video',
        tiles: [
          {
            icon: 'icon-[comfy--video-split-screen]',
            nodeName: blueprint('Video Stitch')
          },
          {
            icon: 'icon-[comfy--video-extract-frame]',
            nodeName: blueprint('Get Any Video Frame')
          },
          {
            icon: 'icon-[comfy--video-interpolation]',
            nodeName: blueprint('Frame Interpolation')
          }
        ]
      },
      {
        key: 'video-selection-masking',
        media: 'video',
        tiles: [
          {
            icon: 'icon-[comfy--video-select-object-segmentation]',
            nodeName: blueprint('Video Segmentation (SAM3)')
          }
        ]
      },
      {
        key: '3d-transform',
        media: '3d',
        tiles: [
          {
            icon: 'icon-s1.5-[lucide--package-open]',
            partnerLogo: 'icon-[comfy--tencent]',
            nodeName: 'TencentModelTo3DUVNode'
          },
          {
            icon: 'icon-[comfy--3d-decomp]',
            partnerLogo: 'icon-[comfy--tencent]',
            nodeName: 'Tencent3DPartNode'
          }
        ]
      }
    ]
  }
]

const NODE_TO_ESSENTIALS_PATH: Record<string, EssentialsPath> =
  Object.fromEntries(
    ESSENTIAL_SECTIONS.flatMap(
      (section) =>
        section.subgroups?.flatMap((sg) =>
          sg.tiles.map((t) => [
            t.nodeName,
            { section: section.key, subgroup: sg.key }
          ])
        ) ??
        section.tiles?.map((t) => [t.nodeName, { section: section.key }]) ??
        []
    )
  )

export const NODE_TO_ESSENTIALS_CATEGORY: Record<string, string> = mapValues(
  NODE_TO_ESSENTIALS_PATH,
  (v) => v.subgroup ?? v.section
)

export const TOOLKIT_NODES = new Set(
  Object.entries(NODE_TO_ESSENTIALS_PATH)
    .filter(([, path]) => path.section !== 'inputs-outputs')
    .map(([type]) => type)
)
