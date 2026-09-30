import type { CatalogueTab } from '../../components/workshop/CatalogueTabs.vue'

type Localized = Readonly<Record<'en' | 'zh-CN', string>>

// Server-rendered only: translations.ts ships whole to every island, so page head copy lives here.
export const HUB_SECTION_COPY = {
  workflows: {
    title: {
      en: 'ComfyUI Workflows: Multi-Step AI Image & Video Workflows - Comfy',
      'zh-CN': 'ComfyUI 工作流：多步骤 AI 图像与视频工作流 - Comfy'
    },
    description: {
      en: 'Browse ComfyUI workflows that chain AI models into finished images and videos, and run any of them right in your browser.',
      'zh-CN':
        '浏览把多个 AI 模型串联成完整图像和视频的 ComfyUI 工作流，并直接在浏览器中运行任意一个。'
    },
    heading: { en: 'ComfyUI workflows', 'zh-CN': 'ComfyUI 工作流' }
  },
  apps: {
    title: {
      en: 'ComfyUI Apps: Creative Tools Built from Workflows - Comfy',
      'zh-CN': 'ComfyUI 应用：由工作流组合而成的创作工具 - Comfy'
    },
    description: {
      en: 'Take on bigger ideas with ComfyUI apps that bring multiple workflows together, and open them right in your browser.',
      'zh-CN':
        '用把多个工作流组合在一起的 ComfyUI 应用挑战更大的想法，并直接在浏览器中打开它们。'
    },
    heading: { en: 'ComfyUI apps', 'zh-CN': 'ComfyUI 应用' }
  }
} as const satisfies Record<
  Exclude<CatalogueTab, 'models'>,
  Readonly<Record<'title' | 'description' | 'heading', Localized>>
>
