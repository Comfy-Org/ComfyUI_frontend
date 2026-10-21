import type { CatalogueTab } from '@/components/workshop/CatalogueTabs.vue'

export const HUB_SECTION_COPY = {
  workflows: { heading: 'ComfyUI workflows' },
  apps: { heading: 'ComfyUI apps' }
} as const satisfies Record<
  Exclude<CatalogueTab, 'models'>,
  Readonly<Record<'heading', string>>
>
