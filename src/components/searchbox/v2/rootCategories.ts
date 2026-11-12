import { BLUEPRINT_CATEGORY } from '@/types/nodeSource'

export const RootCategory = {
  Favorites: 'favorites',
  Comfy: 'comfy',
  Custom: 'custom',
  Essentials: 'essentials',
  PartnerNodes: 'partner-nodes',
  Blueprint: BLUEPRINT_CATEGORY
} as const

export type RootCategoryId = (typeof RootCategory)[keyof typeof RootCategory]
