import { describe, expect, it } from 'vitest'

import { thumbnailImageClass } from './thumbnailImageClass'

describe('thumbnailImageClass', () => {
  it.for([
    { variant: 'zoomHover', zoom: 'group-hover:scale-125' },
    { variant: 'hoverZoom', zoom: 'group-hover:scale-125' },
    { variant: 'compareSlider', zoom: 'group-hover:scale-105' },
    { variant: undefined, zoom: 'group-hover:scale-105' }
  ] as const)('zooms a $variant still by $zoom', ({ variant, zoom }) => {
    expect(thumbnailImageClass(variant).split(' ')).toContain(zoom)
  })
})
