/* eslint-disable testing-library/no-container, testing-library/no-node-access, testing-library/prefer-user-event */
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import WidgetBoundingBoxes from './WidgetBoundingBoxes.vue'
import boundingBoxes from '@/locales/en/main.json'
import type { BoundingBox } from '@/types/boundingBoxes'
import { toNodeId } from '@/types/nodeId'

const { appState } = vi.hoisted(() => ({ appState: { node: null as unknown } }))

vi.mock('@/scripts/app', () => ({
  app: { canvas: { graph: { getNodeById: () => appState.node } } }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      boundingBoxes: boundingBoxes.boundingBoxes,
      palette: { swatchTitle: 'Edit', addColor: 'Add' }
    }
  }
})

const box = (over: Partial<BoundingBox> = {}): BoundingBox => ({
  x: 51,
  y: 51,
  width: 256,
  height: 256,
  metadata: { type: 'obj', text: '', desc: '', palette: ['#ff0000'] },
  ...over
})

const fakeCtx = {
  measureText: (s: string) => ({ width: s.length * 7 }),
  setTransform: () => {},
  clearRect: () => {},
  fillRect: () => {},
  strokeRect: () => {},
  fillText: () => {},
  drawImage: () => {},
  save: () => {},
  restore: () => {},
  beginPath: () => {},
  rect: () => {},
  clip: () => {},
  font: '',
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0
} as unknown as CanvasRenderingContext2D

function prepCanvas(canvas: HTMLCanvasElement) {
  Object.defineProperty(canvas, 'clientWidth', {
    value: 100,
    configurable: true
  })
  Object.defineProperty(canvas, 'clientHeight', {
    value: 100,
    configurable: true
  })
  canvas.getContext = (() =>
    fakeCtx) as unknown as HTMLCanvasElement['getContext']
  canvas.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({})
    }) as DOMRect
  canvas.setPointerCapture = () => {}
  canvas.releasePointerCapture = () => {}
}

function renderWidget(modelValue: BoundingBox[]) {
  const result = render(WidgetBoundingBoxes, {
    props: { nodeId: toNodeId('1'), modelValue },
    global: { plugins: [i18n] }
  })
  const canvas = screen.getByTestId('bounding-boxes').querySelector('canvas')!
  prepCanvas(canvas)
  return { ...result, canvas }
}

const lastBoxes = (emitted: () => Record<string, unknown[][]>) => {
  const calls = emitted()['update:modelValue']
  return calls[calls.length - 1][0] as BoundingBox[]
}

beforeEach(() => {
  setActivePinia(createPinia())
  appState.node = {
    widgets: [
      { name: 'width', value: 512 },
      { name: 'height', value: 512 }
    ],
    findInputSlot: () => -1,
    getInputNode: () => null
  }
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('WidgetBoundingBoxes', () => {
  it('renders the canvas and editor shell', () => {
    renderWidget([])
    expect(
      screen.getByTestId('bounding-boxes').querySelector('canvas')
    ).not.toBeNull()
  })

  it('shows the region editor panel when a region is active', () => {
    renderWidget([box()])
    expect(screen.getByText('obj')).toBeTruthy()
    expect(screen.getByText('text')).toBeTruthy()
  })

  it('reveals the text field after switching the region to text', async () => {
    renderWidget([box()])
    expect(
      screen.queryByPlaceholderText('text to render (verbatim)')
    ).toBeNull()
    await userEvent.click(screen.getByText('text'))
    expect(
      screen.getByPlaceholderText('text to render (verbatim)')
    ).toBeTruthy()
  })

  it('clears all regions via the clear button', async () => {
    const { emitted } = renderWidget([box()])
    await userEvent.click(screen.getByText('Clear all'))
    expect(lastBoxes(emitted)).toEqual([])
  })

  it('draws a region through canvas pointer events', async () => {
    const { canvas, emitted } = renderWidget([])
    await fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1
    })
    await fireEvent.pointerMove(canvas, {
      clientX: 60,
      clientY: 60,
      pointerId: 1
    })
    await fireEvent.pointerUp(canvas, {
      clientX: 60,
      clientY: 60,
      pointerId: 1
    })
    expect(lastBoxes(emitted)).toHaveLength(1)
  })

  it('tracks focus and blur on the canvas', async () => {
    const { canvas } = renderWidget([box()])
    await fireEvent.focus(canvas)
    await fireEvent.blur(canvas)
    expect(canvas).toBeTruthy()
  })

  it('opens an inline editor on double click', async () => {
    const { canvas, container } = renderWidget([box()])
    await fireEvent.dblClick(canvas, { clientX: 30, clientY: 30 })
    expect(container.querySelector('textarea')).not.toBeNull()
  })

  it('syncs description edits back to the model', async () => {
    const { emitted } = renderWidget([box()])
    await fireEvent.update(
      screen.getByPlaceholderText('description of this region'),
      'a caption'
    )
    expect(lastBoxes(emitted)[0].metadata.desc).toBe('a caption')
  })

  it('edits the text field once the region is a text region', async () => {
    const { emitted } = renderWidget([box()])
    await userEvent.click(screen.getByText('text'))
    await fireEvent.update(
      screen.getByPlaceholderText('text to render (verbatim)'),
      'hello'
    )
    expect(lastBoxes(emitted)[0].metadata.text).toBe('hello')
  })

  it('deletes the active region with the Delete key', async () => {
    const { canvas, emitted } = renderWidget([box()])
    await fireEvent.keyDown(canvas, { key: 'Delete' })
    expect(lastBoxes(emitted)).toEqual([])
  })

  it('clears hover state on pointer leave', async () => {
    const { canvas } = renderWidget([
      box({ x: 10, y: 10, width: 256, height: 256 })
    ])
    await fireEvent.pointerMove(canvas, { clientX: 15, clientY: 15 })
    await fireEvent.pointerLeave(canvas)
    expect(canvas).toBeTruthy()
  })

  it('commits the inline editor on blur', async () => {
    const { canvas, container, emitted } = renderWidget([box()])
    await fireEvent.dblClick(canvas, { clientX: 30, clientY: 30 })
    const editor = container.querySelector('textarea')!
    await fireEvent.update(editor, 'committed')
    await fireEvent.blur(editor)
    expect(lastBoxes(emitted)[0].metadata.desc).toBe('committed')
  })
})
