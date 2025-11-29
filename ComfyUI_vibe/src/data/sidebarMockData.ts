// Mock data for sidebar tabs
// TODO: Replace with real API data from ComfyUI backend

export interface NodeItem {
  name: string
  display: string
}

export interface NodeCategory {
  id: string
  label: string
  icon: string
  expanded: boolean
  nodes: NodeItem[]
}

export interface ModelItem {
  name: string
  display: string
  size: string
}

export interface ModelCategory {
  id: string
  label: string
  icon: string
  expanded: boolean
  models: ModelItem[]
}

export interface WorkflowItem {
  name: string
  date: string
  nodes: number
  thumbnail: string
}

export interface AssetItem {
  name: string
  type: string
}

export interface TemplateItem {
  name: string
  display: string
  description: string
  nodes: number
}

export interface TemplateCategory {
  id: string
  label: string
  icon: string
  expanded: boolean
  templates: TemplateItem[]
}

export const NODE_CATEGORIES_DATA: NodeCategory[] = [
  {
    id: 'loaders',
    label: 'Loaders',
    icon: 'pi pi-download',
    expanded: true,
    nodes: [
      { name: 'CheckpointLoaderSimple', display: 'Load Checkpoint' },
      { name: 'VAELoader', display: 'Load VAE' },
      { name: 'LoraLoader', display: 'Load LoRA' },
      { name: 'CLIPLoader', display: 'Load CLIP' },
      { name: 'ControlNetLoader', display: 'Load ControlNet Model' },
      { name: 'UNETLoader', display: 'Load Diffusion Model' },
    ]
  },
  {
    id: 'conditioning',
    label: 'Conditioning',
    icon: 'pi pi-sliders-h',
    expanded: false,
    nodes: [
      { name: 'CLIPTextEncode', display: 'CLIP Text Encode (Prompt)' },
      { name: 'ConditioningCombine', display: 'Conditioning (Combine)' },
      { name: 'ConditioningSetArea', display: 'Conditioning (Set Area)' },
      { name: 'ControlNetApply', display: 'Apply ControlNet' },
    ]
  },
  {
    id: 'sampling',
    label: 'Sampling',
    icon: 'pi pi-box',
    expanded: false,
    nodes: [
      { name: 'KSampler', display: 'KSampler' },
      { name: 'KSamplerAdvanced', display: 'KSampler (Advanced)' },
      { name: 'SamplerCustom', display: 'SamplerCustom' },
    ]
  },
  {
    id: 'latent',
    label: 'Latent',
    icon: 'pi pi-th-large',
    expanded: false,
    nodes: [
      { name: 'EmptyLatentImage', display: 'Empty Latent Image' },
      { name: 'LatentUpscale', display: 'Upscale Latent' },
      { name: 'LatentComposite', display: 'Latent Composite' },
      { name: 'VAEDecode', display: 'VAE Decode' },
      { name: 'VAEEncode', display: 'VAE Encode' },
    ]
  },
  {
    id: 'image',
    label: 'Image',
    icon: 'pi pi-image',
    expanded: false,
    nodes: [
      { name: 'LoadImage', display: 'Load Image' },
      { name: 'SaveImage', display: 'Save Image' },
      { name: 'PreviewImage', display: 'Preview Image' },
      { name: 'ImageScale', display: 'Upscale Image' },
      { name: 'ImageInvert', display: 'Invert Image' },
    ]
  },
  {
    id: 'masking',
    label: 'Masking',
    icon: 'pi pi-clone',
    expanded: false,
    nodes: [
      { name: 'LoadImageMask', display: 'Load Image (as Mask)' },
      { name: 'MaskComposite', display: 'Mask Composite' },
      { name: 'ImageToMask', display: 'Convert Image to Mask' },
    ]
  },
]

