import { render } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import { useSelectionMenuOptions } from '@/composables/graph/useSelectionMenuOptions'

const mocks = vi.hoisted(() => ({
  convertToSubgraph: vi.fn(),
  unpackSubgraph: vi.fn(),
  addSubgraphToLibrary: vi.fn(),
  frameNodes: vi.fn()
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

vi.mock<unknown>(import('@/composables/graph/useSelectionOperations'), () => ({
  useSelectionOperations: () => ({
    copySelection: vi.fn(),
    duplicateSelection: vi.fn(),
    deleteSelection: vi.fn(),
    renameSelection: vi.fn()
  })
}))

vi.mock<unknown>(import('@/composables/graph/useNodeArrangement'), () => ({
  useNodeArrangement: () => ({
    alignOptions: [{ localizedName: 'align-left', icon: 'align-left' }],
    distributeOptions: [{ localizedName: 'distribute', icon: 'distribute' }],
    applyAlign: vi.fn(),
    applyDistribute: vi.fn()
  })
}))

vi.mock<unknown>(import('@/composables/graph/useSubgraphOperations'), () => ({
  useSubgraphOperations: () => ({
    convertToSubgraph: mocks.convertToSubgraph,
    unpackSubgraph: mocks.unpackSubgraph,
    addSubgraphToLibrary: mocks.addSubgraphToLibrary
  })
}))

vi.mock<unknown>(import('@/composables/graph/useFrameNodes'), () => ({
  useFrameNodes: () => ({
    frameNodes: mocks.frameNodes
  })
}))

function setupComposable() {
  let composable!: ReturnType<typeof useSelectionMenuOptions>
  const Wrapper = defineComponent({
    setup() {
      composable = useSelectionMenuOptions()
      return () => null
    }
  })
  render(Wrapper, { global: { plugins: [i18n] } })
  return composable
}

describe('useSelectionMenuOptions - multiple nodes options', () => {
  it('returns Frame Nodes option that invokes frameNodes when called', () => {
    const { getMultipleNodesOptions } = setupComposable()
    const options = getMultipleNodesOptions()

    const frameOption = options.find((opt) => opt.label === 'g.frameNodes')
    expect(frameOption).toBeDefined()
    expect(frameOption?.action).toBeDefined()

    frameOption?.action?.()
    expect(mocks.frameNodes).toHaveBeenCalledOnce()
  })

  it('does not include a Convert to Group Node option', () => {
    const { getMultipleNodesOptions } = setupComposable()
    const options = getMultipleNodesOptions()

    const groupNodeOption = options.find(
      (opt) => opt.label === 'contextMenu.Convert to Group Node'
    )
    expect(groupNodeOption).toBeUndefined()
  })
})

describe('useSelectionMenuOptions - subgraph options', () => {
  it('returns only convert option when no subgraphs are selected', () => {
    const { getSubgraphOptions } = setupComposable()
    const options = getSubgraphOptions({
      hasSubgraphs: false,
      hasMultipleSelection: true
    })

    expect(options).toHaveLength(1)
    expect(options[0]?.label).toBe('contextMenu.Convert to Subgraph')
    expect(options[0]?.action).toBe(mocks.convertToSubgraph)
  })

  it('includes convert and unpack but hides add to library when multiple items with subgraphs are selected', () => {
    const { getSubgraphOptions } = setupComposable()
    const options = getSubgraphOptions({
      hasSubgraphs: true,
      hasMultipleSelection: true
    })
    const labels = options.map((option) => option.label)

    expect(labels).toContain('contextMenu.Convert to Subgraph')
    expect(labels).not.toContain('contextMenu.Add Subgraph to Library')
    expect(labels).toContain('contextMenu.Unpack Subgraph')
  })

  it('shows add to library and unpack when a single subgraph is selected', () => {
    const { getSubgraphOptions } = setupComposable()
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

    const addToLibraryOption = options.find(
      (option) => option.label === 'contextMenu.Add Subgraph to Library'
    )
    expect(addToLibraryOption?.action).toBe(mocks.addSubgraphToLibrary)
  })
})
