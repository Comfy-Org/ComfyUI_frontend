import { ComfyApp } from '@/scripts/app'

export type { ComfyExtension } from './comfy'
export type { ComfyApi } from '@/scripts/api'
export type { ComfyApp } from '@/scripts/app'

declare global {
  const app: ComfyApp
}
