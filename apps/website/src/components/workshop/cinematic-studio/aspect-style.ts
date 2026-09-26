import type { AspectRatio } from '../../../lib/workshop/cinematic-studio/catalog'

export const aspectStyle = (aspect: AspectRatio) => ({
  aspectRatio: aspect.replace(':', ' / ')
})

export function framedStyle(aspect: AspectRatio, maxHeight: string) {
  const [width, height] = aspect.split(':')
  return {
    ...aspectStyle(aspect),
    width: `min(100%, calc(${maxHeight} * ${width} / ${height}))`
  }
}
