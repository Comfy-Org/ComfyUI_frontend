import { describe, expect, it, vi } from 'vitest'

import { useTelemetry } from '@/platform/telemetry'

vi.mock(import('@/platform/telemetry'))

import { trackRightSidePanelTabOpened } from './rightSidePanelTabTelemetry'

describe('trackRightSidePanelTabOpened', () => {
  it('tracks opening the settings tab', () => {
    trackRightSidePanelTabOpened('settings')

    expect(
      useTelemetry()?.trackUiButtonClicked
    ).toHaveBeenCalledExactlyOnceWith({
      button_id: 'right_side_panel_settings_tab_opened',
      element_group: 'right_side_panel'
    })
  })

  it('tracks opening the info tab', () => {
    trackRightSidePanelTabOpened('info')

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
      trackRightSidePanelTabOpened(tab)

      expect(useTelemetry()?.trackUiButtonClicked).not.toHaveBeenCalled()
    }
  )
})
