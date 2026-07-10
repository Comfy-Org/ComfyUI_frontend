import type { LogoItem } from '../components/blocks/LogosAll01.vue'

const names = [
  'Amazon Studios',
  'Apple',
  'Autodesk',
  'Harman',
  'Hp',
  'Lucid',
  'Netflix',
  'Nike',
  'Pixomondo',
  'Tencent',
  'Ubisoft'
]

export const clientLogos: readonly LogoItem[] = names.map((name) => ({
  src: `/icons/clients/${name}.svg`,
  alt: name
}))
