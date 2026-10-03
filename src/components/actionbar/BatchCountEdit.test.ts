import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useQueueSettingsStore } from '@/stores/queueSettingsStore'

import BatchCountEdit from './BatchCountEdit.vue'

const maxBatchCount = 16

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
  useQueueSettingsStore().batchCount = initialBatchCount
  useSettingStore().settingValues['Comfy.QueueButton.BatchCountLimit'] =
    maxBatchCount

  const user = userEvent.setup()

  render(BatchCountEdit, {
    global: {
      plugins: [i18n],
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
