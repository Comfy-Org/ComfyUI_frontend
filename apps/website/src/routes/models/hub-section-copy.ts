import type { HubSection } from '@/lib/workshop/hub-section'

// Server-rendered only: translations.ts ships whole to every island, so page head copy lives here.
export const HUB_SECTION_COPY = {
  explore: {
    title: 'Comfy Hub: AI Apps, Workflows & Models - Comfy',
    description:
      'Find a starting point in the Comfy Hub: ready-made apps, workflows you can control step by step, and models you can call by API.',
    heading: 'What do you want to make?'
  },
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
  Exclude<HubSection, 'models'>,
  Readonly<Record<'title' | 'description' | 'heading', string>>
>
