import { screen } from '@testing-library/vue'
import { Chart } from 'chart.js'
import { assert, vi } from 'vitest'

export function getChartByName(name: string): Chart | undefined {
  const canvas = screen.getByRole('img', { name })
  assert(canvas instanceof HTMLCanvasElement)
  return Chart.getChart(canvas)
}

function createCanvasContext(
  canvas: HTMLCanvasElement
): CanvasRenderingContext2D {
  const context: Partial<CanvasRenderingContext2D> = {
    canvas,
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 }) as TextMetrics),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    setLineDash: vi.fn(),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic'
  }
  return context as CanvasRenderingContext2D
}

export function stubCanvasGetContext(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement, _contextId: string) {
      return createCanvasContext(this)
    } as HTMLCanvasElement['getContext']
  )
}
