import type { AspectRatio } from '../../../lib/workshop/cinematic-studio/catalog'

export const aspectStyle = (aspect: AspectRatio) => ({
  aspectRatio: aspect.replace(':', ' / ')
})
