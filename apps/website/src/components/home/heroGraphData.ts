import type { TranslationKey } from '../../i18n/translations'

interface NodeImage {
  src: string
  altKey: TranslationKey
}

export interface ImageVariant extends NodeImage {
  id: string
  // Names the input in baked-render filenames (output-<key>-<preset>….webp).
  key: string
  // The result this input produces, shown in the OUTPUT node. Swapping the
  // input cascades its matching output through the graph.
  output: NodeImage
}

export const imageVariants = [
  {
    id: 'v1',
    key: 'portrait',
    src: '/images/hero/input-portrait.png',
    altKey: 'hero.image.variant1',
    output: {
      src: '/images/hero/output-cyberpunk.png',
      altKey: 'hero.output.variant1'
    }
  },
  {
    id: 'v2',
    key: 'vase',
    src: '/images/hero/input-vase.png',
    altKey: 'hero.image.variant2',
    output: {
      src: '/images/hero/output-vase.png',
      altKey: 'hero.output.variant2'
    }
  },
  {
    id: 'v3',
    key: 'deer',
    src: '/images/hero/input-deer.png',
    altKey: 'hero.image.variant3',
    output: {
      src: '/images/hero/output-deer.png',
      altKey: 'hero.output.variant3'
    }
  },
  {
    id: 'v4',
    key: 'mirror',
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

// Real ComfyUI renders for control combinations, listed as they are generated
// and dropped into public/images/hero/. Keys are `<variant>/<preset>` or
// `<variant>/<preset>/<lightMode>`; the matching file is
// `output-<variant>-<preset>[-<lightMode>].webp`. Combos not listed here fall
// back to the base output with the CSS preview grade.
const bakedRenderKeys: ReadonlySet<string> = new Set()

export interface BakedRender {
  src: string
  // True when the render already contains the selected light mode, so the CSS
  // light overlay only needs to hint at direction instead of faking the look.
  includesLight: boolean
}

export function resolveBakedRender(
  variantKey: string,
  presetId: string,
  lightModeId: string,
  keys: ReadonlySet<string> = bakedRenderKeys
): BakedRender | null {
  if (keys.has(`${variantKey}/${presetId}/${lightModeId}`)) {
    return {
      src: `/images/hero/output-${variantKey}-${presetId}-${lightModeId}.webp`,
      includesLight: true
    }
  }
  if (keys.has(`${variantKey}/${presetId}`)) {
    return {
      src: `/images/hero/output-${variantKey}-${presetId}.webp`,
      includesLight: false
    }
  }
  return null
}
