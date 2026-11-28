import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IWidgetVideoConcatOptions,
  VideoConcatValue
} from '@comfyorg/graph-model/widgets'
import { api } from '@/scripts/api'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { widgetId } from '@comfyorg/graph-model/widgetId'

import {
  clipTiles,
  placeClipTiles,
  pressClipTile
} from './__fixtures__/clipTiles'
import WidgetVideoConcat from './WidgetVideoConcat.vue'

vi.mock(import('@/scripts/app'))

vi.mock(import('@/scripts/api'))

vi.mock<unknown>(import('@/composables/video/useVideoFilmstrip'), async () => {
  const { ref: createRef } = await import('vue')
  return {
    useVideoFilmstrip: () => ({
      thumbnail: createRef(''),
      duration: createRef(0),
      width: createRef(0),
      height: createRef(0),
      loading: createRef(true)
    })
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: { en: {} }
})

const concatOptions: IWidgetVideoConcatOptions = { source: 'videos' }

function buildConcat(files: string[]) {
  const graph = app.rootGraph
  const concat = new LGraphNode('ConcatenateVideo')
  for (const slot of files.keys())
    concat.addInput(`videos.video${slot}`, 'VIDEO')
  concat.addWidget('videoconcat', 'order', {}, () => {}, concatOptions)
  graph.add(concat)
  for (const [slot, filename] of files.entries()) {
    const loader = new LGraphNode('LoadVideo')
    loader.addOutput('VIDEO', 'VIDEO')
    graph.add(loader)
    useNodeOutputStore().nodeOutputs[String(loader.id)] = {
      images: [{ filename, type: 'input' }]
    }
    loader.connect(0, concat, slot)
  }
  return concat
}

function renderWidget(concat: LGraphNode, modelValue: VideoConcatValue) {
  return render(WidgetVideoConcat, {
    props: {
      widgetId: widgetId(app.rootGraph.id, concat.id, 'order'),
      nodeId: concat.id,
      modelValue
    },
    global: { plugins: [i18n] }
  })
}

function clipNames() {
  return clipTiles().map((tile) => tile.dataset.clipName)
}

describe('WidgetVideoConcat', () => {
  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation((path) => `/api${path}`)
    useNodeOutputStore().resetAllOutputsAndPreviews()
  })

  function mountWith(modelValue: VideoConcatValue) {
    const concat = buildConcat(['red.mp4', 'green.mp4', 'blue.mp4'])
    useCanvasStore().currentGraph = app.rootGraph
    return renderWidget(concat, modelValue)
  }

  it('shows the connected clips in the saved order', () => {
    mountWith({ order: ['video2'] })

    expect(clipNames()).toEqual(['video2', 'video0', 'video1'])
  })

  it('stores the new order when a clip is dragged', async () => {
    const { emitted } = mountWith({})
    placeClipTiles()

    await pressClipTile(clipTiles()[2], 248)
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 20 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 20 }))

    expect(emitted('update:modelValue')).toEqual([
      [{ order: ['video2', 'video0', 'video1'] }]
    ])
  })
})
