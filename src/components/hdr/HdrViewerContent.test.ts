/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import HdrViewerContent from './HdrViewerContent.vue'

vi.mock('@/base/common/downloadUtil', () => ({ downloadFile: vi.fn() }))

const holder = vi.hoisted(() => ({ viewer: undefined as unknown }))
vi.mock('@/composables/useHdrViewer', () => ({
  useHdrViewer: () => holder.viewer,
  CHANNEL_MODES: ['rgb', 'r', 'g', 'b', 'a', 'luminance']
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { loading: 'Loading', downloadImage: 'Download' },
      hdrViewer: {
        failedToLoad: 'Failed',
        exposure: 'Exposure',
        normalizeExposure: 'Auto exposure',
        channel: 'Channel',
        channels: {
          rgb: 'RGB',
          r: 'R',
          g: 'G',
          b: 'B',
          a: 'Alpha',
          luminance: 'Luminance'
        },
        sourceGamut: 'Source gamut',
        dither: 'Dither',
        clipWarnings: 'Clip warnings',
        fitView: 'Fit',
        histogram: 'Histogram',
        resolution: 'Resolution',
        min: 'Min',
        max: 'Max',
        mean: 'Mean',
        stdDev: 'Std dev',
        nan: 'NaN',
        inf: 'Inf'
      }
    }
  }
})

function makeViewer(overrides: Record<string, unknown> = {}) {
  return {
    exposureStops: ref(0),
    dither: ref(true),
    clipWarnings: ref(false),
    gamut: ref('sRGB'),
    channel: ref('r'),
    loading: ref(false),
    error: ref(null),
    dimensions: ref('512 x 512'),
    stats: ref({
      min: 0,
      max: 4,
      mean: 0.5,
      stdDev: 0.2,
      nanCount: 2,
      infCount: 1
    }),
    histogram: ref(new Uint32Array([1, 2, 3, 4])),
    pixel: ref({ x: 1, y: 2, r: 0.1, g: 0.2, b: 0.3, a: 1 }),
    mount: vi.fn(),
    dispose: vi.fn(),
    fitView: vi.fn(),
    normalizeExposure: vi.fn(),
    ...overrides
  }
}

function renderViewer() {
  return render(HdrViewerContent, {
    props: { imageUrl: '/api/view?filename=out.exr' },
    global: { plugins: [i18n], stubs: { Button: true } }
  })
}

describe('HdrViewerContent', () => {
  beforeEach(() => {
    holder.viewer = makeViewer()
  })

  it('renders the full statistics set including NaN/Inf', () => {
    renderViewer()
    for (const label of [
      'Resolution',
      'Min',
      'Max',
      'Mean',
      'Std dev',
      'NaN',
      'Inf'
    ]) {
      screen.getByText(label)
    }
  })

  it('shows the pixel readout when a pixel is hovered', () => {
    renderViewer()
    expect(screen.getByTestId('hdr-pixel-readout')).toBeInTheDocument()
  })

  it('colors the histogram according to the selected channel', () => {
    holder.viewer = makeViewer({ channel: ref('g') })
    const { container } = renderViewer()
    const path = container.querySelector('svg path')
    expect(path?.getAttribute('class')).toContain('text-green-500')
  })

  it('renders an option for each channel mode', () => {
    renderViewer()
    expect(
      screen.getByRole('option', { name: 'Luminance' })
    ).toBeInTheDocument()
  })
})
