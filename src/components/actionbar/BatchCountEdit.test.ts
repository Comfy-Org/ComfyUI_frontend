import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useQueueSettingsStore } from '@/stores/queueStore'

import BatchCountEdit from './BatchCountEdit.vue'

const maxBatchCount = 16

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (settingId: string) =>
      settingId === 'Comfy.QueueButton.BatchCountLimit' ? maxBatchCount : 1
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        increment: 'Increment',
        decrement: 'Decrement'
      },
      menu: {
        batchCount: 'Batch Count'
      }
    }
  }
})

function createWrapper(initialBatchCount = 1) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: false,
    initialState: {
      queueSettingsStore: {
        batchCount: initialBatchCount
      }
    }
  })

  const wrapper = mount(BatchCountEdit, {
    global: {
      plugins: [pinia, i18n],
      directives: {
        tooltip: () => {}
      }
    }
  })

  const queueSettingsStore = useQueueSettingsStore()

  return { wrapper, queueSettingsStore }
}

describe('BatchCountEdit', () => {
  it('doubles the current batch count when increment is clicked', async () => {
    const { wrapper, queueSettingsStore } = createWrapper(3)

    await wrapper.get('button[aria-label="Increment"]').trigger('click')

    expect(queueSettingsStore.batchCount).toBe(6)
  })

  it('halves the current batch count when decrement is clicked', async () => {
    const { wrapper, queueSettingsStore } = createWrapper(9)

    await wrapper.get('button[aria-label="Decrement"]').trigger('click')

    expect(queueSettingsStore.batchCount).toBe(4)
  })

  it('clamps typed values to queue limits on blur', async () => {
    const { wrapper, queueSettingsStore } = createWrapper(2)
    const input = wrapper.get('input')

    await input.setValue('999')
    await input.trigger('blur')
    await nextTick()

    expect(queueSettingsStore.batchCount).toBe(maxBatchCount)
    expect((input.element as HTMLInputElement).value).toBe(
      String(maxBatchCount)
    )

    await input.setValue('0')
    await input.trigger('blur')
    await nextTick()

    expect(queueSettingsStore.batchCount).toBe(1)
    expect((input.element as HTMLInputElement).value).toBe('1')
  })
})
