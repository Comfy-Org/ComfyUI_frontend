interface BrandColor {
  name: string
  hex: string
  rgb: string
  hsl: string
  cmyk: string
  swatchClass: string
  textClass: string
  wide?: boolean
  border?: boolean
}

export const brandColors: readonly BrandColor[] = [
  {
    name: 'Comfy Yellow',
    hex: '#F2FF59',
    rgb: '242, 255, 89',
    hsl: '65, 100, 67',
    cmyk: '5, 0, 65, 0',
    swatchClass: 'bg-primary-comfy-yellow',
    textClass: 'text-primary-comfy-ink',
    wide: true
  },
  {
    name: 'Comfy Ink',
    hex: '#211927',
    rgb: '33, 25, 39',
    hsl: '274, 22, 13',
    cmyk: '15, 36, 0, 85',
    swatchClass: 'bg-primary-comfy-ink',
    textClass: 'text-primary-warm-white',
    border: true
  },
  {
    name: 'Comfy Canvas',
    hex: '#C2BFB9',
    rgb: '194, 191, 185',
    hsl: '40, 7, 74',
    cmyk: '0, 2, 5, 24',
    swatchClass: 'bg-primary-comfy-canvas',
    textClass: 'text-primary-comfy-ink'
  },
  {
    name: 'Comfy Plum',
    hex: '#49378B',
    rgb: '73, 55, 139',
    hsl: '253, 43, 38',
    cmyk: '47, 60, 0, 45',
    swatchClass: 'bg-primary-comfy-plum',
    textClass: 'text-primary-comfy-canvas'
  },
  {
    name: 'Warm White',
    hex: '#F0EFED',
    rgb: '240, 239, 237',
    hsl: '40, 9, 94',
    cmyk: '0, 0, 1, 6',
    swatchClass: 'bg-primary-warm-white',
    textClass: 'text-primary-comfy-ink',
    wide: true
  },
  {
    name: 'Warm Gray',
    hex: '#7E7C78',
    rgb: '126, 124, 120',
    hsl: '40, 2, 48',
    cmyk: '0, 2, 5, 51',
    swatchClass: 'bg-primary-warm-gray',
    textClass: 'text-primary-warm-white',
    border: true
  },
  {
    name: 'Cool Gray',
    hex: '#3C3C3C',
    rgb: '60, 60, 60',
    hsl: '0, 0, 24',
    cmyk: '0, 0, 0, 76',
    swatchClass: 'bg-secondary-cool-gray',
    textClass: 'text-primary-warm-white',
    border: true
  },
  {
    name: 'Mauve',
    hex: '#4D3762',
    rgb: '77, 55, 98',
    hsl: '271, 28, 30',
    cmyk: '21, 44, 0, 62',
    swatchClass: 'bg-secondary-mauve',
    textClass: 'text-primary-warm-white'
  }
] as const
