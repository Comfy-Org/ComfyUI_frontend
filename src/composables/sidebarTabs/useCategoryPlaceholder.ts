import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetModelType } from '@/platform/assets/utils/assetMetadataUtils'

// Three-color gradient placeholders, one per category. Used in the model
// library hover popover when neither a native nor a curated thumbnail is
// available so the user still gets a visual cue tied to the model type.

type Palette = readonly [string, string, string]

const CATEGORY_PALETTES: Record<string, Palette> = {
  loras: ['#ec4899', '#a855f7', '#6366f1'],
  vae: ['#06b6d4', '#0891b2', '#0e7490'],
  text_encoders: ['#f59e0b', '#dc2626', '#7c2d12'],
  diffusion_models: ['#10b981', '#059669', '#064e3b'],
  checkpoints: ['#8b5cf6', '#7c3aed', '#5b21b6'],
  controlnet: ['#0ea5e9', '#0284c7', '#075985'],
  ipadapter: ['#f43f5e', '#e11d48', '#9f1239'],
  upscale_models: ['#eab308', '#ca8a04', '#854d0e'],
  depthanything: ['#84cc16', '#65a30d', '#365314'],
  florence2: ['#a78bfa', '#7c3aed', '#4c1d95'],
  sam3d: ['#34d399', '#14b8a6', '#0f766e'],
  geometry_estimation: ['#fb923c', '#f97316', '#9a3412'],
  model_patches: ['#94a3b8', '#64748b', '#334155'],
  smol: ['#fde047', '#facc15', '#a16207'],
  LLM: ['#f97316', '#ea580c', '#7c2d12']
}

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function paletteFromHash(category: string): Palette {
  const base = hashString(category) % 360
  return [
    `hsl(${base}, 70%, 55%)`,
    `hsl(${(base + 40) % 360}, 65%, 45%)`,
    `hsl(${(base + 80) % 360}, 60%, 35%)`
  ]
}

function topLevel(category: string): string {
  return category.split('/')[0]
}

export function placeholderGradientForCategory(category: string): string {
  const key = topLevel(category)
  const palette = CATEGORY_PALETTES[key] ?? paletteFromHash(key)
  return `linear-gradient(135deg, ${palette[0]}, ${palette[1]}, ${palette[2]})`
}

export function placeholderCategoryForAsset(asset: AssetItem): string {
  return getAssetModelType(asset) ?? 'unknown'
}
