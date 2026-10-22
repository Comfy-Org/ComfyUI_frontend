import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import { useElementSize } from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import messages from '@/locales/en/main.json'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'

import WidgetTextOverlayPreview from './WidgetTextOverlayPreview.vue'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@vueuse/core'), { spy: true })

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { textOverlay: messages.textOverlay } }
})

interface FilledText {
  text: string
  color: string
}

function recordFilledText() {
  const filled: FilledText[] = []
  const context = fromPartial<CanvasRenderingContext2D>({
    save() {},
    restore() {},
    setTransform() {},
    clearRect() {},
    drawImage() {},
    strokeText() {},
    measureText: (text: string) =>
      fromPartial<TextMetrics>({
        width: text.length * 10,
        actualBoundingBoxAscent: 14,
        actualBoundingBoxDescent: 4
      }),
    fillText(this: CanvasRenderingContext2D, text: string) {
      filled.push({ text, color: String(this.fillStyle) })
    }
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    fromAny<HTMLCanvasElement['getContext'], unknown>(() => context)
  )
  return filled
}

function createTextOverlayNode() {
  const node = new LGraphNode('TextOverlay')
  node.addInput('images', 'IMAGE')
  app.rootGraph.add(node)
  const text = node.addWidget('text', 'text', 'Hello', () => {})
  node.addWidget('text', 'color', '#ff0000', () => {})
  node.addWidget('combo', 'position', 'top', () => {}, {
    values: ['top', 'bottom']
  })
  return { node, text }
}

function renderPreview(node: LGraphNode) {
  return render(WidgetTextOverlayPreview, {
    global: { plugins: [i18n] },
    props: {
      widget: {
        name: '$$text_overlay_preview',
        type: 'textoverlaypreview',
        value: null,
        nodeLocatorId: createNodeLocatorId(null, node.id)
      },
      nodeId: node.id
    }
  })
}

describe('WidgetTextOverlayPreview', () => {
  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation((path) => `/api${path}`)
    vi.mocked(useElementSize).mockReturnValue({
      width: ref(200),
      height: ref(200),
      stop() {}
    })
    useNodeOutputStore().resetAllOutputsAndPreviews()
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { load: () => Promise.resolve([fromPartial<FontFace>({})]) }
    })
    return () => {
      Reflect.deleteProperty(document, 'fonts')
    }
  })

  it('draws the node text in the chosen color', async () => {
    const filled = recordFilledText()
    const { node } = createTextOverlayNode()

    renderPreview(node)

    await vi.waitFor(() =>
      expect(filled.at(-1)).toEqual({ text: 'Hello', color: '#ff0000' })
    )
  })

  it('redraws when a widget value changes', async () => {
    const filled = recordFilledText()
    const { node, text } = createTextOverlayNode()
    renderPreview(node)
    await vi.waitFor(() => expect(filled).not.toHaveLength(0))

    text.value = 'Updated'
    await nextTick()

    expect(filled.at(-1)?.text).toBe('Updated')
  })

  it('asks for a run while there is no input image', () => {
    recordFilledText()
    const { node } = createTextOverlayNode()

    renderPreview(node)

    expect(
      screen.getByText(messages.textOverlay.runToPreview)
    ).toBeInTheDocument()
  })
})
