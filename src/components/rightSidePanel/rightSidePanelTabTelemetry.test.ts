import { assert, describe, expect, it, vi } from 'vitest'

import { useTelemetry } from '@/platform/telemetry'

vi.mock(import('@/platform/telemetry'))

const dispatcher = vi.mocked(useTelemetry(), { deep: true })
assert.exists(dispatcher)

import { trackRightSidePanelTabOpened } from './rightSidePanelTabTelemetry'

describe('trackRightSidePanelTabOpened', () => {
  it('tracks opening the settings tab', () => {
    trackRightSidePanelTabOpened('settings')

    expect(dispatcher.trackUiButtonClicked).toHaveBeenCalledExactlyOnceWith({
      button_id: 'right_side_panel_settings_tab_opened',
      element_group: 'right_side_panel'
    })
  })

  it('tracks opening the info tab', () => {
    trackRightSidePanelTabOpened('info')

    expect(dispatcher.trackUiButtonClicked).toHaveBeenCalledExactlyOnceWith({
      button_id: 'right_side_panel_info_tab_opened',
      element_group: 'right_side_panel'
    })
  })

  it.for(['parameters', 'nodes', 'errors', 'subgraph'] as const)(
    'does not track opening the %s tab',
    (tab) => {
      trackRightSidePanelTabOpened(tab)

      expect(dispatcher.trackUiButtonClicked).not.toHaveBeenCalled()
    }
  )
})