export const MODEL_CATEGORIES_DATA: ModelCategory[] = [
  {
    id: 'checkpoints',
    label: 'Checkpoints',
    icon: 'pi pi-box',
    expanded: true,
    models: [
      { name: 'sd_v1-5', display: 'SD 1.5', size: '4.27 GB' },
      { name: 'sd_xl_base_1.0', display: 'SDXL Base 1.0', size: '6.94 GB' },
      { name: 'realistic_vision_v5', display: 'Realistic Vision V5', size: '2.13 GB' },
      { name: 'dreamshaper_8', display: 'DreamShaper 8', size: '2.13 GB' },
      { name: 'deliberate_v3', display: 'Deliberate V3', size: '2.13 GB' },
    ]
  },
  {
    id: 'loras',
    label: 'LoRAs',
    icon: 'pi pi-link',
    expanded: false,
    models: [
      { name: 'add_detail', display: 'Add Detail', size: '144 MB' },
      { name: 'epi_noiseoffset', display: 'Epi Noise Offset', size: '36 MB' },
      { name: 'film_grain', display: 'Film Grain', size: '72 MB' },
      { name: 'lcm_lora_sdxl', display: 'LCM LoRA SDXL', size: '393 MB' },
    ]
  },
  {
    id: 'vae',
    label: 'VAE',
    icon: 'pi pi-sitemap',
    expanded: false,
    models: [
      { name: 'vae-ft-mse-840000', display: 'VAE ft MSE', size: '335 MB' },
      { name: 'sdxl_vae', display: 'SDXL VAE', size: '335 MB' },
    ]
  },
  {
    id: 'controlnet',
    label: 'ControlNet',
    icon: 'pi pi-sliders-v',
    expanded: false,
    models: [
      { name: 'control_v11p_sd15_canny', display: 'Canny (SD1.5)', size: '1.45 GB' },
      { name: 'control_v11p_sd15_openpose', display: 'OpenPose (SD1.5)', size: '1.45 GB' },
      { name: 'control_v11f1p_sd15_depth', display: 'Depth (SD1.5)', size: '1.45 GB' },
      { name: 'controlnet_sdxl_canny', display: 'Canny (SDXL)', size: '2.5 GB' },
    ]
  },
  {
    id: 'embeddings',
    label: 'Embeddings',
    icon: 'pi pi-tag',
    expanded: false,
    models: [
      { name: 'easynegative', display: 'EasyNegative', size: '24 KB' },
      { name: 'bad_prompt_v2', display: 'Bad Prompt V2', size: '24 KB' },
      { name: 'ng_deepnegative', display: 'NG DeepNegative', size: '24 KB' },
    ]
  },
  {
    id: 'upscale',
    label: 'Upscale Models',
    icon: 'pi pi-expand',
    expanded: false,
    models: [
      { name: '4x_ultrasharp', display: '4x UltraSharp', size: '67 MB' },
      { name: 'realesrgan_x4plus', display: 'RealESRGAN x4+', size: '64 MB' },
      { name: '4x_nmkd_superscale', display: '4x NMKD Superscale', size: '67 MB' },
    ]
  },
]

export const WORKFLOWS_DATA: WorkflowItem[] = [
  { name: 'Basic txt2img', date: '2024-01-15', nodes: 8, thumbnail: 'txt2img' },
  { name: 'Img2Img Pipeline', date: '2024-01-14', nodes: 12, thumbnail: 'img2img' },
  { name: 'ControlNet Canny', date: '2024-01-13', nodes: 15, thumbnail: 'controlnet' },
  { name: 'SDXL with Refiner', date: '2024-01-12', nodes: 18, thumbnail: 'sdxl' },
  { name: 'Inpainting Setup', date: '2024-01-10', nodes: 10, thumbnail: 'inpaint' },
]

export const ASSETS_DATA: AssetItem[] = [
  { name: 'reference_01.png', type: 'image' },
  { name: 'mask_template.png', type: 'image' },
  { name: 'init_image.jpg', type: 'image' },
]

// Team Library Types
export interface TeamMember {
  name: string
  avatar?: string
  initials: string
  role: 'admin' | 'editor' | 'viewer'
}

export interface BrandAsset {
  id: string
  name: string
  type: 'logo' | 'color' | 'font' | 'template' | 'guideline'
  thumbnail?: string
  value?: string
  description?: string
}

export interface SharedWorkflow {
  id: string
  name: string
  description: string
  author: TeamMember
  updatedAt: string
  nodes: number
  category: string
  starred: boolean
  thumbnail?: string
}

