import { usePreferredReducedMotion } from '@vueuse/core'
import { clamp } from 'es-toolkit'
import { computed, ref } from 'vue'
import type { CSSProperties } from 'vue'

import type { Point } from './heroGraphWires'
import type { TranslationKey } from '../../i18n/translations'

type ColorPresetId = 'cyberpunk' | 'film' | 'dream' | 'editorial'
type LightModeId = 'soft' | 'rim' | 'neon' | 'studio'
type HeroNodeId = 'color' | 'lighting'

interface ColorPreset {
  id: ColorPresetId
  labelKey: TranslationKey
  saturate: number
  contrast: number
  hue: number
  blend: CSSProperties['mixBlendMode']
}

interface ColorSwatch {
  id: string
  labelKey: TranslationKey
  // Space-separated RGB channels, ready for `rgb(<rgb> / <alpha>)`.
  rgb: string
}

interface LightMode {
  id: LightModeId
  labelKey: TranslationKey
  spread: number
  core: number
  rim: number
  tint: string
}

export const colorPresets: ColorPreset[] = [
  {
    id: 'cyberpunk',
    labelKey: 'hero.color.preset.cyberpunk',
    saturate: 1.3,
    contrast: 1.1,
    hue: 8,
    blend: 'overlay'
  },
  {
    id: 'film',
    labelKey: 'hero.color.preset.film',
    saturate: 0.9,
    contrast: 1.2,
    hue: -6,
    blend: 'overlay'
  },
  {
    id: 'dream',
    labelKey: 'hero.color.preset.dream',
    saturate: 1.2,
    contrast: 0.95,
    hue: 22,
    blend: 'soft-light'
  },
  {
    id: 'editorial',
    labelKey: 'hero.color.preset.editorial',
    saturate: 0.78,
    contrast: 1.08,
    hue: 0,
    blend: 'overlay'
  }
]

export const colorSwatches: ColorSwatch[] = [
  { id: 'magenta', labelKey: 'hero.color.swatch.magenta', rgb: '255 0 140' },
  { id: 'cyan', labelKey: 'hero.color.swatch.cyan', rgb: '0 209 255' },
  { id: 'lime', labelKey: 'hero.color.swatch.lime', rgb: '170 255 90' },
  { id: 'amber', labelKey: 'hero.color.swatch.amber', rgb: '255 176 74' },
  { id: 'violet', labelKey: 'hero.color.swatch.violet', rgb: '150 110 255' }
]

export const lightModes: LightMode[] = [
  {
    id: 'soft',
    labelKey: 'hero.light.mode.soft',
    spread: 72,
    core: 0.4,
    rim: 0,
    tint: '255 244 224'
  },
  {
    id: 'rim',
    labelKey: 'hero.light.mode.rim',
    spread: 56,
    core: 0.3,
    rim: 0.55,
    tint: '176 214 255'
  },
  {
    id: 'neon',
    labelKey: 'hero.light.mode.neon',
    spread: 62,
    core: 0.5,
    rim: 0.3,
    tint: '206 120 255'
  },
  {
    id: 'studio',
    labelKey: 'hero.light.mode.studio',
    spread: 88,
    core: 0.62,
    rim: 0,
    tint: '255 255 255'
  }
]

// Centralizes the hero's interactive grade so the desktop graph and the mobile
// column drive the same OUTPUT overlays. Returns plain refs (mutated directly by
// the node controls) plus computed CSS the output frame binds inline.
export function useHeroControls() {
  const motionPref = usePreferredReducedMotion()
  const reducedMotion = computed(() => motionPref.value === 'reduce')

  const colorPresetId = ref<ColorPresetId>('cyberpunk')
  const swatchId = ref(colorSwatches[0].id)
  const colorIntensity = ref(72)

  const lightModeId = ref<LightModeId>('neon')
  const lightIntensity = ref(58)
  const lightDir = ref<Point>({ x: 0.64, y: 0.3 })

  const activeNode = ref<HeroNodeId | null>(null)
  // Cursor position over the output (0..1), letting the light drift toward the
  // pointer on fine-pointer devices; null when absent or motion-reduced.
  const pointer = ref<Point | null>(null)

  const colorPreset = computed(
    () =>
      colorPresets.find((p) => p.id === colorPresetId.value) ?? colorPresets[0]
  )
  const swatch = computed(
    () => colorSwatches.find((s) => s.id === swatchId.value) ?? colorSwatches[0]
  )
  const lightMode = computed(
    () => lightModes.find((m) => m.id === lightModeId.value) ?? lightModes[0]
  )

  const outputFilter = computed(() => {
    const c = colorIntensity.value / 100
    const l = lightIntensity.value / 100
    const p = colorPreset.value
    const saturate = 1 + (p.saturate - 1) * c
    const contrast = 1 + (p.contrast - 1) * c
    const hue = p.hue * c
    const brightness = 1 + l * (lightMode.value.core - 0.3) * 0.45
    return `saturate(${saturate.toFixed(3)}) contrast(${contrast.toFixed(3)}) hue-rotate(${hue.toFixed(1)}deg) brightness(${brightness.toFixed(3)})`
  })

  const colorLayerStyle = computed<CSSProperties>(() => ({
    backgroundImage: `linear-gradient(125deg, rgb(${swatch.value.rgb} / 0.55), rgb(${swatch.value.rgb} / 0.06) 72%)`,
    mixBlendMode: colorPreset.value.blend,
    opacity: (colorIntensity.value / 100) * 0.5
  }))

  const lightPos = computed<Point>(() => {
    const base = lightDir.value
    const p = pointer.value
    if (!p || reducedMotion.value) return base
    return {
      x: base.x + (p.x - base.x) * 0.3,
      y: base.y + (p.y - base.y) * 0.3
    }
  })

  const lightLayerStyle = computed<CSSProperties>(() => {
    const m = lightMode.value
    const x = (lightPos.value.x * 100).toFixed(1)
    const y = (lightPos.value.y * 100).toFixed(1)
    const layers = [
      `radial-gradient(circle at ${x}% ${y}%, rgb(${m.tint} / 0.9), transparent ${m.spread}%)`
    ]
    if (m.rim > 0) {
      layers.push(
        `linear-gradient(105deg, transparent 58%, rgb(${m.tint} / ${m.rim}))`
      )
    }
    return {
      backgroundImage: layers.join(', '),
      opacity: (lightIntensity.value / 100) * 0.72
    }
  })

  function setLightFromUnit(x: number, y: number) {
    const dx = x - 0.5
    const dy = y - 0.5
    const dist = Math.hypot(dx, dy)
    const max = 0.5
    const scaled = dist > max ? max / dist : 1
    lightDir.value = {
      x: clamp(0.5 + dx * scaled, 0, 1),
      y: clamp(0.5 + dy * scaled, 0, 1)
    }
  }

  return {
    reducedMotion,
    colorPresetId,
    swatchId,
    colorIntensity,
    lightModeId,
    lightIntensity,
    lightDir,
    lightMode,
    activeNode,
    pointer,
    outputFilter,
    colorLayerStyle,
    lightLayerStyle,
    setLightFromUnit
  }
}

export type HeroControls = ReturnType<typeof useHeroControls>
