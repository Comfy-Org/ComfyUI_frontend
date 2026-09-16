import { describe, expect, it } from 'vitest'
import { computed, reactive, ref } from 'vue'

import { resetBeforeEachTest, runMockStateResets } from './mockStateReset'

describe('runMockStateResets', () => {
  it('restores registered state in place so held references see the reset', () => {
    const flags = reactive({ enabled: false, label: 'a' })
    const count = ref(0)
    const derived = computed(() => (flags.enabled ? count.value : -1))
    resetBeforeEachTest(() => {
      Object.assign(flags, { enabled: false, label: 'a' })
      count.value = 0
    })

    flags.enabled = true
    flags.label = 'b'
    count.value = 3
    expect(derived.value).toBe(3)

    runMockStateResets()

    expect(flags).toEqual({ enabled: false, label: 'a' })
    expect(derived.value).toBe(-1)
  })

  it('registers the same reset once', () => {
    let runs = 0
    const reset = () => {
      runs++
    }
    resetBeforeEachTest(reset)
    resetBeforeEachTest(reset)

    runMockStateResets()

    expect(runs).toBe(1)
  })
})
