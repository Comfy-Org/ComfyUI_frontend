import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockInstall = vi.hoisted(() => vi.fn())
const mockRegisterWrapper = vi.hoisted(() => vi.fn())
const mockExtractLegacyItems = vi.hoisted(() => vi.fn())
const mockCollectCanvasMenuItems = vi.hoisted(() => vi.fn())
const mockCollectNodeMenuItems = vi.hoisted(() => vi.fn())
const mockSt = vi.hoisted(() => vi.fn())
const mockTe = vi.hoisted(() => vi.fn())
const mockContextMenuConstructor = vi.hoisted(() => vi.fn())

const mockClasses = vi.hoisted(() => {
  class LGraphCanvas {
    getCanvasMenuOptions() {
      return [{ content: 'Base' }, null]
    }

    getNodeMenuOptions(node: unknown) {
      return [{ content: `Node:${String(node)}` }]
    }
  }

  class ContextMenu {
    constructor(values: unknown, options: unknown) {
      mockContextMenuConstructor(values, options)
    }
  }

  return {
    LGraphCanvas,
    ContextMenu,
    LiteGraph: {
      ContextMenu
    }
  }
})

vi.mock('@/lib/litegraph/src/contextMenuCompat', () => ({
  legacyMenuCompat: {
    install: mockInstall,
    registerWrapper: mockRegisterWrapper,
    extractLegacyItems: mockExtractLegacyItems
  }
}))

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LGraphCanvas: mockClasses.LGraphCanvas,
  LiteGraph: mockClasses.LiteGraph
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

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useContextMenuTranslation } from './useContextMenuTranslation'

describe('useContextMenuTranslation', () => {
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
    mockClasses.LGraphCanvas.prototype.getCanvasMenuOptions = function () {
      return [{ content: 'Base' }, null]
    }
    mockClasses.LGraphCanvas.prototype.getNodeMenuOptions = function (
      node: unknown
    ) {
      return [{ content: `Node:${String(node)}` }]
    }
    mockClasses.LiteGraph.ContextMenu = mockClasses.ContextMenu
  })

  it('wraps canvas menu options with new API, legacy, and translated items', () => {
    useContextMenuTranslation()
    const canvas = new mockClasses.LGraphCanvas()

    const result = canvas.getCanvasMenuOptions()

    expect(mockInstall).toHaveBeenCalledWith(
      mockClasses.LGraphCanvas.prototype,
      'getCanvasMenuOptions'
    )
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
    const canvas = new mockClasses.LGraphCanvas()

    const result = canvas.getNodeMenuOptions('node')

    expect(mockInstall).toHaveBeenCalledWith(
      mockClasses.LGraphCanvas.prototype,
      'getNodeMenuOptions'
    )
    expect(mockCollectNodeMenuItems).toHaveBeenCalledWith('node')
    expect(mockExtractLegacyItems).toHaveBeenCalledWith(
      'getNodeMenuOptions',
      canvas,
      'node'
    )
    expect(result).toEqual([
      { content: 'Node:node' },
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

    new LiteGraph.ContextMenu(values, options)

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
