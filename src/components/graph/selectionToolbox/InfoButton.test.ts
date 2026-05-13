import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import InfoButton from '@/components/graph/selectionToolbox/InfoButton.vue'
import Button from '@/components/ui/button/Button.vue'

const { openNodeInfoPanelMock, trackUiButtonClickedMock } = vi.hoisted(() => ({
  openNodeInfoPanelMock: vi.fn(),
  trackUiButtonClickedMock: vi.fn()
}))

vi.mock('@/composables/graph/useSelectionState', () => ({
  useSelectionState: () => ({
    openNodeInfoPanel: openNodeInfoPanelMock
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackUiButtonClicked: trackUiButtonClickedMock
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
    openNodeInfoPanelMock.mockReturnValue(true)
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

  it('should open the node info panel on click', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Node Info' }))

    expect(openNodeInfoPanelMock).toHaveBeenCalled()
    expect(trackUiButtonClickedMock).toHaveBeenCalledWith({
      button_id: 'selection_toolbox_node_info_opened'
    })
  })

  it('should not track the click when the node info panel is unavailable', async () => {
    const user = userEvent.setup()
    openNodeInfoPanelMock.mockReturnValue(false)
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Node Info' }))

    expect(openNodeInfoPanelMock).toHaveBeenCalled()
    expect(trackUiButtonClickedMock).not.toHaveBeenCalled()
  })
})
