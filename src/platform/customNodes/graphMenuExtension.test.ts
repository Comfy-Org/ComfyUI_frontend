import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  fromLGraphNode: vi.fn(),
  packs: {
    value: [] as { revisionId: string; name: string; uploadedAt: string }[]
  },
  refresh: vi.fn(),
  registerExtension: vi.fn(),
  show: vi.fn(),
  toast: vi.fn()
}))

vi.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params?.name ? `${key}:${String(params.name)}` : key
}))

vi.mock('@/scripts/app', () => ({
  app: { registerExtension: mocks.registerExtension }
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({ fromLGraphNode: mocks.fromLGraphNode })
}))

vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mocks.toast })
}))

vi.mock('./composables/useCustomNodeEditor', () => ({
  useCustomNodeEditor: () => ({ createSession: mocks.createSession })
}))

vi.mock('./composables/useCustomNodeEditorDialog', () => ({
  useCustomNodeEditorDialog: () => ({ show: mocks.show })
}))

vi.mock('./composables/useCustomNodePacks', () => ({
  useCustomNodePacks: () => ({
    packs: mocks.packs,
    refresh: mocks.refresh
  })
}))

import {
  customNodeCanvasMenuItems,
  customNodeNodeMenuItems
} from './graphMenuExtension'

const node = {} as LGraphNode

describe('customNodeCanvasMenuItems', () => {
  beforeEach(() => {
    mocks.packs.value = []
    mocks.refresh.mockReset().mockResolvedValue(undefined)
    mocks.createSession.mockReset().mockResolvedValue({ id: 'session-1' })
    mocks.show.mockReset()
    mocks.fromLGraphNode.mockReset()
  })

  it('creates directly into a new pack when the workspace has none', async () => {
    const items = customNodeCanvasMenuItems()
    expect(items).toHaveLength(1)
    expect(items[0].content).toBe('customNodePacks.graphMenu.createNode')
    expect(items[0].has_submenu).toBeUndefined()

    await (items[0].callback as () => void | Promise<void>)()
    await vi.waitFor(() => {
      expect(mocks.createSession).toHaveBeenCalledWith({
        mode: 'create',
        name: 'customNodePacks.editor.starterName',
        revisionId: undefined
      })
      expect(mocks.show).toHaveBeenCalled()
    })
  })

  it('offers a pack choice when packs exist', async () => {
    mocks.packs.value = [
      { revisionId: 'alpha-x01234567', name: 'Alpha Pack', uploadedAt: '' },
      { revisionId: 'beta-x89abcdef', name: 'Beta Pack', uploadedAt: '' }
    ]
    const items = customNodeCanvasMenuItems()
    expect(items).toHaveLength(1)
    expect(items[0].has_submenu).toBe(true)
    const options = items[0].submenu?.options as {
      content: string
      callback: () => void
    }[]
    expect(options.map((option) => option.content)).toEqual([
      'customNodePacks.graphMenu.inNewPack',
      'customNodePacks.graphMenu.inPack:Alpha Pack',
      'customNodePacks.graphMenu.inPack:Beta Pack'
    ])

    options[1].callback()
    await vi.waitFor(() => {
      expect(mocks.createSession).toHaveBeenCalledWith({
        mode: 'edit',
        name: 'Alpha Pack',
        revisionId: 'alpha-x01234567'
      })
    })
  })
})

describe('customNodeNodeMenuItems', () => {
  beforeEach(() => {
    mocks.packs.value = [
      { revisionId: 'alpha-x01234567', name: 'Alpha Pack', uploadedAt: '' }
    ]
    mocks.refresh.mockReset().mockResolvedValue(undefined)
    mocks.createSession.mockReset().mockResolvedValue({ id: 'session-1' })
    mocks.show.mockReset()
    mocks.fromLGraphNode.mockReset()
  })

  it('offers Edit Node for the workspace’s own pack nodes', async () => {
    mocks.fromLGraphNode.mockReturnValue({
      python_module: 'custom_nodes.pack_alpha_x01234567.nodes.thing'
    })
    const items = customNodeNodeMenuItems(node)
    expect(items).toHaveLength(1)
    expect(items[0].content).toBe('customNodePacks.graphMenu.editNode')

    ;(items[0].callback as () => void)()
    await vi.waitFor(() => {
      expect(mocks.createSession).toHaveBeenCalledWith({
        mode: 'edit',
        name: 'Alpha Pack',
        revisionId: 'alpha-x01234567'
      })
      expect(mocks.show).toHaveBeenCalled()
    })
  })

  it('offers nothing for registry packs and core nodes', () => {
    mocks.fromLGraphNode.mockReturnValue({
      python_module: 'custom_nodes.pack_registry_x99999999.nodes.thing'
    })
    expect(customNodeNodeMenuItems(node)).toHaveLength(0)

    mocks.fromLGraphNode.mockReturnValue({ python_module: 'nodes' })
    expect(customNodeNodeMenuItems(node)).toHaveLength(0)

    mocks.fromLGraphNode.mockReturnValue(null)
    expect(customNodeNodeMenuItems(node)).toHaveLength(0)
  })
})
