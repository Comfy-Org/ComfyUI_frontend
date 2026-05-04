interface ModelOverride {
  docsUrl?: string
  blogUrl?: string
  featured?: boolean
}

export const modelMetadata: Record<string, ModelOverride> = {
  'nano-banana': {
    docsUrl:
      'https://docs.comfy.org/tutorials/partner-nodes/google/nano-banana-pro',
    featured: true
  },
  'kling-ai': {
    docsUrl:
      'https://docs.comfy.org/tutorials/partner-nodes/kling/kling-motion-control',
    featured: true
  },
  'meshy-ai': {
    docsUrl: 'https://docs.comfy.org/tutorials/partner-nodes/meshy/meshy-6',
    featured: true
  },
  'openai-dall-e': {
    docsUrl: 'https://docs.comfy.org/tutorials/partner-nodes/openai/dall-e-3',
    featured: true
  },
  'ltxv-api': {
    docsUrl: 'https://docs.comfy.org/tutorials/video/ltxv',
    featured: true
  },
  'wan-api': {
    docsUrl: 'https://docs.comfy.org/tutorials/video/wan/wan2_2',
    featured: true
  },
  'wan-2-2': {
    docsUrl: 'https://docs.comfy.org/tutorials/video/wan/wan2_2',
    featured: true
  },
  'wan-2-1': {
    docsUrl: 'https://docs.comfy.org/tutorials/video/wan/wan-video',
    featured: true
  },
  'flux-1-kontext-dev': {
    docsUrl:
      'https://docs.comfy.org/tutorials/partner-nodes/black-forest-labs/flux-1-kontext',
    featured: true
  },
  'flux-1-dev': {
    docsUrl: 'https://docs.comfy.org/tutorials/flux/flux-1-text-to-image',
    featured: true
  },
  'hunyuan-video': {
    docsUrl: 'https://docs.comfy.org/tutorials/video/hunyuan/hunyuan-video',
    featured: true
  },
  'hunyuan-3d': {
    docsUrl: 'https://docs.comfy.org/tutorials/3d/hunyuan3D-2',
    featured: true
  }
}
