import { describe, expect, it, vi } from 'vitest'

import { useTelemetry } from '@comfyorg/telemetry'

vi.mock(import('@comfyorg/telemetry'))

import { trackPropertiesPanelTabOpened } from './propertiesPanelTabTelemetry'

describe('trackPropertiesPanelTabOpened', () => {
  it('tracks opening the settings tab', () => {
    trackPropertiesPanelTabOpened('settings')

    expect(
      useTelemetry()?.trackUiButtonClicked
    ).toHaveBeenCalledExactlyOnceWith({
      button_id: 'right_side_panel_settings_tab_opened',
      element_group: 'right_side_panel'
    })
  })

  it('tracks opening the info tab', () => {
    trackPropertiesPanelTabOpened('info')

    expect(
      useTelemetry()?.trackUiButtonClicked
    ).toHaveBeenCalledExactlyOnceWith({
      button_id: 'right_side_panel_info_tab_opened',
      element_group: 'right_side_panel'
    })
  })

  it.for(['parameters', 'nodes', 'errors', 'subgraph'] as const)(
    'does not track opening the %s tab',
    (tab) => {
      trackPropertiesPanelTabOpened(tab)

      expect(useTelemetry()?.trackUiButtonClicked).not.toHaveBeenCalled()
    }
  )
})
