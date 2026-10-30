import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import { ToInputRenderLink } from '@/lib/litegraph/src/canvas/ToInputRenderLink'
import { useViewportKeepAlivePins } from '@/renderer/extensions/vueNodes/composables/useViewportKeepAlivePins'
import {
  createMockLGraphNode,
  createMockLinkNetwork,
  createMockNodeOutputSlot
} from '@/utils/__tests__/litegraphTestUtils'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

function nodeWith(id: string, contents: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = `<div data-node-id="${id}">${contents}</div>`
  return root
}

describe('useViewportKeepAlivePins', () => {
  it.for([
    {
      name: 'iframe',
      contents: '<iframe src="about:blank"></iframe>',
      expected: new Set(['stateful'])
    },
    {
      name: 'idle media and ordinary widgets',
      contents: '<video></video><textarea></textarea>',
      expected: new Set()
    }
  ])('retains only live state for $name', async ({ contents, expected }) => {
    const root = nodeWith('stateful', contents)
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const { pinnedNodeIds } = scope.run(() =>
      useViewportKeepAlivePins({
        getRoot: () => root,
        getLinkConnector: () => null
      })
    )!

    await nextTick()

    expect(pinnedNodeIds.value).toEqual(expected)
  })

  it('retains media during playback and releases it on pause', async () => {
    const root = nodeWith('playing', '<video></video>')
    document.body.appendChild(root)
    onTestFinished(() => root.remove())
    const video = root.querySelector('video')
    assert.exists(video)
    const paused = vi.spyOn(video, 'paused', 'get').mockReturnValue(true)
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const { pinnedNodeIds } = scope.run(() =>
      useViewportKeepAlivePins({
        getRoot: () => root,
        getLinkConnector: () => null
      })
    )!
    await nextTick()
    expect(pinnedNodeIds.value).toEqual(new Set())

    paused.mockReturnValue(false)
    video.dispatchEvent(new Event('play'))
    await nextTick()
    expect(pinnedNodeIds.value).toEqual(new Set(['playing']))

    paused.mockReturnValue(true)
    video.dispatchEvent(new Event('pause'))
    await nextTick()
    expect(pinnedNodeIds.value).toEqual(new Set())
  })

  it('retains and releases nodes with transient browser state', async () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div data-node-id="focused"><input /></div>
      <div data-node-id="playing"><video /></div>
    `
    document.body.appendChild(root)

    const scope = effectScope()
    try {
      const video = root.querySelector('video')
      assert.exists(video)
      vi.spyOn(video, 'paused', 'get').mockReturnValue(false)

      const connector = new LinkConnector(() => {})
      const output = createMockNodeOutputSlot()
      const source = createMockLGraphNode({
        id: toNodeId('link-source'),
        outputs: [output],
        getOutputPos: vi.fn(() => [0, 0])
      })
      connector.renderLinks.push(
        new ToInputRenderLink(createMockLinkNetwork(), source, output)
      )

      const { pinnedNodeIds } = scope.run(() =>
        useViewportKeepAlivePins({
          getRoot: () => root,
          getLinkConnector: () => connector
        })
      )!
      await nextTick()
      expect(pinnedNodeIds.value).toEqual(new Set(['playing']))

      const input = root.querySelector('input')
      assert.exists(input)
      input.focus()
      connector.state.connectingTo = 'input'
      connector.events.dispatch('drag-started', undefined)
      await nextTick()

      expect(pinnedNodeIds.value).toEqual(
        new Set(['focused', 'playing', 'link-source'])
      )

      input.blur()
      connector.state.connectingTo = undefined
      connector.events.dispatch('reset', true)
      await nextTick()
      expect(pinnedNodeIds.value).toEqual(new Set(['playing']))

      video.remove()
      await nextTick()
      await vi.advanceTimersByTimeAsync(100)

      expect(pinnedNodeIds.value).toEqual(new Set())
    } finally {
      scope.stop()
      root.remove()
    }
  })
})
