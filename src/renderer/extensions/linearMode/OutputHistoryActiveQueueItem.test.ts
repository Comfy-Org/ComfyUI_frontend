import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import OutputHistoryActiveQueueItem from './OutputHistoryActiveQueueItem.vue'

const i18n = createI18n({ legacy: false, locale: 'en' })
setActivePinia(createTestingPinia({ stubActions: false }))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: vi.fn()
  })
}))

function renderComponent(queueCount: number) {
  return render(OutputHistoryActiveQueueItem, {
    props: { queueCount },
    global: { plugins: [i18n] }
  })
}

describe('OutputHistoryActiveQueueItem', () => {
  it('hides badge when queueCount is 1', () => {
    renderComponent(1)
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })

  it('shows badge with correct count when queueCount is 3', () => {
    renderComponent(3)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('hides badge when queueCount is 0', () => {
    renderComponent(0)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})
