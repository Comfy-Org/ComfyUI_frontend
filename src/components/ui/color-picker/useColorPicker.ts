import { clamp } from 'es-toolkit'
import type { Ref } from 'vue'
import { computed, reactive, ref, watch } from 'vue'

import type { HSVA } from '@/utils/colorUtil'
import {
  hexToHsva,
  hsbToRgb,
  normalizeHex,
  rgbToHex,
  rgbToHsv
} from '@/utils/colorUtil'

export const rgbChannels = [
  { key: 'r', label: 'color.red' },
  { key: 'g', label: 'color.green' },
  { key: 'b', label: 'color.blue' }
] as const

function useDraftField<T>(source: () => T, apply: (draft: T) => void) {
  const draft = ref(source()) as Ref<T>
  const isEditing = ref(false)

  watch(source, (value) => {
    if (!isEditing.value) draft.value = value
  })

  return reactive({
    draft,
    beginEdit: () => {
      isEditing.value = true
    },
    commit: () => apply(draft.value),
    reset: () => {
      isEditing.value = false
      draft.value = source()
    }
  })
}

export function useColorPicker(hsva: Ref<HSVA>) {
  const rgb = computed(() =>
    hsbToRgb({ h: hsva.value.h, s: hsva.value.s, b: hsva.value.v })
  )
  const hexString = computed(() => rgbToHex(rgb.value).toLowerCase())

  const hex = useDraftField(
    () => hexString.value,
    (draft) => {
      const normalized = normalizeHex(draft)
      if (!normalized) return
      const next = hexToHsva(normalized)
      hsva.value = { ...hsva.value, h: next.h, s: next.s, v: next.v }
    }
  )

  const rgbField = useDraftField(
    () => ({ ...rgb.value }),
    ({ r, g, b }) => {
      if (![r, g, b].every(Number.isFinite)) return
      const hsv = rgbToHsv({
        r: clamp(Math.round(r), 0, 255),
        g: clamp(Math.round(g), 0, 255),
        b: clamp(Math.round(b), 0, 255)
      })
      hsva.value = { ...hsva.value, h: hsv.h, s: hsv.s, v: hsv.v }
    }
  )

  const alpha = useDraftField(
    () => hsva.value.a,
    (draft) => {
      if (!Number.isFinite(draft)) return
      hsva.value = { ...hsva.value, a: clamp(Math.round(draft), 0, 100) }
    }
  )

  return { hex, rgb: rgbField, alpha }
}
