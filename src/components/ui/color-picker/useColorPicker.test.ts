import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import type { HSVA } from '@/utils/colorUtil'

import { useColorPicker } from './useColorPicker'

const black: HSVA = { h: 0, s: 0, v: 0, a: 100 }

function setup(initial: HSVA) {
  const hsva = ref<HSVA>(initial)
  const scope = effectScope()
  const api = scope.run(() => useColorPicker(hsva))!
  return { hsva, api, stop: () => scope.stop() }
}

describe('useColorPicker', () => {
  it('commits a valid hex and ignores malformed input', () => {
    const { hsva, api } = setup({ ...black })

    api.hex.draft = '#00ff00'
    api.hex.commit()
    expect(hsva.value).toMatchObject({ h: 120, s: 100, v: 100 })

    const unchanged = hsva.value
    api.hex.draft = 'zzz'
    api.hex.commit()
    expect(hsva.value).toBe(unchanged)
  })

  it('clamps rgb channels before converting to hsv', () => {
    const { hsva, api } = setup({ ...black })

    api.rgb.draft.r = 300
    api.rgb.commit()

    expect(hsva.value).toMatchObject({ h: 0, s: 100, v: 100 })
  })

  it('clamps alpha to the 0..100 range', () => {
    const { hsva, api } = setup({ h: 0, s: 0, v: 0, a: 100 })

    api.alpha.draft = 150
    api.alpha.commit()

    expect(hsva.value.a).toBe(100)
  })

  it('syncs the draft from the model when not editing', async () => {
    const { hsva, api } = setup({ ...black })

    hsva.value = { ...hsva.value, h: 0, s: 100, v: 100 }
    await nextTick()

    expect(api.hex.draft).toBe('#ff0000')
  })

  it('freezes the draft against external model changes while editing', async () => {
    const { hsva, api } = setup({ ...black })

    api.hex.beginEdit()
    api.hex.draft = '#123456'
    hsva.value = { h: 0, s: 100, v: 100, a: 100 }
    await nextTick()

    expect(api.hex.draft).toBe('#123456')
  })

  it('resyncs the draft to the model on reset', () => {
    const { api } = setup({ ...black })

    api.hex.beginEdit()
    api.hex.draft = '#abcdef'
    api.hex.reset()

    expect(api.hex.draft).toBe('#000000')
  })
})
