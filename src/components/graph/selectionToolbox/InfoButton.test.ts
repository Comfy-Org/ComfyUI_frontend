import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import InfoButton from '@/components/graph/selectionToolbox/InfoButton.vue'
import Button from '@/components/ui/button/Button.vue'

const { openNodeInfoMock, trackUiButtonClickedMock } = vi.hoisted(() => ({
  openNodeInfoMock: vi.fn(),
  trackUiButtonClickedMock: vi.fn()
}))

vi.mock('@/composables/graph/useSelectionState', () => ({
  useSelectionState: () => ({
    openNodeInfo: openNodeInfoMock
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
    vi.clearAllMocks()
    openNodeInfoMock.mockReturnValue(true)
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

  const clickNodeInfoButton = async () => {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Node Info' }))
  }

  it('should open the node info panel on click', async () => {
    renderComponent()

    await clickNodeInfoButton()

    expect(openNodeInfoMock).toHaveBeenCalled()
    expect(trackUiButtonClickedMock).toHaveBeenCalledWith({
      button_id: 'selection_toolbox_node_info_opened',
      element_group: 'selection_toolbox'
    })
  })

  it('should not track the click when the node info panel is unavailable', async () => {
    openNodeInfoMock.mockReturnValue(false)
    renderComponent()

    await clickNodeInfoButton()

    expect(openNodeInfoMock).toHaveBeenCalled()
    expect(trackUiButtonClickedMock).not.toHaveBeenCalled()
  })
})
