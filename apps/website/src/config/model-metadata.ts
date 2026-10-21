interface ModelOverride {
  docsUrl?: string
  blogUrl?: string
  featured?: boolean
  // Hub list search term. Use comfy-router's term when it maps the old family page.
  hubSearch?: string
  // When set, the model page's "What is {name}" paragraph links the leading
  // occurrence of displayName to this URL. See [slug].astro.
  whatIsBacklinkUrl?: string
}

export const modelMetadata: Record<string, ModelOverride> = {
  minimax: {
    whatIsBacklinkUrl: 'https://design.minimax.io/tools/minimax-h3-comfyui'
  },
  'nano-banana': {
    docsUrl:
      'https://docs.comfy.org/tutorials/partner-nodes/google/nano-banana-pro',
    hubSearch: 'nano banana',
    featured: true
  },
  'kling-ai': {
    docsUrl:
      'https://docs.comfy.org/tutorials/partner-nodes/kling/kling-motion-control',
    hubSearch: 'kling',
    featured: true
  },
  'meshy-ai': {
    docsUrl: 'https://docs.comfy.org/tutorials/partner-nodes/meshy/meshy-6',
    hubSearch: 'meshy',
    featured: true
  },
  'openai-dall-e': {
    docsUrl: 'https://docs.comfy.org/tutorials/partner-nodes/openai/dall-e-3',
    hubSearch: 'openai',
    featured: true
  },
  'ltxv-api': {
    docsUrl: 'https://docs.comfy.org/tutorials/video/ltxv',
    hubSearch: 'ltx',
    featured: true
  },
  'wan-api': {
    docsUrl: 'https://docs.comfy.org/tutorials/video/wan/wan2_2',
    hubSearch: 'wan',
    featured: true
  },
  'wan-2-2': {
    docsUrl: 'https://docs.comfy.org/tutorials/video/wan/wan2_2',
    hubSearch: 'wan',
    featured: true
  },
  'wan-2-1': {
    docsUrl: 'https://docs.comfy.org/tutorials/video/wan/wan-video',
    hubSearch: 'wan',
    featured: true
  },
  'flux-1-kontext-dev': {
    docsUrl:
      'https://docs.comfy.org/tutorials/partner-nodes/black-forest-labs/flux-1-kontext',
    hubSearch: 'flux',
    featured: true
  },
  'flux1-dev': {
    docsUrl: 'https://docs.comfy.org/tutorials/flux/flux-1-text-to-image',
    hubSearch: 'flux',
    featured: true
  },
  'flux1-schnell': {
    hubSearch: 'flux',
    featured: true
  },
  'hunyuan-video': {
    docsUrl: 'https://docs.comfy.org/tutorials/video/hunyuan/hunyuan-video',
    hubSearch: 'hunyuan video',
    featured: true
  },
  'hunyuan-3d': {
    docsUrl: 'https://docs.comfy.org/tutorials/3d/hunyuan3D-2',
    // The hub spells this family without the hyphen, and unlike the other
    // mismatches here it is not a variant alias the hub redirects, so the
    // hyphenated URL 404s rather than resolving.
    hubSearch: 'hunyuan3d',
    featured: true
  },
  vidu: {
    hubSearch: 'vidu',
    featured: true
  },
  runway: {
    hubSearch: 'runway',
    featured: true
  },
  'stability-ai': {
    hubSearch: 'stability',
    featured: true
  },
  'seedance-bytedance': {
    hubSearch: 'seedance',
    featured: true
  },
  'grok-imagine': {
    hubSearch: 'grok',
    featured: false
  },
  'luma-dream-machine': {
    hubSearch: 'luma',
    featured: false
  },
  moonvalley: {
    hubSearch: 'moonvalley',
    featured: false
  },
  'magnific-ai': {
    hubSearch: 'magnific',
    featured: false
  },
  pixverse: {
    hubSearch: 'pixverse',
    featured: false
  },
  'rodin-3d': {
    hubSearch: 'rodin',
    featured: false
  },
  recraft: {
    hubSearch: 'recraft',
    featured: false
  },
  'bria-ai': {
    hubSearch: 'bria',
    featured: false
  },
  'topaz-labs': {
    hubSearch: 'topaz',
    featured: false
  },
  wavespeed: {
    hubSearch: 'wavespeed',
    featured: false
  },
  ideogram: {
    hubSearch: 'ideogram',
    featured: false
  },
  'veo-2': {
    hubSearch: 'veo',
    featured: false
  },
  'veo-3': {
    hubSearch: 'veo',
    featured: false
  },
  'flux-2-api': {
    hubSearch: 'flux',
    featured: false
  },
  'ace-step-v1-3-5b': {
    docsUrl: 'https://docs.comfy.org/tutorials/audio/ace-step/ace-step-v1',
    hubSearch: 'ace-step',
    featured: false
  },
  'hidream-i1-dev-fp8': {
    docsUrl: 'https://docs.comfy.org/tutorials/image/hidream/hidream-i1',
    hubSearch: 'hidream',
    featured: false
  },
  'omnigen2-fp16': {
    hubSearch: 'omnigen',
    featured: false
  },
  'sd-xl-base-1-0': {
    hubSearch: 'stable',
    featured: false
  },
  'z-image-bf16': {
    hubSearch: 'z-image',
    featured: false
  },
  'z-image-turbo-bf16': {
    hubSearch: 'z-image',
    featured: false
  },
  'svd-xt': {
    hubSearch: 'svd',
    featured: false
  },
  'flux1-dev-kontext-fp8-scaled': {
    docsUrl: 'https://docs.comfy.org/tutorials/flux/flux-1-kontext-dev',
    hubSearch: 'flux',
    featured: false
  },
  'ltx-2-19b-dev-fp8': {
    hubSearch: 'ltx',
    featured: false
  },
  'ltx-2-19b-distilled': {
    hubSearch: 'ltx',
    featured: false
  },
  'flux1-fill-dev': {
    hubSearch: 'flux',
    featured: false
  },
  'flux-2-klein-base-9b-fp8': {
    hubSearch: 'flux',
    featured: false
  },
  'qwen-image-fp8-e4m3fn': {
    hubSearch: 'qwen',
    featured: false
  },
  'qwen-image-edit-2509-fp8-e4m3fn': {
    hubSearch: 'qwen',
    featured: false
  }
}