export interface TeamModel {
  id: string
  name: string
  type: 'checkpoint' | 'lora' | 'embedding' | 'controlnet'
  description: string
  size: string
  author: TeamMember
  downloads: number
  thumbnail?: string
}

export interface NodePack {
  id: string
  name: string
  description: string
  version: string
  nodes: number
  author: string
  installed: boolean
  thumbnail?: string
}

export const TEMPLATE_CATEGORIES_DATA: TemplateCategory[] = [
  {
    id: 'official',
    label: 'Official',
    icon: 'pi pi-verified',
    expanded: true,
    templates: [
      { name: 'txt2img-basic', display: 'Text to Image (Basic)', description: 'Simple text-to-image generation', nodes: 6 },
      { name: 'img2img-basic', display: 'Image to Image', description: 'Transform existing images', nodes: 8 },
      { name: 'inpainting', display: 'Inpainting', description: 'Fill masked regions', nodes: 10 },
      { name: 'upscaling', display: 'Upscaling', description: '2x-4x image upscaling', nodes: 5 },
    ]
  },
  {
    id: 'sdxl',
    label: 'SDXL',
    icon: 'pi pi-star',
    expanded: false,
    templates: [
      { name: 'sdxl-txt2img', display: 'SDXL Text to Image', description: 'SDXL base workflow', nodes: 8 },
      { name: 'sdxl-refiner', display: 'SDXL + Refiner', description: 'Base with refiner', nodes: 14 },
      { name: 'sdxl-lightning', display: 'SDXL Lightning', description: '4-step fast generation', nodes: 9 },
    ]
  },
  {
    id: 'controlnet',
    label: 'ControlNet',
    icon: 'pi pi-sliders-v',
    expanded: false,
    templates: [
      { name: 'cn-canny', display: 'Canny Edge', description: 'Edge detection control', nodes: 12 },
      { name: 'cn-depth', display: 'Depth Map', description: 'Depth-based control', nodes: 12 },
      { name: 'cn-openpose', display: 'OpenPose', description: 'Pose control', nodes: 14 },
      { name: 'cn-lineart', display: 'Line Art', description: 'Sketch to image', nodes: 11 },
    ]
  },
  {
    id: 'video',
    label: 'Video',
    icon: 'pi pi-video',
    expanded: false,
    templates: [
      { name: 'svd-basic', display: 'SVD Image to Video', description: 'Stable Video Diffusion', nodes: 10 },
      { name: 'animatediff', display: 'AnimateDiff', description: 'Animation generation', nodes: 16 },
    ]
  },
  {
    id: 'community',
    label: 'Community',
    icon: 'pi pi-users',
    expanded: false,
    templates: [
      { name: 'portrait-enhance', display: 'Portrait Enhancer', description: 'Face restoration workflow', nodes: 12 },
      { name: 'style-transfer', display: 'Style Transfer', description: 'Apply art styles', nodes: 14 },
      { name: 'batch-process', display: 'Batch Processing', description: 'Process multiple images', nodes: 18 },
    ]
  },
]

// Team Library Mock Data
export const TEAM_MEMBERS_DATA: TeamMember[] = [
  { name: 'Sarah Chen', initials: 'SC', role: 'admin' },
  { name: 'Mike Johnson', initials: 'MJ', role: 'editor' },
  { name: 'Alex Rivera', initials: 'AR', role: 'editor' },
  { name: 'Emma Wilson', initials: 'EW', role: 'viewer' },
]

export const BRAND_ASSETS_DATA: BrandAsset[] = [
  { id: '1', name: 'Primary Logo', type: 'logo', description: 'Main Netflix N logo' },
  { id: '2', name: 'Wordmark', type: 'logo', description: 'Netflix text logo' },
  { id: '3', name: 'Netflix Red', type: 'color', value: '#E50914', description: 'Primary brand color' },
  { id: '4', name: 'Background Black', type: 'color', value: '#141414', description: 'Standard background' },
  { id: '5', name: 'Netflix Sans', type: 'font', description: 'Primary typeface' },
  { id: '6', name: 'Thumbnail Template', type: 'template', description: '16:9 show thumbnail' },
  { id: '7', name: 'Brand Guidelines', type: 'guideline', description: 'Full brand documentation' },
]

