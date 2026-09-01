interface ModelOverride {
  docsUrl?: string
  blogUrl?: string
  featured?: boolean
  // Slug used on comfy.org/workflows/model/{hubSlug}. Only set when the page exists.
  hubSlug?: string
}

export const modelMetadata: Record<string, ModelOverride> = {
  'nano-banana': {
    docsUrl:
      'https://docs.comfy.org/tutorials/partner-nodes/google/nano-banana-pro',
    hubSlug: 'nano-banana',
    featured: true
  },
  'kling-ai': {
    docsUrl:
      'https://docs.comfy.org/tutorials/partner-nodes/kling/kling-motion-control',
    hubSlug: 'kling',
    featured: true
  },
  'meshy-ai': {
    docsUrl: 'https://docs.comfy.org/tutorials/partner-nodes/meshy/meshy-6',
    hubSlug: 'meshy',
    featured: true
  },
  'openai-dall-e': {
    docsUrl: 'https://docs.comfy.org/tutorials/partner-nodes/openai/dall-e-3',
    hubSlug: 'openai',
    featured: true
  },
  'ltxv-api': {
    docsUrl: 'https://docs.comfy.org/tutorials/video/ltxv',
    hubSlug: 'ltx-2-3',
    featured: true
  },
  'wan-api': {
    docsUrl: 'https://docs.comfy.org/tutorials/video/wan/wan2_2',
    hubSlug: 'wan',
    featured: true
  },
  'wan-2-2': {
    docsUrl: 'https://docs.comfy.org/tutorials/video/wan/wan2_2',
    hubSlug: 'wan',
    featured: true
  },
  'wan-2-1': {
    docsUrl: 'https://docs.comfy.org/tutorials/video/wan/wan-video',
    hubSlug: 'wan',
    featured: true
  },
  'flux-1-kontext-dev': {
    docsUrl:
      'https://docs.comfy.org/tutorials/partner-nodes/black-forest-labs/flux-1-kontext',
    hubSlug: 'flux-1-kontext',
    featured: true
  },
  'flux1-dev': {
    docsUrl: 'https://docs.comfy.org/tutorials/flux/flux-1-text-to-image',
    hubSlug: 'flux-1',
    featured: true
  },
  'flux1-schnell': {
    hubSlug: 'flux-1',
    featured: true
  },
  'hunyuan-video': {
    docsUrl: 'https://docs.comfy.org/tutorials/video/hunyuan/hunyuan-video',
    hubSlug: 'hunyuan-video',
    featured: true
  },
  'hunyuan-3d': {
    docsUrl: 'https://docs.comfy.org/tutorials/3d/hunyuan3D-2',
    hubSlug: 'hunyuan-3d',
    featured: true
  },
  vidu: {
    hubSlug: 'vidu',
    featured: true
  },
  runway: {
    hubSlug: 'runway',
    featured: true
  },
  'stability-ai': {
    hubSlug: 'stability',
    featured: true
  },
  'seedance-bytedance': {
    hubSlug: 'seedance',
    featured: true
  },
  'grok-image': {
    hubSlug: 'grok',
    featured: false
  },
  'luma-dream-machine': {
    hubSlug: 'luma',
    featured: false
  },
  moonvalley: {
    hubSlug: 'moonvalley',
    featured: false
  },
  'magnific-ai': {
    hubSlug: 'magnific',
    featured: false
  },
  pixverse: {
    hubSlug: 'pixverse',
    featured: false
  },
  'rodin-3d': {
    hubSlug: 'rodin',
    featured: false
  },
  recraft: {
    hubSlug: 'recraft',
    featured: false
  },
  'bria-ai': {
    hubSlug: 'bria',
    featured: false
  },
  'topaz-labs': {
    hubSlug: 'topaz',
    featured: false
  },
  wavespeed: {
    hubSlug: 'wavespeed',
    featured: false
  },
  ideogram: {
    hubSlug: 'ideogram',
    featured: false
  },
  'veo-2': {
    hubSlug: 'veo',
    featured: false
  },
  'veo-3': {
    hubSlug: 'veo',
    featured: false
  },
  'flux-2-api': {
    hubSlug: 'flux-2',
    featured: false
  },
  'ace-step-v1-3-5b': {
    docsUrl: 'https://docs.comfy.org/tutorials/audio/ace-step/ace-step-v1',
    hubSlug: 'ace-step',
    featured: false
  },
  'hidream-i1-dev-fp8': {
    docsUrl: 'https://docs.comfy.org/tutorials/image/hidream/hidream-i1',
    hubSlug: 'hidream',
    featured: false
  },
  'omnigen2-fp16': {
    hubSlug: 'omnigen',
    featured: false
  },
  'sd-xl-base-1-0': {
    hubSlug: 'sdxl',
    featured: false
  },
  'z-image-bf16': {
    hubSlug: 'z-image',
    featured: false
  },
  'z-image-turbo-bf16': {
    hubSlug: 'z-image',
    featured: false
  },
  'svd-xt': {
    hubSlug: 'svd',
    featured: false
  },
  'flux1-dev-kontext-fp8-scaled': {
    docsUrl: 'https://docs.comfy.org/tutorials/flux/flux-1-kontext-dev',
    hubSlug: 'flux-1-kontext',
    featured: false
  },
  'ltx-2-19b-dev-fp8': {
    hubSlug: 'ltx-2',
    featured: false
  },
  'ltx-2-19b-distilled': {
    hubSlug: 'ltx-2',
    featured: false
  },
  'flux1-fill-dev': {
    hubSlug: 'flux-1',
    featured: false
  },
  'flux-2-klein-base-9b-fp8': {
    hubSlug: 'flux-2',
    featured: false
  },
  'qwen-image-fp8-e4m3fn': {
    hubSlug: 'qwen',
    featured: false
  },
  'qwen-image-edit-2509-fp8-e4m3fn': {
    hubSlug: 'qwen',
    featured: false
  }
}
