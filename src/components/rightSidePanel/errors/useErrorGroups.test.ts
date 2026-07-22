import { fromAny } from '@total-typescript/shoehorn'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MissingNodeType } from '@/types/comfy'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import type * as GraphTraversalUtil from '@/utils/graphTraversalUtil'

vi.mock('@/scripts/app', () => ({
  app: {
    isGraphReady: true,
    rootGraph: {
      serialize: vi.fn(() => ({})),
      getNodeById: vi.fn()
    }
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByExecutionId: vi.fn(),
  getExecutionIdByNode: vi.fn(),
  getRootParentNode: vi.fn(() => null),
  forEachNode: vi.fn(),
  mapAllNodes: vi.fn(() => [])
}))

const mockIsCloud = vi.hoisted(() => ({ value: false }))
const unknownValidationMessage = vi.hoisted(
  () => 'A node returned a validation error ComfyUI does not recognize.'
)
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock('@/i18n', () => {
  const messages: Record<string, string> = {
    'errorCatalog.validationErrors.required_input_missing.title':
      'Missing connection',
    'errorCatalog.validationErrors.required_input_missing.message':
      'Required input slots have no connection feeding them.',
    'errorCatalog.validationErrors.required_input_missing.details':
      '{nodeName} is missing a required input: {inputName}',
    'errorCatalog.validationErrors.required_input_missing.itemLabel':
      '{nodeName} - {inputName}',
    'errorCatalog.validationErrors.required_input_missing.toastTitle':
      'Required input missing',
    'errorCatalog.validationErrors.required_input_missing.toastMessage':
      '{nodeName} is missing a required input: {inputName}',
    'errorCatalog.validationErrors.unknown_validation_error.title':
      'Validation failed',
    'errorCatalog.validationErrors.unknown_validation_error.message':
      unknownValidationMessage,
    'errorCatalog.validationErrors.unknown_validation_error.detailsWithRawDetails':
      '{nodeName} returned an unrecognized validation error ({errorType}): {rawDetails}',
    'errorCatalog.validationErrors.unknown_validation_error.itemLabel':
      '{nodeName}',
    'errorCatalog.validationErrors.unknown_validation_error.toastTitle':
      'Validation failed',
    'errorCatalog.validationErrors.unknown_validation_error.toastMessage':
      '{nodeName} returned an unrecognized validation error.',
    'errorCatalog.validationErrors.workspace_partner_node_disabled.title':
      'Disabled node',
    'errorCatalog.validationErrors.workspace_partner_node_disabled.titlePlural':
      'Disabled nodes',
    'errorCatalog.validationErrors.workspace_partner_node_disabled.message':
      'This node has been disabled by your team admin. Use a different node.',
    'errorCatalog.validationErrors.workspace_partner_node_disabled.messagePlural':
      'These nodes have been disabled by your team admin. Use different nodes.',
    'errorCatalog.validationErrors.workspace_partner_node_disabled.itemLabel':
      '{nodeName}',
    'errorCatalog.validationErrors.workspace_partner_node_disabled.toastTitle':
      'Partner nodes',
    'errorCatalog.validationErrors.workspace_partner_node_disabled.toastMessage':
      'This node has been disabled by your team admin.',
    'errorCatalog.promptErrors.prompt_no_outputs.title':
      'Prompt has no outputs',
    'errorCatalog.promptErrors.prompt_no_outputs.desc':
      'The workflow does not contain any output nodes (e.g. Save Image, Preview Image) to produce a result.',
    'errorCatalog.runtimeErrors.execution_failed.title': 'Execution failed',
    'errorCatalog.runtimeErrors.execution_failed.message':
      'Node threw an error during execution.',
    'errorCatalog.runtimeErrors.execution_failed.itemLabel': '{nodeName}',
    'errorCatalog.runtimeErrors.execution_failed.toastTitle':
      '{nodeName} failed',
    'errorCatalog.runtimeErrors.execution_failed.toastMessage':
      'This node threw an error during execution. Check its inputs or try a different configuration.',
    'errorCatalog.runtimeErrors.out_of_memory.title': 'Generation failed',
    'errorCatalog.runtimeErrors.out_of_memory.message':
      'Not enough GPU memory. Try reducing image resolution or batch size and run again.',
    'errorCatalog.runtimeErrors.out_of_memory.itemLabel': '{nodeName}',
    'errorCatalog.runtimeErrors.out_of_memory.toastTitle': 'Generation failed',
    'errorCatalog.runtimeErrors.out_of_memory.toastMessage':
      'Not enough GPU memory. Try reducing image resolution or batch size and run again.'
  }

  const interpolate = (
    message: string,
    params?: Record<string, string | number>
  ) =>
    message.replace(/\{(\w+)\}/g, (match, paramName) =>
      params?.[paramName] === undefined ? match : String(params[paramName])
    )

  return {
    te: vi.fn((key: string) => key in messages),
    st: vi.fn((key: string, fallback: string) => messages[key] ?? fallback),
    t: vi.fn((key: string, params?: Record<string, string | number>) => {
      if (key === 'errorOverlay.missingModels') {
        const count = Number(params?.count ?? 0)
        return `${count} required ${count === 1 ? 'model is' : 'models are'} missing`
      }

      return interpolate(messages[key] ?? key, params)
    })
  }
})

vi.mock('@/stores/comfyRegistryStore', () => ({
  useComfyRegistryStore: () => ({
    inferPackFromNodeName: vi.fn()
  })
}))

vi.mock('@/utils/nodeTitleUtil', () => ({
  resolveNodeDisplayName: vi.fn(() => '')
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: vi.fn(() => false)
}))

vi.mock(
  '@/platform/missingModel/composables/useMissingModelInteractions',
  () => ({
    clearMissingModelState: vi.fn()
  })
)

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { nodeError, validationError } from '@/utils/__tests__/nodeErrorHelpers'
import { createBoundaryLinkedSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import {
  getExecutionIdByNode,
  getNodeByExecutionId
} from '@/utils/graphTraversalUtil'
import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useErrorGroups } from './useErrorGroups'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'

function makeMissingNodeType(
  type: string,
  opts: {
    nodeId?: string
    isReplaceable?: boolean
    cnrId?: string
    replacement?: { new_node_id: string }
  } = {}
): MissingNodeType {
  return {
    type,
    nodeId: opts.nodeId ?? '1',
    isReplaceable: opts.isReplaceable ?? false,
    cnrId: opts.cnrId,
    replacement: opts.replacement
      ? {
          old_node_id: type,
          new_node_id: opts.replacement.new_node_id,
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        }
      : undefined
  }
}

function makeModel(
  name: string,
  opts: {
    nodeId?: string | number
    widgetName?: string
    directory?: string
    isAssetSupported?: boolean
  } = {}
) {
  return {
    name,
    nodeId: opts.nodeId ?? '1',
    nodeType: 'CheckpointLoaderSimple',
    widgetName: opts.widgetName ?? 'ckpt_name',
    isAssetSupported: opts.isAssetSupported ?? false,
    isMissing: true as const,
    directory: opts.directory
  }
}

function makeMedia(
  name: string,
  opts: {
    nodeId: string | number
    nodeType?: string
    widgetName?: string
  }
): MissingMediaCandidate {
  return {
    name,
    nodeId: opts.nodeId,
    nodeType: opts.nodeType ?? 'LoadImage',
    widgetName: opts.widgetName ?? 'image',
    mediaType: 'image',
    isMissing: true
  }
}

function createErrorGroups() {
  const store = useExecutionErrorStore()
  const searchQuery = ref('')
  const groups = useErrorGroups(searchQuery)
  return { store, searchQuery, groups }
}

describe('useErrorGroups', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockIsCloud.value = false
    vi.mocked(isLGraphNode).mockReturnValue(false)
    vi.mocked(getNodeByExecutionId).mockReset()
  })

  describe('missingPackGroups', () => {
    it('returns empty array when no missing nodes', () => {
      const { groups } = createErrorGroups()
      expect(groups.missingPackGroups.value).toEqual([])
    })

    it('groups non-replaceable nodes by cnrId', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('NodeA', { cnrId: 'pack-1' }),
        makeMissingNodeType('NodeB', { cnrId: 'pack-1', nodeId: '2' }),
        makeMissingNodeType('NodeC', { cnrId: 'pack-2', nodeId: '3' })
      ])
      await nextTick()

      expect(groups.missingPackGroups.value).toHaveLength(2)
      const pack1 = groups.missingPackGroups.value.find(
        (g) => g.packId === 'pack-1'
      )
      expect(pack1?.nodeTypes).toHaveLength(2)
      const pack2 = groups.missingPackGroups.value.find(
        (g) => g.packId === 'pack-2'
      )
      expect(pack2?.nodeTypes).toHaveLength(1)
    })

    it('excludes replaceable nodes from missingPackGroups', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('OldNode', {
          isReplaceable: true,
          replacement: { new_node_id: 'NewNode' }
        }),
        makeMissingNodeType('MissingNode', {
          nodeId: '2',
          cnrId: 'some-pack'
        })
      ])
      await nextTick()

      expect(groups.missingPackGroups.value).toHaveLength(1)
      expect(groups.missingPackGroups.value[0].packId).toBe('some-pack')
    })

    it('groups nodes without cnrId under null packId', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('UnknownNode', { nodeId: '1' }),
        makeMissingNodeType('AnotherUnknown', { nodeId: '2' })
      ])
      await nextTick()

      expect(groups.missingPackGroups.value).toHaveLength(1)
      expect(groups.missingPackGroups.value[0].packId).toBeNull()
      expect(groups.missingPackGroups.value[0].nodeTypes).toHaveLength(2)
    })

    it('sorts groups alphabetically with null packId last', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('NodeA', { cnrId: 'zebra-pack' }),
        makeMissingNodeType('NodeB', { nodeId: '2' }),
        makeMissingNodeType('NodeC', { cnrId: 'alpha-pack', nodeId: '3' })
      ])
      await nextTick()

      const packIds = groups.missingPackGroups.value.map((g) => g.packId)
      expect(packIds).toEqual(['alpha-pack', 'zebra-pack', null])
    })

    it('sorts nodeTypes within each group alphabetically by type then nodeId', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('NodeB', { cnrId: 'pack-1', nodeId: '2' }),
        makeMissingNodeType('NodeA', { cnrId: 'pack-1', nodeId: '3' }),
        makeMissingNodeType('NodeA', { cnrId: 'pack-1', nodeId: '1' })
      ])
      await nextTick()

      const group = groups.missingPackGroups.value[0]
      const types = group.nodeTypes.map((n) =>
        typeof n === 'string' ? n : `${n.type}:${n.nodeId}`
      )
      expect(types).toEqual(['NodeA:1', 'NodeA:3', 'NodeB:2'])
    })

    it('handles string nodeType entries', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        fromAny<MissingNodeType, unknown>('StringGroupNode')
      ])
      await nextTick()

      expect(groups.missingPackGroups.value).toHaveLength(1)
      expect(groups.missingPackGroups.value[0].packId).toBeNull()
    })
  })

  describe('allErrorGroups', () => {
    it('returns empty array when no errors', () => {
      const { groups } = createErrorGroups()
      expect(groups.allErrorGroups.value).toEqual([])
    })

    it('includes missing_node group when missing nodes exist', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('NodeA', { cnrId: 'pack-1' })
      ])
      await nextTick()

      const missingGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'missing_node'
      )
      expect(missingGroup).toBeDefined()
      expect(missingGroup?.groupKey).toBe('missing_node')
      expect(missingGroup?.displayTitle).toBe('Missing Node Packs')
      expect(missingGroup?.displayMessage).toBe(
        'Install missing packs to use this workflow.'
      )
    })

    it('uses Cloud copy for missing_node group in Cloud', async () => {
      mockIsCloud.value = true
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('NodeA', { cnrId: 'pack-1' })
      ])
      await nextTick()

      const missingGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'missing_node'
      )
      expect(missingGroup?.displayMessage).toBe(
        "Required custom nodes aren't supported on Cloud. Replace them with supported nodes."
      )
    })

    it('includes swap_nodes group when replaceable nodes exist', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('OldNode', {
          isReplaceable: true,
          replacement: { new_node_id: 'NewNode' }
        })
      ])
      await nextTick()

      const swapGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'swap_nodes'
      )
      expect(swapGroup).toBeDefined()
    })

    it('includes both swap_nodes and missing_node when both exist', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('OldNode', {
          isReplaceable: true,
          replacement: { new_node_id: 'NewNode' }
        }),
        makeMissingNodeType('MissingNode', {
          nodeId: '2',
          cnrId: 'some-pack'
        })
      ])
      await nextTick()

      const types = groups.allErrorGroups.value.map((g) => g.type)
      expect(types).toContain('swap_nodes')
      expect(types).toContain('missing_node')
    })

    it('swap_nodes has lower priority than missing_node', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('OldNode', {
          isReplaceable: true,
          replacement: { new_node_id: 'NewNode' }
        }),
        makeMissingNodeType('MissingNode', {
          nodeId: '2',
          cnrId: 'some-pack'
        })
      ])
      await nextTick()

      const swapIdx = groups.allErrorGroups.value.findIndex(
        (g) => g.type === 'swap_nodes'
      )
      const missingIdx = groups.allErrorGroups.value.findIndex(
        (g) => g.type === 'missing_node'
      )
      expect(swapIdx).toBeLessThan(missingIdx)
    })

    it('uses fallback catalog grouping for unknown node validation errors', async () => {
      const { store, groups } = createErrorGroups()
      store.recordNodeErrors({
        '1': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [
            {
              type: 'value_not_valid',
              message: 'Value not valid',
              details: 'some detail'
            }
          ]
        }
      })
      await nextTick()

      const execGroups = groups.allErrorGroups.value.filter(
        (g) => g.type === 'execution'
      )
      expect(execGroups.length).toBeGreaterThan(0)
      expect(execGroups[0].groupKey).toBe('execution:unknown_validation_error')
      expect(execGroups[0].displayTitle).toBe('Validation failed')
    })

    it('resolves required_input_missing item display copy', async () => {
      const { store, groups } = createErrorGroups()
      store.recordNodeErrors({
        '1': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [
            {
              type: 'required_input_missing',
              message: 'Required input is missing',
              details: 'model',
              extra_info: {
                input_name: 'model'
              }
            }
          ]
        }
      })
      await nextTick()

      const execGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'execution'
      )
      expect(execGroup?.type).toBe('execution')
      if (execGroup?.type !== 'execution') return

      const card = execGroup.cards[0]
      const error = card.errors[0]

      expect(error.message).toBe('Required input is missing')
      expect(error.details).toBe('model')
      expect(error.catalogId).toBe('missing_connection')
      expect(error.displayTitle).toBe('Missing connection')
      expect(error.displayMessage).toBe(
        'Required input slots have no connection feeding them.'
      )
      expect(error.displayDetails).toBe(
        'KSampler is missing a required input: model'
      )
      expect(error.displayItemLabel).toBe('KSampler - model')
      expect(error.toastTitle).toBe('Required input missing')
      expect(error.toastMessage).toBe(
        'KSampler is missing a required input: model'
      )
    })

    it('groups workspace-disabled partner nodes with names and count', async () => {
      const { store, groups } = createErrorGroups()
      store.recordNodeErrors({
        '1': {
          class_type: 'FluxFill',
          dependent_outputs: [],
          errors: [
            {
              type: 'workspace_partner_node_disabled',
              message: 'Disabled by workspace policy',
              details: ''
            }
          ]
        },
        '2': {
          class_type: 'VeoVideo',
          dependent_outputs: [],
          errors: [
            {
              type: 'workspace_partner_node_disabled',
              message: 'Disabled by workspace policy',
              details: ''
            }
          ]
        }
      })
      await nextTick()

      const group = groups.allErrorGroups.value.find(
        (entry) =>
          entry.groupKey === 'execution:workspace_partner_node_disabled'
      )
      expect(group?.type).toBe('execution')
      if (group?.type !== 'execution') return

      expect(group.displayTitle).toBe('Disabled nodes')
      expect(group.displayMessage).toBe(
        'These nodes have been disabled by your team admin. Use different nodes.'
      )
      expect(group.count).toBe(2)
      expect(
        group.cards.flatMap((card) =>
          card.errors.map((error) => error.displayItemLabel)
        )
      ).toEqual(['FluxFill', 'VeoVideo'])
      expect(
        group.cards.flatMap((card) =>
          card.errors.map((error) => error.displayDetails)
        )
      ).toEqual([undefined, undefined])
    })

    it('groups lifted boundary errors under the host node card', async () => {
      const { store, groups } = createErrorGroups()
      const { rootGraph, host } = createBoundaryLinkedSubgraph({
        interiorType: 'InteriorClass'
      })
      const { getNodeByExecutionId: actualGetNodeByExecutionId } =
        await vi.importActual<typeof GraphTraversalUtil>(
          '@/utils/graphTraversalUtil'
        )
      vi.mocked(getNodeByExecutionId).mockImplementation((_, nodeId) => {
        return actualGetNodeByExecutionId(rootGraph, String(nodeId))
      })
      store.recordNodeErrors({
        '12:5': nodeError(
          [
            validationError(
              'required_input_missing',
              'seed_input',
              {},
              'Required input is missing'
            )
          ],
          'InteriorClass'
        )
      })
      await nextTick()

      const execGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'execution'
      )
      expect(execGroup?.type).toBe('execution')
      if (execGroup?.type !== 'execution') return

      const card = execGroup.cards[0]
      expect(card.nodeId).toBe('12')
      expect(card.title).toBe(host.title)
      expect(card.errors[0].displayDetails).toBe(
        `${host.title} is missing a required input: seed`
      )
    })

    it('groups node validation errors by catalog id across node types', async () => {
      const { store, groups } = createErrorGroups()
      store.recordNodeErrors({
        '1': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [
            {
              type: 'required_input_missing',
              message: 'Required input is missing',
              details: 'model',
              extra_info: {
                input_name: 'model'
              }
            }
          ]
        },
        '2': {
          class_type: 'CLIPLoader',
          dependent_outputs: [],
          errors: [
            {
              type: 'required_input_missing',
              message: 'Required input is missing',
              details: 'clip',
              extra_info: {
                input_name: 'clip'
              }
            }
          ]
        }
      })
      await nextTick()

      const execGroups = groups.allErrorGroups.value.filter(
        (g) => g.type === 'execution'
      )
      expect(execGroups).toHaveLength(1)

      const [group] = execGroups
      expect(group.groupKey).toBe('execution:missing_connection')
      expect(group.displayTitle).toBe('Missing connection')
      expect(group.cards.map((card) => card.title)).toEqual([
        'KSampler',
        'CLIPLoader'
      ])
      expect(group.cards.flatMap((card) => card.errors)).toHaveLength(2)
    })

    it('uses general execution_failed display fields for unrecognized runtime execution errors', async () => {
      mockIsCloud.value = true
      const { store, groups } = createErrorGroups()
      store.recordExecutionError({
        prompt_id: 'test-prompt',
        timestamp: Date.now(),
        node_id: 5,
        node_type: 'KSampler',
        executed: [],
        exception_type: 'RuntimeError',
        exception_message: 'mat1 and mat2 shapes cannot be multiplied',
        traceback: ['line 1', 'line 2'],
        current_inputs: {},
        current_outputs: {}
      })
      await nextTick()

      const execGroups = groups.allErrorGroups.value.filter(
        (g) => g.type === 'execution'
      )
      expect(execGroups.length).toBeGreaterThan(0)
      if (execGroups[0].type !== 'execution') return
      expect(execGroups[0].cards[0].errors[0]).toMatchObject({
        message: 'RuntimeError: mat1 and mat2 shapes cannot be multiplied',
        details: 'line 1\nline 2',
        isRuntimeError: true,
        exceptionType: 'RuntimeError',
        catalogId: 'execution_failed',
        displayTitle: 'Execution failed',
        displayMessage: 'Node threw an error during execution.',
        displayItemLabel: 'KSampler',
        toastTitle: 'KSampler failed',
        toastMessage:
          'This node threw an error during execution. Check its inputs or try a different configuration.'
      })
    })

    it('adds display fields for targeted runtime execution errors', async () => {
      mockIsCloud.value = true
      const { store, groups } = createErrorGroups()
      store.recordExecutionError({
        prompt_id: 'test-prompt',
        timestamp: Date.now(),
        node_id: 5,
        node_type: 'KSampler',
        executed: [],
        exception_type: 'torch.OutOfMemoryError',
        exception_message:
          'Allocation on device 0 failed.\nThis error means you ran out of memory on your GPU.',
        traceback: ['line 1', 'line 2'],
        current_inputs: {},
        current_outputs: {}
      })
      await nextTick()

      const execGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'execution'
      )
      expect(execGroup?.type).toBe('execution')
      if (execGroup?.type !== 'execution') return

      const error = execGroup.cards[0].errors[0]
      expect(error.message).toContain('torch.OutOfMemoryError:')
      expect(error.catalogId).toBe('out_of_memory')
      expect(error.displayMessage).toBe(
        'Not enough GPU memory. Try reducing image resolution or batch size and run again.'
      )
      expect(error.displayItemLabel).toBe('KSampler')
      expect(error.toastTitle).toBe('Generation failed')
    })

    it('includes prompt error when present', async () => {
      const { store, groups } = createErrorGroups()
      store.recordPromptError({
        type: 'prompt_no_outputs',
        message: 'No outputs',
        details: ''
      })
      await nextTick()

      const promptGroup = groups.allErrorGroups.value.find(
        (g) =>
          g.type === 'execution' && g.displayTitle === 'Prompt has no outputs'
      )
      expect(promptGroup).toBeDefined()
    })

    it('includes prompt error when a node is selected', async () => {
      const { store, groups } = createErrorGroups()
      const canvasStore = useCanvasStore()
      vi.mocked(isLGraphNode).mockReturnValue(true)
      canvasStore.selectedItems = fromAny<
        typeof canvasStore.selectedItems,
        unknown
      >([{ id: '1' }])
      store.recordPromptError({
        type: 'prompt_no_outputs',
        message: 'No outputs',
        details: ''
      })
      await nextTick()

      const promptGroup = groups.allErrorGroups.value.find(
        (g) =>
          g.type === 'execution' && g.displayTitle === 'Prompt has no outputs'
      )
      expect(promptGroup).toBeDefined()
    })

    it('sorts cards within an execution group by nodeId numerically', async () => {
      const { store, groups } = createErrorGroups()
      store.recordNodeErrors({
        '10': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        },
        '2': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        },
        '1': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        }
      })
      await nextTick()

      const execGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'execution'
      )
      const nodeIds = execGroup?.cards.map((c) => c.nodeId)
      expect(nodeIds).toEqual(['1', '2', '10'])
    })

    it('sorts cards with subpath nodeIds before higher root IDs', async () => {
      const { store, groups } = createErrorGroups()
      store.recordNodeErrors({
        '2': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        },
        '1:20': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        },
        '1': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        }
      })
      await nextTick()

      const execGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'execution'
      )
      const nodeIds = execGroup?.cards.map((c) => c.nodeId)
      expect(nodeIds).toEqual(['1', '1:20', '2'])
    })

    it('sorts deeply nested nodeIds by each segment numerically', async () => {
      const { store, groups } = createErrorGroups()
      store.recordNodeErrors({
        '10:11:99': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        },
        '10:11:12': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        },
        '10:2': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        }
      })
      await nextTick()

      const execGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'execution'
      )
      const nodeIds = execGroup?.cards.map((c) => c.nodeId)
      expect(nodeIds).toEqual(['10:2', '10:11:12', '10:11:99'])
    })
  })

  describe('filteredGroups', () => {
    it('returns all groups when search query is empty', async () => {
      const { store, groups } = createErrorGroups()
      store.recordNodeErrors({
        '1': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'value_error', message: 'Bad value', details: '' }]
        }
      })
      await nextTick()

      expect(groups.filteredGroups.value.length).toBeGreaterThan(0)
    })

    it('filters groups based on search query', async () => {
      const { store, groups, searchQuery } = createErrorGroups()
      store.recordNodeErrors({
        '1': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [
            {
              type: 'value_error',
              message: 'Value error in sampler',
              details: ''
            }
          ]
        },
        '2': {
          class_type: 'CLIPLoader',
          dependent_outputs: [],
          errors: [
            {
              type: 'file_not_found',
              message: 'File not found',
              details: ''
            }
          ]
        }
      })
      await nextTick()

      searchQuery.value = 'sampler'
      await nextTick()

      const executionGroups = groups.filteredGroups.value.filter(
        (g) => g.type === 'execution'
      )
      for (const group of executionGroups) {
        if (group.type !== 'execution') continue
        const hasMatch = group.cards.some(
          (c) =>
            c.title.toLowerCase().includes('sampler') ||
            c.errors.some((e) => e.message.toLowerCase().includes('sampler'))
        )
        expect(hasMatch).toBe(true)
      }
    })
  })

  describe('missingModelGroups', () => {
    it('returns empty array when no missing models', () => {
      const { groups } = createErrorGroups()
      expect(groups.missingModelGroups.value).toEqual([])
    })

    it('groups asset-supported models by directory', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([
        makeModel('model_a.safetensors', {
          directory: 'checkpoints',
          isAssetSupported: true
        }),
        makeModel('model_b.safetensors', {
          nodeId: '2',
          directory: 'checkpoints',
          isAssetSupported: true
        }),
        makeModel('lora_a.safetensors', {
          nodeId: '3',
          directory: 'loras',
          isAssetSupported: true
        })
      ])
      await nextTick()

      expect(groups.missingModelGroups.value).toHaveLength(2)
      const ckptGroup = groups.missingModelGroups.value.find(
        (g) => g.directory === 'checkpoints'
      )
      expect(ckptGroup?.models).toHaveLength(2)
      expect(ckptGroup?.isAssetSupported).toBe(true)
    })

    it('puts unsupported models in a separate group', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([
        makeModel('model_a.safetensors', {
          directory: 'checkpoints',
          isAssetSupported: true
        }),
        makeModel('custom_model.safetensors', {
          nodeId: '2',
          isAssetSupported: false
        })
      ])
      await nextTick()

      expect(groups.missingModelGroups.value).toHaveLength(2)
      const unsupported = groups.missingModelGroups.value.find(
        (g) => !g.isAssetSupported
      )
      expect(unsupported?.models).toHaveLength(1)
    })

    it('merges same-named models into one view model with multiple referencingNodes', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([
        makeModel('shared_model.safetensors', {
          nodeId: '1',
          widgetName: 'ckpt_name',
          directory: 'checkpoints',
          isAssetSupported: true
        }),
        makeModel('shared_model.safetensors', {
          nodeId: '2',
          widgetName: 'ckpt_name',
          directory: 'checkpoints',
          isAssetSupported: true
        })
      ])
      await nextTick()

      expect(groups.missingModelGroups.value).toHaveLength(1)
      const model = groups.missingModelGroups.value[0].models[0]
      expect(model.name).toBe('shared_model.safetensors')
      expect(model.referencingNodes).toHaveLength(2)
    })

    it('groups non-asset-supported models by directory in OSS', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([
        makeModel('model_a.safetensors', {
          directory: 'checkpoints',
          isAssetSupported: false
        }),
        makeModel('model_b.safetensors', {
          nodeId: '2',
          directory: 'checkpoints',
          isAssetSupported: false
        }),
        makeModel('lora_a.safetensors', {
          nodeId: '3',
          directory: 'loras',
          isAssetSupported: false
        })
      ])
      await nextTick()

      expect(groups.missingModelGroups.value).toHaveLength(2)
      const ckptGroup = groups.missingModelGroups.value.find(
        (g) => g.directory === 'checkpoints'
      )
      expect(ckptGroup?.models).toHaveLength(2)
      expect(ckptGroup?.isAssetSupported).toBe(false)
      const loraGroup = groups.missingModelGroups.value.find(
        (g) => g.directory === 'loras'
      )
      expect(loraGroup?.models).toHaveLength(1)
    })

    it('does not lump non-asset-supported models into UNSUPPORTED group in OSS', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([
        makeModel('model_a.safetensors', {
          directory: 'checkpoints',
          isAssetSupported: false
        }),
        makeModel('lora_a.safetensors', {
          nodeId: '2',
          directory: 'loras',
          isAssetSupported: false
        })
      ])
      await nextTick()

      const unsupported = groups.missingModelGroups.value.find(
        (g) => g.directory === null && !g.isAssetSupported
      )
      expect(unsupported).toBeUndefined()
    })

    it('includes missing_model group in allErrorGroups', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([makeModel('model_a.safetensors')])
      await nextTick()

      const modelGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'missing_model'
      )
      expect(modelGroup).toBeDefined()
      expect(modelGroup?.groupKey).toBe('missing_model')
      expect(modelGroup?.displayTitle).toBe('Missing Models')
    })
  })

  describe('missingModelGroups (Cloud)', () => {
    beforeEach(() => {
      mockIsCloud.value = true
    })

    afterEach(() => {
      mockIsCloud.value = false
    })

    it('puts unsupported models into UNSUPPORTED group in Cloud', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([
        makeModel('model_a.safetensors', {
          directory: 'checkpoints',
          isAssetSupported: false
        }),
        makeModel('model_b.safetensors', {
          nodeId: '2',
          directory: 'loras',
          isAssetSupported: false
        })
      ])
      await nextTick()

      expect(groups.missingModelGroups.value).toHaveLength(1)
      expect(groups.missingModelGroups.value[0].isAssetSupported).toBe(false)
      expect(groups.missingModelGroups.value[0].directory).toBeNull()
    })

    it('groups asset-supported models by directory in Cloud', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([
        makeModel('model_a.safetensors', {
          directory: 'checkpoints',
          isAssetSupported: true
        }),
        makeModel('model_b.safetensors', {
          nodeId: '2',
          directory: 'loras',
          isAssetSupported: true
        })
      ])
      await nextTick()

      expect(groups.missingModelGroups.value).toHaveLength(2)
      expect(
        groups.missingModelGroups.value.every((g) => g.isAssetSupported)
      ).toBe(true)
    })
  })

  describe('selection does not shrink displayed groups', () => {
    it('missingModelGroups returns total candidates regardless of selection', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([
        makeModel('a.safetensors', { nodeId: '1', directory: 'checkpoints' }),
        makeModel('b.safetensors', { nodeId: '2', directory: 'checkpoints' })
      ])
      vi.mocked(isLGraphNode).mockReturnValue(true)
      const canvasStore = useCanvasStore()
      canvasStore.selectedItems = fromAny<
        typeof canvasStore.selectedItems,
        unknown
      >([{ id: '1' }])
      await nextTick()

      // Displayed groups never shrink with canvas selection — the count
      // and list always describe the whole workflow.
      expect(groups.missingModelGroups.value).toHaveLength(1)
      expect(groups.missingModelGroups.value[0].models).toHaveLength(2)
      expect(
        groups.filteredGroups.value.find((g) => g.type === 'missing_model')
          ?.count
      ).toBe(2)
    })
  })

  describe('missing media counting', () => {
    it('counts missing media by affected node rows, not grouped filenames', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingMedia([
        makeMedia('shared.png', { nodeId: '1', nodeType: 'LoadImage' }),
        makeMedia('shared.png', { nodeId: '2', nodeType: 'PreviewImage' })
      ])
      await nextTick()

      expect(store.totalErrorCount).toBe(2)
      expect(groups.missingMediaGroups.value).toHaveLength(1)
      expect(groups.missingMediaGroups.value[0].items).toHaveLength(1)
      expect(
        groups.missingMediaGroups.value[0].items[0].referencingNodes
      ).toHaveLength(2)

      const missingMediaGroup = groups.allErrorGroups.value.find(
        (group) => group.type === 'missing_media'
      )
      expect(missingMediaGroup?.displayTitle).toBe('Missing Inputs')
    })
  })

  describe('selection emphasis', () => {
    it('never marks workflow-level prompt errors as matched by a selection', async () => {
      const { store, groups } = createErrorGroups()
      const canvasStore = useCanvasStore()
      vi.mocked(isLGraphNode).mockReturnValue(true)
      canvasStore.selectedItems = fromAny<
        typeof canvasStore.selectedItems,
        unknown
      >([{ id: '1' }])
      store.recordPromptError({
        type: 'prompt_no_outputs',
        message: 'No outputs',
        details: ''
      })
      await nextTick()

      const promptGroup = groups.allErrorGroups.value.find(
        (g) =>
          g.type === 'execution' && g.displayTitle === 'Prompt has no outputs'
      )
      expect(promptGroup).toBeDefined()
      expect(
        groups.selectionMatchedGroupKeys.value.has(promptGroup!.groupKey)
      ).toBe(false)
    })

    it('reports no selection state when nothing is selected', async () => {
      const { store, groups } = createErrorGroups()
      store.recordNodeErrors({
        '1': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'value_error', message: 'Bad value', details: '' }]
        }
      })
      await nextTick()

      expect(groups.hasSelection.value).toBe(false)
      expect(groups.selectionMatchedGroupKeys.value.size).toBe(0)
      expect(groups.selectionMatchedCardIds.value.size).toBe(0)
      expect(groups.selectionErrorCount.value).toBe(0)
    })

    it('matches groups and cards of the selected error node', async () => {
      const { store, groups } = createErrorGroups()
      const canvasStore = useCanvasStore()
      vi.mocked(isLGraphNode).mockReturnValue(true)
      const selectedNode = { id: '1' }
      vi.mocked(getNodeByExecutionId).mockImplementation((_, nodeId) =>
        fromAny<LGraphNode, unknown>(
          String(nodeId) === '1' ? selectedNode : { id: String(nodeId) }
        )
      )
      canvasStore.selectedItems = fromAny<
        typeof canvasStore.selectedItems,
        unknown
      >([selectedNode])
      store.recordNodeErrors({
        '1': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'value_error', message: 'Bad value', details: '' }]
        },
        '2': {
          class_type: 'CLIPLoader',
          dependent_outputs: [],
          errors: [
            { type: 'file_not_found', message: 'File not found', details: '' }
          ]
        }
      })
      await nextTick()

      expect(groups.hasSelection.value).toBe(true)
      expect(groups.selectionErrorCount.value).toBe(1)
      expect(groups.selectionMatchedCardIds.value.has('node-1')).toBe(true)
      expect(groups.selectionMatchedCardIds.value.has('node-2')).toBe(false)
      expect(groups.selectionMatchedAssetNodeIds.value.size).toBe(0)
      // Both error groups remain displayed regardless of the selection
      const executionGroups = groups.filteredGroups.value.filter(
        (g) => g.type === 'execution'
      )
      const displayedCardIds = executionGroups.flatMap((g) =>
        g.type === 'execution' ? g.cards.map((c) => c.id) : []
      )
      expect(displayedCardIds).toContain('node-1')
      expect(displayedCardIds).toContain('node-2')
    })

    it('narrows missing-node emphasis to packs containing the selected node', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      const canvasStore = useCanvasStore()
      vi.mocked(isLGraphNode).mockReturnValue(true)
      vi.mocked(getNodeByExecutionId).mockImplementation((_, nodeId) =>
        fromAny<LGraphNode, unknown>({ id: String(nodeId) })
      )
      canvasStore.selectedItems = fromAny<
        typeof canvasStore.selectedItems,
        unknown
      >([{ id: '2' }])
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('NodeB', { cnrId: 'pack-1', nodeId: '2' }),
        makeMissingNodeType('NodeC', { cnrId: 'pack-2', nodeId: '3' })
      ])
      await nextTick()

      // Emphasis counts only the packs containing the selected node…
      expect(groups.selectionMatchedGroupKeys.value.has('missing_node')).toBe(
        true
      )
      expect(groups.selectionErrorCount.value).toBe(1)
      // …and marks only the selected node for row highlighting.
      expect(groups.selectionMatchedAssetNodeIds.value.has('2')).toBe(true)
      expect(groups.selectionMatchedAssetNodeIds.value.has('3')).toBe(false)
      // Display still shows every pack.
      const missingNodeGroup = groups.filteredGroups.value.find(
        (g) => g.type === 'missing_node'
      )
      expect(missingNodeGroup?.count).toBe(2)
    })

    it('does not emphasize missing-node groups for unrelated selections', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      const canvasStore = useCanvasStore()
      vi.mocked(isLGraphNode).mockReturnValue(true)
      vi.mocked(getNodeByExecutionId).mockImplementation((_, nodeId) =>
        fromAny<LGraphNode, unknown>({ id: String(nodeId) })
      )
      canvasStore.selectedItems = fromAny<
        typeof canvasStore.selectedItems,
        unknown
      >([{ id: '99' }])
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('NodeB', { cnrId: 'pack-1', nodeId: '2' })
      ])
      await nextTick()

      expect(groups.selectionMatchedGroupKeys.value.has('missing_node')).toBe(
        false
      )
      expect(groups.selectionErrorCount.value).toBe(0)
      // Display is unaffected by the unrelated selection.
      expect(
        groups.filteredGroups.value.find((g) => g.type === 'missing_node')
          ?.count
      ).toBe(1)
    })

    it('matches errors through graph resolution, not raw execution ids', async () => {
      const { store, groups } = createErrorGroups()
      const canvasStore = useCanvasStore()
      vi.mocked(isLGraphNode).mockReturnValue(true)
      // The error is keyed by a subgraph execution id ('2:5') that resolves
      // to a different graph node id ('7') at the current graph level.
      const selectedNode = { id: '7' }
      vi.mocked(getNodeByExecutionId).mockImplementation((_, nodeId) =>
        fromAny<LGraphNode, unknown>(
          String(nodeId) === '2:5' ? selectedNode : undefined
        )
      )
      canvasStore.selectedItems = fromAny<
        typeof canvasStore.selectedItems,
        unknown
      >([selectedNode])
      store.recordNodeErrors({
        '2:5': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'value_error', message: 'Bad value', details: '' }]
        }
      })
      await nextTick()

      expect(groups.selectionErrorCount.value).toBe(1)
      expect(groups.selectionMatchedCardIds.value.has('node-2:5')).toBe(true)
    })

    it('matches interior errors when a subgraph container is selected', async () => {
      const { store, groups } = createErrorGroups()
      const canvasStore = useCanvasStore()
      vi.mocked(isLGraphNode).mockReturnValue(true)
      // A container selection matches interior errors by execution-id prefix,
      // even when the interior node does not resolve at the current level.
      const containerNode = fromAny<SubgraphNode, unknown>(
        Object.assign(Object.create(SubgraphNode.prototype), { id: '2' })
      )
      vi.mocked(getNodeByExecutionId).mockReturnValue(null)
      vi.mocked(getExecutionIdByNode).mockReturnValue(
        fromAny<NodeExecutionId, unknown>('2')
      )
      canvasStore.selectedItems = fromAny<
        typeof canvasStore.selectedItems,
        unknown
      >([containerNode])
      store.recordNodeErrors({
        '2:5': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'value_error', message: 'Bad value', details: '' }]
        },
        '9': {
          class_type: 'CLIPLoader',
          dependent_outputs: [],
          errors: [
            { type: 'file_not_found', message: 'File not found', details: '' }
          ]
        }
      })
      await nextTick()

      expect(groups.selectionErrorCount.value).toBe(1)
      expect(groups.selectionMatchedCardIds.value.has('node-2:5')).toBe(true)
      expect(groups.selectionMatchedCardIds.value.has('node-9')).toBe(false)
    })
  })
})
