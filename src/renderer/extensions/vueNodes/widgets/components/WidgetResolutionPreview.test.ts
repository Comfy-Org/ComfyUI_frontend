import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

const resolveNodeMock = vi.hoisted(() => vi.fn())
vi.mock('@/utils/litegraphUtil', () => ({ resolveNode: resolveNodeMock }))

import type { IWidgetResolutionPreviewOptions } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { widgetId } from '@/types/widgetId'

import WidgetResolutionPreview from './WidgetResolutionPreview.vue'

const GRAPH_ID = 'test-graph'
const NODE_ID = toNodeId(1)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { megapixelsValue: '{count} MP' }
    }
  }
})

let pinia: Pinia

beforeEach(() => {
  pinia = createTestingPinia({ stubActions: false })
  setActivePinia(pinia)
  resolveNodeMock.mockReturnValue({
    id: NODE_ID,
    graph: { rootGraph: { id: GRAPH_ID } }
  })
})

function registerSibling(name: string, type: string, value: unknown) {
  useWidgetValueStore().registerWidget(widgetId(GRAPH_ID, NODE_ID, name), {
    type,
    value: value as never,
    options: {}
  })
}

function registerDefaultSiblings(
  aspectRatio: string,
  megapixels: number,
  multiple: number
) {
  registerSibling('aspect_ratio', 'combo', aspectRatio)
  registerSibling('megapixels', 'number', megapixels)
  registerSibling('multiple', 'number', multiple)
}

function renderPreview(options: IWidgetResolutionPreviewOptions = {}) {
  const widget: SimplifiedWidget<null, IWidgetResolutionPreviewOptions> = {
    name: 'preview',
    type: 'resolutionpreview',
    value: null,
    options
  }
  return render(WidgetResolutionPreview, {
    props: { widget, nodeId: NODE_ID },
    global: { plugins: [pinia, i18n] }
  })
}

function displayedValue(): string {
  return screen.getByTestId('resolution-preview-value').textContent.trim()
}

describe('WidgetResolutionPreview', () => {
  // Expected values generated from ResolutionSelector.execute in
  // comfy_extras/nodes_resolution.py (Comfy-Org/ComfyUI#16013) — the
  // backend contract tests in that repo pin the same formula.
  it.for([
    ['1:1 (Square)', '1024 × 1024'],
    ['2:3 (Portrait Photo)', '840 × 1256'],
    ['3:2 (Photo)', '1256 × 840'],
    ['3:4 (Portrait Standard)', '888 × 1184'],
    ['4:3 (Standard)', '1184 × 888'],
    ['9:16 (Portrait Widescreen)', '768 × 1368'],
    ['16:9 (Widescreen)', '1368 × 768'],
    ['21:9 (Ultrawide)', '1568 × 672']
  ] as const)(
    'matches the backend for %s at 1.0 MP ×8',
    ([label, expected]) => {
      registerDefaultSiblings(label, 1.0, 8)
      renderPreview()

      expect(displayedValue()).toBe(expected)
    }
  )

  it('matches the backend for a non-default multiple', () => {
    registerDefaultSiblings('3:4 (Portrait Standard)', 2.0, 32)
    renderPreview()

    expect(displayedValue()).toBe('1248 × 1664')
  })

  it('rounds half-ties to even like Python round()', () => {
    // scale is exactly 1028 here, so width/multiple is an exact 128.5 tie:
    // Math.round would produce 1032, the backend produces 1024.
    registerDefaultSiblings('1:1 (Square)', 1.0078277587890625, 8)
    renderPreview()

    expect(displayedValue()).toBe('1024 × 1024')
  })

  it('supports non-integer ratio labels', () => {
    registerDefaultSiblings('1.85:1 (Cinema)', 1.0, 8)
    renderPreview()

    expect(displayedValue()).toBe('1392 × 752')
  })

  it('updates live when a sibling value changes in the store', async () => {
    registerDefaultSiblings('1:1 (Square)', 1.0, 8)
    renderPreview()
    expect(displayedValue()).toBe('1024 × 1024')

    useWidgetValueStore().setValue(
      widgetId(GRAPH_ID, NODE_ID, 'aspect_ratio'),
      '16:9 (Widescreen)'
    )
    await nextTick()

    expect(displayedValue()).toBe('1368 × 768')
  })

  it('reads siblings through the configured widget names', () => {
    registerSibling('ratio', 'combo', '16:9 (Widescreen)')
    registerSibling('mp', 'number', 0.4)
    registerSibling('resolution_steps', 'number', 32)
    renderPreview({
      ratio_widget: 'ratio',
      megapixels_widget: 'mp',
      multiple_widget: 'resolution_steps'
    })

    expect(displayedValue()).toBe('864 × 480')
  })

  it('renders the placeholder when siblings are not registered', () => {
    renderPreview()

    expect(screen.queryByTestId('resolution-preview-value')).toBeNull()
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('renders the placeholder instead of guessing a missing multiple', () => {
    registerSibling('aspect_ratio', 'combo', '1:1 (Square)')
    registerSibling('megapixels', 'number', 1.0)
    renderPreview()

    expect(screen.queryByTestId('resolution-preview-value')).toBeNull()
    expect(screen.getByText('—')).toBeTruthy()
  })

  it.for([
    { desc: 'a malformed ratio label', ratio: 'Square', mp: 1.0, multiple: 8 },
    {
      desc: 'a zero-component ratio',
      ratio: '0:1 (Degenerate)',
      mp: 1.0,
      multiple: 8
    },
    {
      desc: 'non-positive megapixels',
      ratio: '1:1 (Square)',
      mp: 0,
      multiple: 8
    },
    {
      desc: 'a non-numeric megapixels value',
      ratio: '1:1 (Square)',
      mp: '1.0',
      multiple: 8
    },
    {
      desc: 'a non-positive multiple',
      ratio: '1:1 (Square)',
      mp: 1.0,
      multiple: 0
    }
  ])('renders the placeholder for $desc', ({ ratio, mp, multiple }) => {
    registerSibling('aspect_ratio', 'combo', ratio)
    registerSibling('megapixels', 'number', mp)
    registerSibling('multiple', 'number', multiple)
    renderPreview()

    expect(screen.queryByTestId('resolution-preview-value')).toBeNull()
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('shows a preview once siblings become registered', async () => {
    renderPreview()
    expect(screen.queryByTestId('resolution-preview-value')).toBeNull()

    registerDefaultSiblings('1:1 (Square)', 1.0, 8)
    await nextTick()

    expect(displayedValue()).toBe('1024 × 1024')
  })
})
