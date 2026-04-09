import { describe, expect, it, vi } from 'vitest'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { InputWidgetConfig } from '@/platform/workflow/management/stores/comfyWorkflow'

import { useAppModeWidgetResizing } from './useAppModeWidgetResizing'

function wrapWithTextarea(): {
  wrapper: HTMLDivElement
  textarea: HTMLTextAreaElement
} {
  const wrapper = document.createElement('div')
  const textarea = document.createElement('textarea')
  wrapper.appendChild(textarea)
  return { wrapper, textarea }
}

describe('useAppModeWidgetResizing', () => {
  function setup() {
    const onResize =
      vi.fn<
        (nodeId: NodeId, widgetName: string, config: InputWidgetConfig) => void
      >()
    const { trackResizable, observedElements } =
      useAppModeWidgetResizing(onResize)
    return { onResize, trackResizable, observedElements }
  }

  it('tracks a resizable child element', () => {
    const { trackResizable, observedElements } = setup()
    const { wrapper, textarea } = wrapWithTextarea()

    trackResizable(wrapper, '1:prompt', 1 as NodeId, 'prompt')

    expect(observedElements.value).toEqual([textarea])
  })

  it('removes element when called with null', () => {
    const { trackResizable, observedElements } = setup()
    const { wrapper } = wrapWithTextarea()

    trackResizable(wrapper, '1:prompt', 1 as NodeId, 'prompt')
    trackResizable(null, '1:prompt', 1 as NodeId, 'prompt')

    expect(observedElements.value).toEqual([])
  })

  it('replaces element when same key is re-tracked', () => {
    const { trackResizable, observedElements } = setup()
    const first = wrapWithTextarea()
    const second = wrapWithTextarea()

    trackResizable(first.wrapper, '1:prompt', 1 as NodeId, 'prompt')
    trackResizable(second.wrapper, '1:prompt', 1 as NodeId, 'prompt')

    expect(observedElements.value).toEqual([second.textarea])
  })

  it('ignores elements with no resizable child', () => {
    const { trackResizable, observedElements } = setup()
    const wrapper = document.createElement('div')

    trackResizable(wrapper, '1:prompt', 1 as NodeId, 'prompt')

    expect(observedElements.value).toEqual([])
  })

  it('finds drop-zone-indicator as resizable child', () => {
    const { trackResizable, observedElements } = setup()
    const wrapper = document.createElement('div')
    const indicator = document.createElement('div')
    indicator.setAttribute('data-slot', 'drop-zone-indicator')
    wrapper.appendChild(indicator)

    trackResizable(wrapper, '1:image', 1 as NodeId, 'image')

    expect(observedElements.value).toEqual([indicator])
  })
})
