import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { IContextMenuOptions } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'

const mockInstall = vi.hoisted(() => vi.fn())
const mockRegisterWrapper = vi.hoisted(() => vi.fn())
const mockExtractLegacyItems = vi.hoisted(() => vi.fn())
const mockCollectCanvasMenuItems = vi.hoisted(() => vi.fn())
const mockCollectNodeMenuItems = vi.hoisted(() => vi.fn())
const mockSt = vi.hoisted(() => vi.fn())
const mockTe = vi.hoisted(() => vi.fn())
const mockContextMenuConstructor = vi.hoisted(() => vi.fn())

vi.mock('@/lib/litegraph/src/contextMenuCompat', () => ({
  legacyMenuCompat: {
    install: mockInstall,
    registerWrapper: mockRegisterWrapper,
    extractLegacyItems: mockExtractLegacyItems
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    collectCanvasMenuItems: mockCollectCanvasMenuItems,
    collectNodeMenuItems: mockCollectNodeMenuItems
  }
}))

vi.mock('@/i18n', () => ({
  st: mockSt,
  te: mockTe
}))

vi.mock('@/utils/formatUtil', () => ({
  normalizeI18nKey: (value: string) => `normalized-${value}`
}))

import { useContextMenuTranslation } from './useContextMenuTranslation'

class FakeContextMenu {
  constructor(values: unknown, options: unknown) {
    mockContextMenuConstructor(values, options)
  }
}

