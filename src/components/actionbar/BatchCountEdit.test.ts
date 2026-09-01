import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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

function renderComponent(initialBatchCount = 1) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: false,
    initialState: {
      queueSettingsStore: {
        batchCount: initialBatchCount
      }
    }
  })

  const user = userEvent.setup()

  render(BatchCountEdit, {
    global: {
      plugins: [pinia, i18n],
      directives: {
        tooltip: () => {}
      }
    }
  })

  const queueSettingsStore = useQueueSettingsStore()

  return { user, queueSettingsStore }
}

describe('BatchCountEdit', () => {
  it('doubles the current batch count when increment is clicked', async () => {
    const { user, queueSettingsStore } = renderComponent(3)

    await user.click(screen.getByRole('button', { name: 'Increment' }))

    expect(queueSettingsStore.batchCount).toBe(6)
  })

  it('halves the current batch count when decrement is clicked', async () => {
    const { user, queueSettingsStore } = renderComponent(9)

    await user.click(screen.getByRole('button', { name: 'Decrement' }))

    expect(queueSettingsStore.batchCount).toBe(4)
  })

  it('clamps typed values to queue limits on blur', async () => {
    const { user, queueSettingsStore } = renderComponent(2)
    const input = screen.getByRole('textbox', { name: 'Batch Count' })

    await user.clear(input)
    await user.type(input, '999')
    await user.tab()

    expect(queueSettingsStore.batchCount).toBe(maxBatchCount)
    expect(input).toHaveValue(String(maxBatchCount))

    await user.clear(input)
    await user.type(input, '0')
    await user.tab()

    expect(queueSettingsStore.batchCount).toBe(1)
    expect(input).toHaveValue('1')
  })
})
