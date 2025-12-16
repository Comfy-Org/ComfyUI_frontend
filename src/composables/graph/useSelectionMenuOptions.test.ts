import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSelectionMenuOptions } from '@/composables/graph/useSelectionMenuOptions'

const subgraphMocks = vi.hoisted(() => ({
  convertToSubgraph: vi.fn(),
  unpackSubgraph: vi.fn(),
  addSubgraphToLibrary: vi.fn(),
  createI18nMock: vi.fn(() => ({
    global: {
      t: vi.fn(),
      te: vi.fn(),
      d: vi.fn()
    }
  }))
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  }),
  createI18n: subgraphMocks.createI18nMock
}))

vi.mock('@/composables/graph/useSelectionOperations', () => ({
  useSelectionOperations: () => ({
    copySelection: vi.fn(),
    duplicateSelection: vi.fn(),
    deleteSelection: vi.fn(),
    renameSelection: vi.fn()
  })
}))

vi.mock('@/composables/graph/useNodeArrangement', () => ({
  useNodeArrangement: () => ({
    alignOptions: [{ localizedName: 'align-left', icon: 'align-left' }],
    distributeOptions: [{ localizedName: 'distribute', icon: 'distribute' }],
    applyAlign: vi.fn(),
    applyDistribute: vi.fn()
  })
}))

vi.mock('@/composables/graph/useSubgraphOperations', () => ({
  useSubgraphOperations: () => ({
    convertToSubgraph: subgraphMocks.convertToSubgraph,
    unpackSubgraph: subgraphMocks.unpackSubgraph,
    addSubgraphToLibrary: subgraphMocks.addSubgraphToLibrary
  })
}))

vi.mock('@/composables/graph/useFrameNodes', () => ({
  useFrameNodes: () => ({
    frameNodes: vi.fn()
  })
}))

describe('useSelectionMenuOptions - subgraph options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns only convert option when no subgraphs are selected', () => {
    const { getSubgraphOptions } = useSelectionMenuOptions()
    const options = getSubgraphOptions({
      hasSubgraphs: false,
      hasMultipleSelection: true
    })

    expect(options).toHaveLength(1)
    expect(options[0]?.label).toBe('contextMenu.Convert to Subgraph')
    expect(options[0]?.action).toBe(subgraphMocks.convertToSubgraph)
  })

  it('includes convert, add to library, and unpack when subgraphs are selected', () => {
    const { getSubgraphOptions } = useSelectionMenuOptions()
    const options = getSubgraphOptions({
      hasSubgraphs: true,
      hasMultipleSelection: true
    })
    const labels = options.map((option) => option.label)

    expect(labels).toContain('contextMenu.Convert to Subgraph')
    expect(labels).toContain('contextMenu.Add Subgraph to Library')
    expect(labels).toContain('contextMenu.Unpack Subgraph')

    const convertOption = options.find(
      (option) => option.label === 'contextMenu.Convert to Subgraph'
    )
    expect(convertOption?.action).toBe(subgraphMocks.convertToSubgraph)
  })

  it('hides convert option when only a single subgraph is selected', () => {
    const { getSubgraphOptions } = useSelectionMenuOptions()
    const options = getSubgraphOptions({
      hasSubgraphs: true,
      hasMultipleSelection: false
    })

    const labels = options.map((option) => option.label)
    expect(labels).not.toContain('contextMenu.Convert to Subgraph')
    expect(labels).toEqual([
      'contextMenu.Add Subgraph to Library',
      'contextMenu.Unpack Subgraph'
    ])
  })
})
