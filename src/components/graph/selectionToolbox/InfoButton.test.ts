import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import InfoButton from '@/components/graph/selectionToolbox/InfoButton.vue'
import Button from '@/components/ui/button/Button.vue'

const { showNodeHelpMock } = vi.hoisted(() => ({
  showNodeHelpMock: vi.fn()
}))

vi.mock('@/composables/graph/useSelectionState', () => ({
  useSelectionState: () => ({
    showNodeHelp: showNodeHelpMock
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackUiButtonClicked: vi.fn()
  })
}))

describe('InfoButton', () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        g: {
          info: 'Node Info'
        }
      }
    }
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  const renderComponent = () => {
    return render(InfoButton, {
      global: {
        plugins: [i18n, PrimeVue],
        directives: { tooltip: Tooltip },
        components: { Button }
      }
    })
  }

  it('should call showNodeHelp on click', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Node Info' }))

    expect(showNodeHelpMock).toHaveBeenCalledTimes(1)
  })
})
