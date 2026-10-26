import { cn } from '@comfyorg/tailwind-utils'

export const MEDIA_CONTROL =
  'focus-visible:ring-primary-comfy-yellow/50 grid size-8 cursor-pointer place-items-center rounded-lg bg-primary-comfy-ink/70 text-primary-warm-white backdrop-blur-sm transition-colors outline-none hover:text-primary-comfy-yellow focus-visible:ring-2'

export const outputStopClass = (active: boolean) =>
  cn(
    'flex size-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 text-xs text-primary-warm-white transition-opacity',
    active
      ? 'border-primary-comfy-yellow'
      : 'border-transparent opacity-60 hover:opacity-100'
  )
