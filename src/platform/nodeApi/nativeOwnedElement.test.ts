import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

import { createComfyApi } from './comfyApi'

describe('native owned element handles', () => {
  let graph: LGraph

  beforeEach(() => {
    graph = new LGraph()
    useDomWidgetStore().clear()
  })

  function mount(value = 'first', name = 'reader') {
    const node = new LGraphNode('Reader', 'Proof')
    graph.add(node)
    const comfy = createComfyApi(() => graph)
    const widget = comfy.graph.node(String(node.id))!.widgets
    const container = document.createElement('div')
    const textarea = document.createElement('textarea')
    textarea.dataset.name = 'editor'
    textarea.dataset.key = 'text'
    textarea.value = value
    widget.mount({
      name,
      render: (element) => {
        container.append(element)
        element.append(textarea)
      }
    })
    const scope = { nodeId: String(node.id), widget: name }
    return {
      node,
      widget,
      container,
      textarea,
      scope,
      handle: comfy.element('editor', scope),
      comfy
    }
  }

  it('keeps same-named elements on two real node widgets independent', async () => {
    const first = mount()
    await expect(first.handle.get('value')).resolves.toBe('first')
    const second = mount('second')
    await expect(second.handle.get('value')).resolves.toBe('second')
    await expect(first.comfy.element('editor').get('value')).rejects.toThrow(
      /Ambiguous/
    )
    await second.handle.set('value', 'changed')
    await expect(first.handle.get('value')).resolves.toBe('first')
    await expect(second.handle.get('value')).resolves.toBe('changed')
  })

  it('does not search arbitrary elements outside registered widgets', async () => {
    const privateElement = document.createElement('textarea')
    privateElement.dataset.name = 'secret'
    document.body.append(privateElement)
    try {
      await expect(
        createComfyApi(() => graph)
          .element('secret')
          .get('value')
      ).rejects.toThrow(/Unknown/)
    } finally {
      privateElement.remove()
    }
  })

  it('preserves UTF16 caret operations and bounded text writes', async () => {
    const { handle, textarea } = mount('A😀BC')
    await handle.invoke('setSelectionRange', 1, 3, 'backward')
    expect(
      (await handle.get('value')).slice(
        await handle.get('selectionStart'),
        await handle.get('selectionEnd')
      )
    ).toBe('😀')
    await handle.set('value', 'paste')
    expect(textarea.value).toBe('paste')
    await handle.invoke('setSelectionRange', 100, 100)
    await expect(handle.get('selectionEnd')).resolves.toBe(5)
    await expect(handle.set('value', 'x'.repeat(262145))).rejects.toThrow(
      /bounds/
    )
    await expect(handle.set('scrollTop', Infinity)).rejects.toThrow(/bounds/)
    await expect(handle.invoke('setSelectionRange', -1, 2)).rejects.toThrow(
      /arguments/
    )
    await expect(
      Reflect.apply(handle.invoke, handle, ['focus', {}])
    ).rejects.toThrow(/arguments/)
    await expect(
      Reflect.apply(handle.get, handle, ['ownerDocument'])
    ).rejects.toThrow(/not permitted/)
    await expect(
      Reflect.apply(handle.set, handle, ['value', 42])
    ).rejects.toThrow(/string/)
  })

  it('never retargets a removed widget handle to a same-named replacement', async () => {
    const { handle, widget, comfy, scope } = mount()
    await handle.get('value')
    widget.remove('reader')
    widget.mount({
      name: 'reader',
      render: (container) => {
        const replacement = document.createElement('textarea')
        replacement.dataset.name = 'editor'
        replacement.value = 'replacement'
        container.append(replacement)
      }
    })
    await expect(handle.get('value')).rejects.toThrow(/removed/)
    await expect(comfy.element('editor', scope).get('value')).resolves.toBe(
      'replacement'
    )
  })

  it('removes subscriptions when their exact element or widget is removed', async () => {
    const first = mount()
    const callback = vi.fn()
    const stop = await first.handle.listen('input', callback)
    first.textarea.dispatchEvent(new Event('input'))
    expect(callback).toHaveBeenCalledExactlyOnceWith({ value: 'first' })
    stop()
    first.textarea.dispatchEvent(new Event('input'))
    expect(callback).toHaveBeenCalledOnce()
    await first.handle.listen('input', callback)
    first.widget.remove('reader')
    first.textarea.dispatchEvent(new Event('input'))
    expect(callback).toHaveBeenCalledOnce()

    const second = mount('second')
    await second.handle.listen('input', callback)
    second.textarea.replaceWith(document.createElement('span'))
    await expect(second.handle.get('value')).rejects.toThrow(/removed/)
    second.textarea.dispatchEvent(new Event('input'))
    expect(callback).toHaveBeenCalledOnce()
  })

  it('retains a handle across ordinary updates of the same element', async () => {
    const { handle, textarea } = mount()
    await handle.get('value')
    textarea.value = 'updated'
    await expect(handle.get('value')).resolves.toBe('updated')
  })

  it('does not carry a handle across a document replacement', async () => {
    const { handle, textarea } = mount()
    const callback = vi.fn()
    await handle.get('value')
    await handle.listen('input', callback)
    graph = new LGraph()
    textarea.dispatchEvent(new Event('input'))
    expect(callback).not.toHaveBeenCalled()
    await expect(handle.get('value')).rejects.toThrow(/removed/)
  })

  it('bounds event data and recovers without losing a subscription', async () => {
    const { handle, textarea } = mount()
    const callback = vi.fn()
    await handle.listen('input', callback)
    textarea.value = 'x'.repeat(262145)
    textarea.dispatchEvent(new Event('input'))
    expect(callback).not.toHaveBeenCalled()
    textarea.value = 'recovered'
    textarea.dispatchEvent(new Event('input'))
    expect(callback).toHaveBeenCalledExactlyOnceWith({ value: 'recovered' })
  })

  it('keeps image source writes within the markup renderer scheme allowlist', async () => {
    const { node, comfy } = mount()
    const image = document.createElement('img')
    image.dataset.name = 'preview'
    node.addDOMWidget('preview', 'custom', image)
    const handle = comfy.element('preview', {
      nodeId: String(node.id),
      widget: 'preview'
    })
    await expect(
      handle.set('src', 'data:image/html;base64,AAAA')
    ).rejects.toThrow(/not permitted/)
    await expect(handle.set('src', 'javascript:alert(1)')).rejects.toThrow(
      /not permitted/
    )
    await handle.set('src', 'data:image/png;base64,AAAA')
    expect(image.getAttribute('src')).toBe('data:image/png;base64,AAAA')
  })

  it('awaits media method rejection rather than reporting success', async () => {
    const { node, comfy } = mount()
    const audio = document.createElement('audio')
    audio.dataset.name = 'player'
    node.addDOMWidget('audio', 'custom', audio)
    vi.spyOn(audio, 'play').mockRejectedValueOnce(new Error('play denied'))
    await expect(
      comfy
        .element('player', { nodeId: String(node.id), widget: 'audio' })
        .invoke('play')
    ).rejects.toThrow('play denied')
  })
})
