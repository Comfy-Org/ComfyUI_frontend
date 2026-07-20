import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UseMouseSourceType } from '@vueuse/core'
import { useMouseInElement } from '@vueuse/core'
import { nextTick, ref } from 'vue'

import { useSliderFromMouse } from './useSliderFromMouse'

vi.mock('@vueuse/core', () => ({
  useMouseInElement: vi.fn()
}))

const elementX = ref(0)
const elementWidth = ref(100)
const isOutside = ref(true)

vi.mocked(useMouseInElement).mockReturnValue(
  fromPartial({
    elementX,
    elementY: ref(0),
    elementPositionX: ref(0),
    elementPositionY: ref(0),
    elementHeight: ref(0),
    elementWidth,
    isOutside,
    sourceType: ref<UseMouseSourceType>(null)
  })
)

describe('useSliderFromMouse', () => {
  beforeEach(() => {
    elementX.value = 0
    elementWidth.value = 100
    isOutside.value = true
  })

  it('updates from mouse position while pointer is inside the target', async () => {
    const target = ref(document.createElement('div'))
    const position = useSliderFromMouse(target)

    isOutside.value = false
    elementX.value = 25
    elementWidth.value = 100
    await nextTick()

    expect(position.value).toBe(25)
  })

  it('ignores pointer updates outside the target or without width', async () => {
    const target = ref(document.createElement('div'))
    const position = useSliderFromMouse(target)

    isOutside.value = true
    elementX.value = 10
    elementWidth.value = 100
    await nextTick()
    expect(position.value).toBe(50)

    isOutside.value = false
    elementWidth.value = 0
    await nextTick()
    expect(position.value).toBe(50)
  })
})
