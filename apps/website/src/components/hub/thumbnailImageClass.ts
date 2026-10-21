import { cn } from '@comfyorg/tailwind-utils'

import type { ThumbnailVariant } from '@/lib/hub/types'

export function thumbnailImageClass(variant?: ThumbnailVariant) {
  return cn(
    'size-full object-cover transition-transform select-none',
    variant === 'zoomHover' || variant === 'hoverZoom'
      ? 'duration-500 group-hover:scale-125'
      : 'duration-300 group-hover:scale-105'
  )
}