export function createSharedWorkflowsData(members: TeamMember[]): SharedWorkflow[] {
  return [
    {
      id: '1',
      name: 'Show Thumbnail Generator',
      description: 'Standard workflow for generating show thumbnails with proper dimensions and styling',
      author: members[0]!,
      updatedAt: '2 hours ago',
      nodes: 12,
      category: 'Production',
      starred: true,
      thumbnail: '/assets/card_images/workflow_01.webp',
    },
    {
      id: '2',
      name: 'Character Portrait Pipeline',
      description: 'Generate consistent character portraits for marketing materials',
      author: members[1]!,
      updatedAt: '1 day ago',
      nodes: 18,
      category: 'Marketing',
      starred: true,
      thumbnail: '/assets/card_images/2690a78c-c210-4a52-8c37-3cb5bc4d9e71.webp',
    },
    {
      id: '3',
      name: 'Background Scene Creator',
      description: 'Create atmospheric background scenes with Netflix visual style',
      author: members[2]!,
      updatedAt: '3 days ago',
      nodes: 24,
      category: 'Production',
      starred: false,
      thumbnail: '/assets/card_images/bacb46ea-7e63-4f19-a253-daf41461e98f.webp',
    },
    {
      id: '4',
      name: 'Social Media Variants',
      description: 'Batch generate social media sized versions',
      author: members[0]!,
      updatedAt: '1 week ago',
      nodes: 8,
      category: 'Marketing',
      starred: false,
      thumbnail: '/assets/card_images/228616f4-12ad-426d-84fb-f20e488ba7ee.webp',
    },
  ]
}

export function createTeamModelsData(members: TeamMember[]): TeamModel[] {
  return [
    {
      id: '1',
      name: 'Netflix Style v2',
      type: 'lora',
      description: 'Fine-tuned for Netflix visual aesthetic',
      size: '144 MB',
      author: members[0]!,
      downloads: 156,
      thumbnail: '/assets/card_images/683255d3-1d10-43d9-a6ff-ef142061e88a.webp',
    },
    {
      id: '2',
      name: 'Show Thumbnail SDXL',
      type: 'checkpoint',
      description: 'SDXL checkpoint trained on approved thumbnails',
      size: '6.94 GB',
      author: members[1]!,
      downloads: 89,
      thumbnail: '/assets/card_images/91f1f589-ddb4-4c4f-b3a7-ba30fc271987.webp',
    },
    {
      id: '3',
      name: 'Character Consistency',
      type: 'lora',
      description: 'Maintain character consistency across generations',
      size: '72 MB',
      author: members[2]!,
      downloads: 234,
      thumbnail: '/assets/card_images/28e9f7ea-ef00-48e8-849d-8752a34939c7.webp',
    },
    {
      id: '4',
      name: 'Brand Color Embedding',
      type: 'embedding',
      description: 'Netflix color palette embedding',
      size: '24 KB',
      author: members[0]!,
      downloads: 312,
      thumbnail: '/assets/card_images/comfyui_workflow.jpg',
    },
  ]
}

export const NODE_PACKS_DATA: NodePack[] = [
  {
    id: '1',
    name: 'Netflix Brand Tools',
    description: 'Custom nodes for brand compliance checking and color matching',
    version: '1.2.0',
    nodes: 8,
    author: 'Netflix Creative Tech',
    installed: true,
    thumbnail: '/assets/card_images/can-you-rate-my-comfyui-workflow-v0-o9clchhji39c1.webp',
  },
  {
    id: '2',
    name: 'Thumbnail Validator',
    description: 'Validates generated thumbnails against brand guidelines',
    version: '2.0.1',
    nodes: 4,
    author: 'Netflix Creative Tech',
    installed: true,
    thumbnail: '/assets/card_images/dda28581-37c8-44da-8822-57d1ccc2118c_2130x1658.png',
  },
  {
    id: '3',
    name: 'Asset Exporter Pro',
    description: 'Export to Netflix-standard formats and dimensions',
    version: '1.5.3',
    nodes: 6,
    author: 'Netflix Creative Tech',
    installed: false,
    thumbnail: '/assets/card_images/workflow_01.webp',
  },
]