describe('useContextMenuTranslation', () => {
  const originalGetCanvasMenuOptions =
    LGraphCanvas.prototype.getCanvasMenuOptions
  const originalGetNodeMenuOptions = LGraphCanvas.prototype.getNodeMenuOptions
  const originalContextMenu = LiteGraph.ContextMenu

  beforeEach(() => {
    vi.clearAllMocks()
    mockCollectCanvasMenuItems.mockReturnValue([{ content: 'NewApi' }])
    mockCollectNodeMenuItems.mockReturnValue([{ content: 'NodeApi' }])
    mockExtractLegacyItems.mockReturnValue([{ content: 'Legacy' }])
    mockSt.mockImplementation((_key: string, fallback: string) => {
      return `translated:${fallback}`
    })
    mockTe.mockImplementation(
      (key: string) => key === 'contextMenu.TranslateMe'
    )
    // Real LGraphCanvas.prototype so the composable's monkeypatch is
    // exercised against the class it patches in production; the base
    // implementations are stubbed since a real one needs a constructed
    // canvas/graph pair that this translation-only suite doesn't need.
    LGraphCanvas.prototype.getCanvasMenuOptions = function () {
      return [{ content: 'Base' }, null]
    }
    LGraphCanvas.prototype.getNodeMenuOptions = function (node: unknown) {
      return [{ content: `Node:${String(node)}` }]
    }
    LiteGraph.ContextMenu =
      FakeContextMenu as unknown as typeof LiteGraph.ContextMenu
  })

  afterEach(() => {
    LGraphCanvas.prototype.getCanvasMenuOptions = originalGetCanvasMenuOptions
    LGraphCanvas.prototype.getNodeMenuOptions = originalGetNodeMenuOptions
    LiteGraph.ContextMenu = originalContextMenu
  })

  it('wraps canvas menu options with new API, legacy, and translated items', () => {
    useContextMenuTranslation()
    // A plain receiver, not `instanceof LGraphCanvas`: the real class's
    // other getters (e.g. read_only) read constructor-initialized state
    // that a bare receiver doesn't have, which trips up Vitest's assertion
    // formatting. The patched method only needs a `this` to call through.
    const canvas = fromPartial<LGraphCanvas>({})

    const result = LGraphCanvas.prototype.getCanvasMenuOptions.call(canvas)

    // toBe, not toHaveBeenCalledWith: the real prototype's other getters
    // (e.g. read_only) read constructor-initialized state, and Vitest's
    // deep-equality formatting walks own properties, including those
    // getters, when comparing objects.
    expect(mockInstall.mock.calls[0]?.[0]).toBe(LGraphCanvas.prototype)
    expect(mockInstall.mock.calls[0]?.[1]).toBe('getCanvasMenuOptions')
    expect(mockCollectCanvasMenuItems).toHaveBeenCalledWith(canvas)
    expect(mockExtractLegacyItems).toHaveBeenCalledWith(
      'getCanvasMenuOptions',
      canvas
    )
    expect(result).toEqual([
      { content: 'translated:Base' },
      null,
      { content: 'translated:NewApi' },
      { content: 'translated:Legacy' }
    ])
  })

  it('wraps node menu options with new API and legacy extension items', () => {
    useContextMenuTranslation()
    const canvas = fromPartial<LGraphCanvas>({})
    const node = fromPartial<LGraphNode>({})

    const result = LGraphCanvas.prototype.getNodeMenuOptions.call(canvas, node)

    expect(mockInstall.mock.calls[1]?.[0]).toBe(LGraphCanvas.prototype)
    expect(mockInstall.mock.calls[1]?.[1]).toBe('getNodeMenuOptions')
    expect(mockCollectNodeMenuItems).toHaveBeenCalledWith(node)
    expect(mockExtractLegacyItems).toHaveBeenCalledWith(
      'getNodeMenuOptions',
      canvas,
      node
    )
    expect(result).toEqual([
      { content: `Node:${String(node)}` },
      { content: 'NodeApi' },
      { content: 'Legacy' }
    ])
  })

  it('translates LiteGraph context menu titles, nested items, and conversion labels', () => {
    useContextMenuTranslation()
    const values = [
      { content: 'TranslateMe' },
      { content: 'Convert seed to input' },
      { content: 'Convert value to widget' },
      {
        content: '',
        submenu: {
          options: [{ content: 'TranslateMe' }]
        }
      },
      'separator'
    ]
    const options = {
      title: 'KSampler',
      extra: {
        inputs: [{ name: 'seed', label: 'Seed Label' }],
        widgets: [{ name: 'value', label: 'Value Label' }]
      }
    }

    new LiteGraph.ContextMenu(values, options)

    expect(options.title).toBe('translated:KSampler')
    expect(values).toMatchObject([
      { content: 'translated:TranslateMe' },
      { content: 'translated:Convert Seed Labeltranslated: to input' },
      { content: 'translated:Convert Value Labeltranslated: to widget' },
      {
        submenu: {
          options: [{ content: 'translated:TranslateMe' }]
        }
      },
      'separator'
    ])
    expect(mockContextMenuConstructor).toHaveBeenCalledWith(values, options)
  })

  it('uses parent menu extra data when direct options do not provide it', () => {
    useContextMenuTranslation()
    const values = [{ content: 'Convert latent to input' }]
    const options = {
      parentMenu: {
        options: {
          extra: {
            inputs: [{ name: 'latent', label: 'Latent Label' }]
          }
        }
      }
    }

    new LiteGraph.ContextMenu(
      values,
      fromPartial<IContextMenuOptions<unknown, unknown>>(options)
    )

    expect(values[0].content).toBe(
      'translated:Convert Latent Labeltranslated: to input'
    )
  })

  it('keeps conversion names when matching inputs and widgets have no label', () => {
    useContextMenuTranslation()
    const values = [
      { content: 'Convert seed to input' },
      { content: 'Convert value to widget' }
    ]
    const options = {
      extra: {
        inputs: [{ name: 'seed' }],
        widgets: [{ name: 'value' }]
      }
    }

    new LiteGraph.ContextMenu(values, options)

    expect(values).toMatchObject([
      { content: 'translated:Convert seedtranslated: to input' },
      { content: 'translated:Convert valuetranslated: to widget' }
    ])
  })

  it('uses widget labels when input conversion names do not match inputs', () => {
    useContextMenuTranslation()
    const values = [{ content: 'Convert seed to input' }]
    const options = {
      extra: {
        inputs: [{ name: 'other' }],
        widgets: [{ name: 'seed', label: 'Widget Seed' }]
      }
    }

    new LiteGraph.ContextMenu(values, options)

    expect(values[0].content).toBe(
      'translated:Convert Widget Seedtranslated: to input'
    )
  })

  it('keeps plain unregistered menu items unchanged', () => {
    useContextMenuTranslation()
    const values = [{ content: 'Plain' }]

    new LiteGraph.ContextMenu(values, {})

    expect(values[0].content).toBe('Plain')
  })
})
