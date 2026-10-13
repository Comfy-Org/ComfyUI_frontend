import { afterEach, assert, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

import { clipspace, copyToClipspace, pasteFromClipspace } from './clipspace'

vi.mock(import('@/scripts/app'))

afterEach(() => {
  clipspace.current = null
})

describe('clipspace image paste', () => {
  it.for([
    { mode: 'selected', expected: [{ filename: 'second.png' }] },
    {
      mode: 'all',
      expected: [{ filename: 'first.png' }, { filename: 'second.png' }]
    }
  ])(
    'pastes $mode store-backed images without legacy previews',
    ({ mode, expected }) => {
      const graph = new LGraph()
      const source = new LGraphNode('source')
      const target = new LGraphNode('target')
      graph.add(source)
      graph.add(target)
      useNodeOutputStore().setNodeOutputImages(source, [
        { filename: 'first.png' },
        { filename: 'second.png' }
      ])
      source.imageIndex = 1
      copyToClipspace(source)
      assert.exists(clipspace.current)
      clipspace.current.img_paste_mode = mode

      pasteFromClipspace(target)

      expect(useNodeOutputStore().getNodeOutputs(target)?.images).toEqual(
        expected
      )
    }
  )

  it.for([
    { name: 'empty images', selectedIndex: 0, filenames: [] },
    {
      name: 'negative selection',
      selectedIndex: -1,
      filenames: ['first.png']
    },
    {
      name: 'out-of-range selection',
      selectedIndex: 1,
      filenames: ['first.png']
    }
  ])(
    'preserves images and pastes widgets with $name',
    ({ selectedIndex, filenames }) => {
      const graph = new LGraph()
      const source = new LGraphNode('source')
      const target = new LGraphNode('target')
      graph.add(source)
      graph.add(target)
      source.imgs = filenames.map((filename) => {
        const image = new Image()
        image.src = filename
        return image
      })
      source.imageIndex = selectedIndex
      source.addWidget('text', 'prompt', 'pasted text', () => {})
      useNodeOutputStore().setNodeOutputImages(
        source,
        filenames.map((filename) => ({ filename }))
      )
      const originalImage = new Image()
      originalImage.src = 'original.png'
      target.imgs = [originalImage]
      useNodeOutputStore().setNodeOutputImages(target, [
        { filename: 'original.png' }
      ])
      const imageWidget = target.addWidget(
        'text',
        'image',
        'original.png',
        () => {}
      )
      const promptWidget = target.addWidget(
        'text',
        'prompt',
        'old text',
        () => {}
      )
      copyToClipspace(source)

      pasteFromClipspace(target)

      expect(target.imgs).toEqual([originalImage])
      expect(useNodeOutputStore().getNodeOutputs(target)?.images).toEqual([
        { filename: 'original.png' }
      ])
      expect(imageWidget.value).toBe('original.png')
      expect(promptWidget.value).toBe('pasted text')
    }
  )
})
