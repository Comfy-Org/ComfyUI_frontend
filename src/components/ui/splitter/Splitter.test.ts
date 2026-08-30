import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from '.'

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

  it('restores a saved panel layout', async () => {
    const onLayout = vi.fn()
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          'left,right': { expandToSizes: {}, layout: [25, 75] }
        })
      ),
      setItem: vi.fn()
    }

    render({
      components: { SplitterGroup, SplitterPanel, SplitterResizeHandle },
      setup: () => ({ onLayout, storage }),
      template: `
        <SplitterGroup auto-save-id="saved" :storage @layout="onLayout">
          <SplitterPanel id="left" :default-size="30">Left</SplitterPanel>
          <SplitterResizeHandle />
          <SplitterPanel id="right" :default-size="70">Right</SplitterPanel>
        </SplitterGroup>
      `
    })

    await waitFor(() => expect(onLayout).toHaveBeenCalledWith([25, 75]))
    expect(storage.getItem).toHaveBeenCalledWith('reka:saved')
  })
})
