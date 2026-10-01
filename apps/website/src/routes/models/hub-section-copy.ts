import type { CatalogueTab } from '../../components/workshop/CatalogueTabs.vue'

// Server-rendered only: translations.ts ships whole to every island, so page head copy lives here.
export const HUB_SECTION_COPY = {
  workflows: {
    title: 'ComfyUI Workflows: Multi-Step AI Image & Video Workflows - Comfy',
    description:
      'Browse ComfyUI workflows that chain AI models into finished images and videos, and run any of them right in your browser.',
    heading: 'ComfyUI workflows'
  },
  apps: {
    title: 'ComfyUI Apps: Creative Tools Built from Workflows - Comfy',
    description:
      'Take on bigger ideas with ComfyUI apps that bring multiple workflows together, and open them right in your browser.',
    heading: 'ComfyUI apps'
  }
} as const satisfies Record<
  Exclude<CatalogueTab, 'models'>,
  Readonly<Record<'title' | 'description' | 'heading', string>>
>
