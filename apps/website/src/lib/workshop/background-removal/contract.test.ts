import { describe, expect, it } from 'vitest'

import type { CutoutSetup } from './contract'
import {
  DEFAULT_ADJUST,
  DEFAULT_SETUP,
  adjustFilter,
  backgroundSwatch,
  cutoutFileName,
  cutoutRequest,
  missingInput
} from './contract'

const base = {
  imageUrl: '/photo.jpg',
  format: 'webp',
  edgeSoftness: DEFAULT_SETUP.edgeSoftness
} as const

describe('cutoutRequest', () => {
  it.for([
    {
      mode: 'remove',
      expected: { mode: 'remove', background: { kind: 'transparent' } }
    },
    {
      mode: 'replace',
      expected: { mode: 'replace', replace: DEFAULT_SETUP.replace }
    },
    { mode: 'adjust', expected: { mode: 'adjust', adjust: DEFAULT_ADJUST } }
  ] as const)('sends only the $mode settings', ({ mode, expected }) => {
    expect(
      cutoutRequest('/photo.jpg', { ...DEFAULT_SETUP, mode, format: 'webp' })
    ).toEqual({ ...base, ...expected })
  })
})

describe('backgroundSwatch', () => {
  it.for([
    { background: { kind: 'transparent' }, swatch: 'transparent' },
    { background: { kind: 'color', color: '#d9ccf5' }, swatch: 'lilac' },
    { background: { kind: 'color', color: '#123456' }, swatch: undefined }
  ] as const)('reads $background.kind as $swatch', ({ background, swatch }) => {
    expect(backgroundSwatch(background)?.id).toBe(swatch)
  })
})

describe('adjustFilter', () => {
  const px = (share: number) => `${share * 1000}px`

  it('is none at the defaults', () => {
    expect(adjustFilter(DEFAULT_ADJUST, px)).toBe('none')
  })

  it('writes every changed value as a CSS filter, blur as a share of the width', () => {
    expect(
      adjustFilter(
        {
          target: 'foreground',
          blur: 50,
          grayscale: 30,
          sepia: 10,
          brightness: 120,
          contrast: 80,
          saturation: 0
        },
        px
      )
    ).toBe(
      'blur(15px) grayscale(30%) sepia(10%) brightness(120%) contrast(80%) saturate(0%)'
    )
  })
})

describe('missingInput', () => {
  const replace = (patch: Partial<CutoutSetup['replace']>): CutoutSetup => ({
    ...DEFAULT_SETUP,
    mode: 'replace',
    replace: { ...DEFAULT_SETUP.replace, ...patch }
  })

  it.for([
    { name: 'Remove', setup: DEFAULT_SETUP, missing: undefined },
    {
      name: 'an empty Replace',
      setup: replace({ prompt: '  ' }),
      missing: 'replace'
    },
    {
      name: 'a described Replace',
      setup: replace({ prompt: 'a beach' }),
      missing: undefined
    },
    {
      name: 'a referenced Replace',
      setup: replace({ referenceUrl: 'blob:ref' }),
      missing: undefined
    }
  ])('$name misses $missing', ({ setup, missing }) => {
    expect(missingInput(setup)).toBe(missing)
  })
})

describe('cutoutFileName', () => {
  it.for([
    {
      name: 'potted-plant.jpg',
      mode: 'remove',
      format: 'png',
      file: 'potted-plant-cutout.png'
    },
    {
      name: 'shoe.final.jpeg',
      mode: 'replace',
      format: 'webp',
      file: 'shoe.final-new-background.webp'
    },
    { name: 'scan', mode: 'adjust', format: 'png', file: 'scan-adjusted.png' },
    { name: '.jpg', mode: 'remove', format: 'png', file: 'image-cutout.png' }
  ] as const)(
    'names $name in $mode as $file',
    ({ name, mode, format, file }) => {
      expect(cutoutFileName(name, mode, format)).toBe(file)
    }
  )
})
