/**
 * Linear Mode Workflow Templates
 *
 * Pre-configured workflow templates for the simplified linear interface.
 */

import type { LinearWorkflowTemplate } from '@/types/linear'

export const LINEAR_WORKFLOW_TEMPLATES: LinearWorkflowTemplate[] = [
  // ===== TEXT TO IMAGE =====
  {
    id: 'txt2img-basic',
    name: 'Text to Image',
    description: 'Generate images from text prompts using Stable Diffusion',
    icon: 'pi-image',
    category: 'text-to-image',
    tags: ['basic', 'sd1.5', 'sdxl'],
    featured: true,
    thumbnailUrl: 'https://picsum.photos/seed/txt2img/400/300',
    steps: [
      {
        id: 'model',
        nodeType: 'LoadCheckpoint',
        displayName: 'Model',
        description: 'Choose your AI model',
        icon: 'pi-box',
        exposedWidgets: ['ckpt_name'],
        defaultValues: {
          ckpt_name: 'sd_xl_base_1.0.safetensors',
        },
      },
      {
        id: 'prompt',
        nodeType: 'CLIPTextEncode',
        displayName: 'Prompt',
        description: 'Describe what you want to create',
        icon: 'pi-pencil',
        exposedWidgets: ['text'],
        defaultValues: {
          text: 'A beautiful sunset over mountains, dramatic lighting, 8k, highly detailed',
        },
      },
      {
        id: 'settings',
        nodeType: 'KSampler',
        displayName: 'Settings',
        description: 'Fine-tune generation parameters',
        icon: 'pi-sliders-h',
        exposedWidgets: ['seed', 'steps', 'cfg', 'sampler_name'],
        defaultValues: {
          seed: -1,
          steps: 25,
          cfg: 7,
          sampler_name: 'dpmpp_2m',
        },
      },
      {
        id: 'size',
        nodeType: 'EmptyLatentImage',
        displayName: 'Size',
        description: 'Set output dimensions',
        icon: 'pi-arrows-alt',
        exposedWidgets: ['width', 'height'],
        defaultValues: {
          width: 1024,
          height: 1024,
          batch_size: 1,
        },
      },
      {
        id: 'output',
        nodeType: 'SaveImage',
        displayName: 'Output',
        description: 'Save your creation',
        icon: 'pi-download',
        exposedWidgets: ['filename_prefix'],
        defaultValues: {
          filename_prefix: 'linear_gen',
        },
      },
    ],
  },

  {
    id: 'txt2img-portrait',
    name: 'Portrait Generator',
    description: 'Create stunning AI portraits with optimized settings',
    icon: 'pi-user',
    category: 'text-to-image',
    tags: ['portrait', 'face', 'character'],
    featured: true,
    thumbnailUrl: 'https://picsum.photos/seed/portrait/400/300',
    steps: [
      {
        id: 'model',
        nodeType: 'LoadCheckpoint',
        displayName: 'Model',
        description: 'Portrait-optimized model',
        icon: 'pi-box',
        exposedWidgets: ['ckpt_name'],
        defaultValues: {
          ckpt_name: 'dreamshaper_8.safetensors',
        },
      },
      {
        id: 'prompt',
        nodeType: 'CLIPTextEncode',
        displayName: 'Describe Person',
        description: 'Describe the person you want to create',
        icon: 'pi-pencil',
        exposedWidgets: ['text'],
        defaultValues: {
          text: 'Portrait of a person, professional photography, soft lighting, sharp focus, high detail',
        },
      },
      {
        id: 'settings',
        nodeType: 'KSampler',
        displayName: 'Quality Settings',
        description: 'Adjust quality and creativity',
        icon: 'pi-sliders-h',
        exposedWidgets: ['seed', 'steps', 'cfg'],
        defaultValues: {
          seed: -1,
          steps: 30,
          cfg: 7.5,
          sampler_name: 'euler_ancestral',
        },
      },
      {
        id: 'size',
        nodeType: 'EmptyLatentImage',
        displayName: 'Format',
        description: 'Portrait dimensions',
        icon: 'pi-arrows-alt',
        exposedWidgets: ['width', 'height'],
        defaultValues: {
          width: 768,
          height: 1024,
          batch_size: 1,
        },
      },
      {
        id: 'output',
        nodeType: 'SaveImage',
        displayName: 'Save',
        description: 'Save portrait',
        icon: 'pi-download',
        exposedWidgets: ['filename_prefix'],
        defaultValues: {
          filename_prefix: 'portrait',
        },
      },
    ],
  },

  {
    id: 'txt2img-landscape',
    name: 'Landscape Creator',
    description: 'Generate breathtaking landscapes and environments',
    icon: 'pi-sun',
    category: 'text-to-image',
    tags: ['landscape', 'nature', 'environment'],
    featured: false,
    thumbnailUrl: 'https://picsum.photos/seed/landscape/400/300',
    steps: [
      {
        id: 'model',
        nodeType: 'LoadCheckpoint',
        displayName: 'Model',
        icon: 'pi-box',
        exposedWidgets: ['ckpt_name'],
        defaultValues: {
          ckpt_name: 'sd_xl_base_1.0.safetensors',
        },
      },
      {
        id: 'prompt',
        nodeType: 'CLIPTextEncode',
        displayName: 'Scene Description',
        description: 'Describe your landscape',
        icon: 'pi-pencil',
        exposedWidgets: ['text'],
        defaultValues: {
          text: 'Majestic mountain landscape at golden hour, dramatic clouds, photorealistic, 8k',
        },
      },
      {
        id: 'settings',
        nodeType: 'KSampler',
        displayName: 'Settings',
        icon: 'pi-sliders-h',
        exposedWidgets: ['seed', 'steps', 'cfg'],
        defaultValues: {
          seed: -1,
          steps: 25,
          cfg: 7,
          sampler_name: 'dpmpp_2m',
        },
      },
      {
        id: 'size',
        nodeType: 'EmptyLatentImage',
        displayName: 'Size',
        description: 'Wide format for landscapes',
        icon: 'pi-arrows-alt',
        exposedWidgets: ['width', 'height'],
        defaultValues: {
          width: 1344,
          height: 768,
          batch_size: 1,
        },
      },
      {
        id: 'output',
        nodeType: 'SaveImage',
        displayName: 'Save',
        icon: 'pi-download',
        exposedWidgets: ['filename_prefix'],
        defaultValues: {
          filename_prefix: 'landscape',
        },
      },
    ],
  },

  // ===== IMAGE TO IMAGE =====
  {
    id: 'img2img-basic',
    name: 'Image Variation',
    description: 'Create variations of an existing image',
    icon: 'pi-images',
    category: 'image-to-image',
    tags: ['variation', 'transform'],
    featured: true,
    thumbnailUrl: 'https://picsum.photos/seed/img2img/400/300',
    steps: [
      {
        id: 'model',
        nodeType: 'LoadCheckpoint',
        displayName: 'Model',
        icon: 'pi-box',
        exposedWidgets: ['ckpt_name'],
        defaultValues: {
          ckpt_name: 'sd_xl_base_1.0.safetensors',
        },
      },
      {
        id: 'prompt',
        nodeType: 'CLIPTextEncode',
        displayName: 'Style Guide',
        description: 'Describe the style transformation',
        icon: 'pi-pencil',
        exposedWidgets: ['text'],
        defaultValues: {
          text: 'Same scene, oil painting style, artistic, masterpiece',
        },
      },
      {
        id: 'settings',
        nodeType: 'KSampler',
        displayName: 'Transform Settings',
        description: 'Lower denoise = closer to original',
        icon: 'pi-sliders-h',
        exposedWidgets: ['seed', 'steps', 'cfg', 'denoise'],
        defaultValues: {
          seed: -1,
          steps: 20,
          cfg: 7,
          denoise: 0.6,
          sampler_name: 'euler',
        },
      },
      {
        id: 'output',
        nodeType: 'SaveImage',
        displayName: 'Save',
        icon: 'pi-download',
        exposedWidgets: ['filename_prefix'],
        defaultValues: {
          filename_prefix: 'variation',
        },
      },
    ],
  },

  // ===== UPSCALING =====
  {
    id: 'upscale-basic',
    name: 'Image Upscaler',
    description: 'Upscale images to higher resolution with AI enhancement',
    icon: 'pi-expand',
    category: 'upscaling',
    tags: ['upscale', 'enhance', '4k'],
    featured: true,
    thumbnailUrl: 'https://picsum.photos/seed/upscale/400/300',
    steps: [
      {
        id: 'model',
        nodeType: 'LoadCheckpoint',
        displayName: 'Model',
        icon: 'pi-box',
        exposedWidgets: ['ckpt_name'],
        defaultValues: {
          ckpt_name: 'sd_xl_base_1.0.safetensors',
        },
      },
      {
        id: 'prompt',
        nodeType: 'CLIPTextEncode',
        displayName: 'Enhancement Guide',
        description: 'Describe details to enhance',
        icon: 'pi-pencil',
        exposedWidgets: ['text'],
        defaultValues: {
          text: 'High quality, sharp details, 4k, ultra detailed',
        },
      },
      {
        id: 'settings',
        nodeType: 'KSampler',
        displayName: 'Upscale Settings',
        icon: 'pi-sliders-h',
        exposedWidgets: ['seed', 'steps', 'denoise'],
        defaultValues: {
          seed: -1,
          steps: 15,
          cfg: 5,
          denoise: 0.4,
          sampler_name: 'euler',
        },
      },
      {
        id: 'output',
        nodeType: 'SaveImage',
        displayName: 'Save',
        icon: 'pi-download',
        exposedWidgets: ['filename_prefix'],
        defaultValues: {
          filename_prefix: 'upscaled',
        },
      },
    ],
  },

  // ===== INPAINTING =====
  {
    id: 'inpaint-basic',
    name: 'Inpaint / Edit',
    description: 'Edit parts of an image using AI',
    icon: 'pi-pencil',
    category: 'inpainting',
    tags: ['inpaint', 'edit', 'fix'],
    featured: false,
    thumbnailUrl: 'https://picsum.photos/seed/inpaint/400/300',
    steps: [
      {
        id: 'model',
        nodeType: 'LoadCheckpoint',
        displayName: 'Model',
        icon: 'pi-box',
        exposedWidgets: ['ckpt_name'],
        defaultValues: {
          ckpt_name: 'sd_xl_base_1.0.safetensors',
        },
      },
      {
        id: 'prompt',
        nodeType: 'CLIPTextEncode',
        displayName: 'What to Paint',
        description: 'Describe what to add in the masked area',
        icon: 'pi-pencil',
        exposedWidgets: ['text'],
        defaultValues: {
          text: 'A beautiful flower, natural lighting, photorealistic',
        },
      },
      {
        id: 'settings',
        nodeType: 'KSampler',
        displayName: 'Inpaint Settings',
        icon: 'pi-sliders-h',
        exposedWidgets: ['seed', 'steps', 'cfg', 'denoise'],
        defaultValues: {
          seed: -1,
          steps: 25,
          cfg: 7,
          denoise: 0.8,
          sampler_name: 'euler',
        },
      },
      {
        id: 'output',
        nodeType: 'SaveImage',
        displayName: 'Save',
        icon: 'pi-download',
        exposedWidgets: ['filename_prefix'],
        defaultValues: {
          filename_prefix: 'inpainted',
        },
      },
    ],
  },
]

/**
 * Get template by ID
 */
export function getTemplateById(id: string): LinearWorkflowTemplate | undefined {
  return LINEAR_WORKFLOW_TEMPLATES.find((t) => t.id === id)
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: string
): LinearWorkflowTemplate[] {
  return LINEAR_WORKFLOW_TEMPLATES.filter((t) => t.category === category)
}

/**
 * Category display names and icons
 */
export const TEMPLATE_CATEGORIES = [
  { id: 'text-to-image', name: 'Text to Image', icon: 'pi-image' },
  { id: 'image-to-image', name: 'Image to Image', icon: 'pi-images' },
  { id: 'inpainting', name: 'Inpainting', icon: 'pi-pencil' },
  { id: 'upscaling', name: 'Upscaling', icon: 'pi-expand' },
  { id: 'video', name: 'Video', icon: 'pi-video' },
  { id: 'audio', name: 'Audio', icon: 'pi-volume-up' },
  { id: 'custom', name: 'Custom', icon: 'pi-cog' },
] as const
