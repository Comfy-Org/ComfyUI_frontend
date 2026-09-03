import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from '.'
import {
  getSplitterStorageKey,
  loadSplitterSizes,
  saveSplitterSizes
} from './persistence'

describe('Splitter', () => {
  it('exposes an accessible resize handle between panels', () => {
    render({
      components: { SplitterGroup, SplitterPanel, SplitterResizeHandle },
      template: `
        <SplitterGroup>
          <SplitterPanel :default-size="30">Left</SplitterPanel>
          <SplitterResizeHandle />
          <SplitterPanel :default-size="70">Right</SplitterPanel>
        </SplitterGroup>
      `
    })

    const handle = screen.getByRole('separator')
    expect(handle).toHaveAttribute('data-orientation', 'horizontal')
    expect(handle).toHaveAttribute('tabindex', '0')
  })

  it('round-trips panel compositions independently', () => {
    const leftKey = getSplitterStorageKey('linear-view-splitter', [
      'left',
      'center'
    ])
    const bothKey = getSplitterStorageKey('linear-view-splitter', [
      'left',
      'center',
      'right'
    ])

    saveSplitterSizes(leftKey, [25, 75])
    saveSplitterSizes(bothKey, [20, 60, 20])

    expect(loadSplitterSizes(leftKey, 2)).toEqual([25, 75])
    expect(loadSplitterSizes(bothKey, 3)).toEqual([20, 60, 20])
  })

  it('continues when storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined)

    expect(() =>
      saveSplitterSizes('linear-view-splitter', [25, 75])
    ).not.toThrow()
    expect(loadSplitterSizes('linear-view-splitter', 2)).toBeUndefined()
  })
})
