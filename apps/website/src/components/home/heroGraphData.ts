import type { TranslationKey } from '../../i18n/translations'

interface NodeImage {
  src: string
  altKey: TranslationKey
}

export interface ImageVariant extends NodeImage {
  id: string
  // The result this input produces, shown in the OUTPUT node. Swapping the
  // input cascades its matching output through the graph.
  output: NodeImage
}

export const imageVariants = [
  {
    id: 'v1',
    src: '/images/hero/input-portrait.png',
    altKey: 'hero.image.variant1',
    output: {
      src: '/images/hero/output-cyberpunk.png',
      altKey: 'hero.output.variant1'
    }
  },
  {
    id: 'v2',
    src: '/images/hero/input-vase.png',
    altKey: 'hero.image.variant2',
    output: {
      src: '/images/hero/output-vase.png',
      altKey: 'hero.output.variant2'
    }
  },
  {
    id: 'v3',
    src: '/images/hero/input-deer.png',
    altKey: 'hero.image.variant3',
    output: {
      src: '/images/hero/output-deer.png',
      altKey: 'hero.output.variant3'
    }
  },
  {
    id: 'v4',
    src: '/images/hero/input-mirror.png',
    altKey: 'hero.image.variant4',
    output: {
      src: '/images/hero/output-mirror.png',
      altKey: 'hero.output.variant4'
    }
  }
] as const satisfies readonly ImageVariant[]

export const textureImage: NodeImage = {
  src: '/images/hero/input-vase.png',
  altKey: 'hero.image.texture'
}
