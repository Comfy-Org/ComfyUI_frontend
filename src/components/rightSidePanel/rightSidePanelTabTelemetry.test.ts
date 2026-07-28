import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockTrackUiButtonClicked } = vi.hoisted(() => ({
  mockTrackUiButtonClicked: vi.fn()
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackUiButtonClicked: mockTrackUiButtonClicked
  })
}))

import { trackRightSidePanelTabOpened } from './rightSidePanelTabTelemetry'

describe('trackRightSidePanelTabOpened', () => {
  beforeEach(() => {
    mockTrackUiButtonClicked.mockClear()
  })

  it('tracks opening the settings tab', () => {
    trackRightSidePanelTabOpened('settings')

    expect(mockTrackUiButtonClicked).toHaveBeenCalledExactlyOnceWith({
      button_id: 'right_side_panel_settings_tab_opened',
      element_group: 'right_side_panel'
    })
  })

  it('tracks opening the info tab', () => {
    trackRightSidePanelTabOpened('info')

    expect(mockTrackUiButtonClicked).toHaveBeenCalledExactlyOnceWith({
      button_id: 'right_side_panel_info_tab_opened',
      element_group: 'right_side_panel'
    })
  })

  it.for(['parameters', 'nodes', 'errors', 'subgraph'] as const)(
    'does not track opening the %s tab',
    (tab) => {
      trackRightSidePanelTabOpened(tab)

      expect(mockTrackUiButtonClicked).not.toHaveBeenCalled()
    }
  )
})
