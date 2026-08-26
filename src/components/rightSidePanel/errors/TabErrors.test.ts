import { createTestingPinia } from '@pinia/testing'
import type { TestingPinia } from '@pinia/testing'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromAny } from '@total-typescript/shoehorn'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import RightSidePanel from '@/components/rightSidePanel/RightSidePanel.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import type { MissingNodeType } from '@/types/comfy'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'
import { nodeError, validationError } from '@/utils/__tests__/nodeErrorHelpers'

import TabErrors from './TabErrors.vue'

const { mockFocusNode, mockRefreshMissingModels } = vi.hoisted(() => ({
  mockFocusNode: vi.fn(),
  mockRefreshMissingModels: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: {
    refreshMissingModels: mockRefreshMissingModels,
    rootGraph: {
      serialize: vi.fn(() => ({})),
      getNodeById: vi.fn()
    }
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  collectAllNodes: vi.fn(() => []),
  getNodeByExecutionId: vi.fn(),
  getActiveGraphNodeIds: vi.fn(() => new Set()),
  getRootParentNode: vi.fn(() => null),
  forEachNode: vi.fn(),
  mapAllNodes: vi.fn(() => [])
}))

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: vi.fn(() => ({
    copyToClipboard: vi.fn()
  }))
}))

vi.mock('@/composables/canvas/useFocusNode', () => ({
  useFocusNode: vi.fn(() => ({
    focusNode: mockFocusNode
  }))
}))

// Its pack lookup resolves after the test file ends, and the console.warn on a
// rejection lands while the worker's rpc is closing - an unhandled error that
// fails the whole run with every test green. Mocked as the sibling suites do.
vi.mock('@/stores/comfyRegistryStore', () => ({
  useComfyRegistryStore: () => ({
    inferPackFromNodeName: vi.fn(),
    // TabErrors mounts the node-pack tree, which cancels this on unmount.
    getPacksByIds: { call: vi.fn().mockResolvedValue([]), cancel: vi.fn() }
  })
}))

vi.mock('@/platform/missingModel/missingModelDownload', () => ({
  downloadModel: vi.fn(),
  fetchModelMetadata: vi.fn(async () => ({
    fileSize: null,
    gatedRepoUrl: null
  })),
  isModelDownloadable: vi.fn(() => true),
  toBrowsableUrl: vi.fn((url: string) => url)
}))

describe('TabErrors.vue', () => {
  let i18n: ReturnType<typeof createI18n>

  beforeEach(() => {
    i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          g: {
            workflow: 'Workflow',
            copy: 'Copy',
            details: 'Details',
            findOnGithub: 'Find on GitHub',
            getHelpAction: 'Get Help'
          },
          rightSidePanel: {
            noErrors: 'No issues',
            noneSearchDesc: 'No results found',
            errorsDetected: 'Error detected | Errors detected',
            resolveBeforeRun: 'Resolve before running the workflow',
            issuesDetected: 'Issue detected | Issues detected',
            resolveErrorsBeforeRun:
              'Resolve errors before running the workflow',
            setupRequired: 'Setup required',
            finishSetupBeforeRun: 'Finish setup before running the workflow',
            severityCountsStatus: '{errors} blocking, {setup} setup required',
            errorsFilter: '{count} Error | {count} Errors',
            errorsFilterActive:
              '{count} Error detected | {count} Errors detected',
            setupFilter: '{count} Setup required',
            setupSummary: '{count} item | {count} items',
            setupNodeSummary:
              '{nodes} node — {count} item | {nodes} node — {count} items',
            setupNodesSummary:
              '{nodes} nodes — {count} item | {nodes} nodes — {count} items',
            nodesAffected: '{count} node affected | {count} nodes affected',
            errorsSummary: '{count} error | {count} errors',
            severityErrorLabel: 'Blocking errors',
            severitySetupLabel: 'Setup required',
            expand: 'Expand',
            collapse: 'Collapse',
            errorHelp: 'Error help',
            errorLog: 'Error log',
            findOnGithubTooltip: 'Search GitHub issues',
            getHelpTooltip: 'Get help',
            info: 'Info',
            infoFor: 'Info for {item}',
            locateNode: 'Locate node',
            locateNodeFor: 'Locate {item}',
            missingModels: {
              missingModelsTitle: 'Missing Models',
              downloadAll: 'Download all',
              refresh: 'Refresh',
              refreshing: 'Refreshing missing models.'
            },
            missingMedia: {
              missingMediaTitle: 'Missing Inputs'
            }
          }
        }
      }
    })
  })

  function renderComponent(seed?: (pinia: TestingPinia) => void) {
    const user = userEvent.setup()
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      stubActions: false
    })
    seed?.(pinia)
    render(TabErrors, {
      global: {
        plugins: [PrimeVue, i18n, pinia],
        stubs: {
          AsyncSearchInput: {
            template:
              '<input @input="$emit(\'update:modelValue\', $event.target.value)" />'
          },
          Button: {
            template: '<button v-bind="$attrs"><slot /></button>'
          }
        }
      }
    })
    return { user }
  }

  function renderRightSidePanel(seed: (pinia: TestingPinia) => void) {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      stubActions: false
    })
    useSettingStore(pinia).settingValues['Comfy.RightSidePanel.ShowErrorsTab'] =
      true
    seed(pinia)
    render(RightSidePanel, {
      global: {
        plugins: [PrimeVue, i18n, pinia],
        stubs: {
          EditableText: true,
          TabErrors: true,
          TabGlobalParameters: true,
          TabNodes: true,
          TabGlobalSettings: true,
          TabSettings: true,
          TabInfo: true,
          TabNormalInputs: true,
          TabSubgraphInputs: true,
          SubgraphEditor: true
        }
      }
    })
  }

  it('renders "no issues" state when store is empty', () => {
    renderComponent()
    expect(screen.getByText('No issues')).toBeInTheDocument()
  })

  it('renders prompt-level errors with resolved display message', async () => {
    renderComponent((pinia) => {
      useExecutionErrorStore(pinia).recordPromptError({
        type: 'prompt_no_outputs',
        message: 'Server Error: No outputs',
        details: 'Error details'
      })
    })

    expect(screen.getAllByText('Prompt has no outputs').length).toBeGreaterThan(
      0
    )
    expect(
      screen.getByText(
        'The workflow does not contain any output nodes (e.g. Save Image, Preview Image) to produce a result.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('Error details')).not.toBeInTheDocument()
  })

  it('renders node validation errors grouped by catalog copy', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockImplementation((_, nodeId) => {
      const titles: Record<string, string> = {
        '1': 'KSampler',
        '2': 'CLIP Text Encode'
      }
      return fromAny<
        NonNullable<ReturnType<typeof getNodeByExecutionId>>,
        unknown
      >({
        title: titles[String(nodeId)] ?? ''
      })
    })

    const { user } = renderComponent((pinia) => {
      useExecutionErrorStore(pinia).recordNodeErrors({
        '2': nodeError(
          [
            validationError(
              'required_input_missing',
              'clip',
              {},
              'Required input is missing',
              'Input: clip'
            )
          ],
          'CLIPTextEncode'
        ),
        '1': nodeError(
          [
            validationError(
              'required_input_missing',
              'positive',
              {},
              'Required input is missing',
              'Input: positive'
            ),
            validationError(
              'required_input_missing',
              'model',
              {},
              'Required input is missing',
              'Input: model'
            )
          ],
          'KSampler'
        )
      })
    })

    expect(screen.getByText('Missing connection')).toBeInTheDocument()
    const sectionBadge = within(
      screen.getByTestId('error-group-execution')
    ).getByTestId('error-section-count-badge')
    expect(sectionBadge).toHaveTextContent('3')
    expect(sectionBadge).toHaveAttribute('data-severity', 'error')
    expect(
      within(screen.getByTestId('errors-summary-hero')).getByText('3')
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('errors-summary-filters')
    ).not.toBeInTheDocument()
    expect(screen.getByText('Errors detected')).toBeInTheDocument()
    expect(
      screen.getByText('Resolve errors before running the workflow')
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(
        'Required input slots have no connection feeding them.'
      )
    ).toHaveLength(1)
    expect(screen.queryByText('#1')).not.toBeInTheDocument()
    expect(screen.queryByText('#2')).not.toBeInTheDocument()
    expect(screen.queryByText('KSampler')).not.toBeInTheDocument()
    expect(screen.queryByText('CLIP Text Encode')).not.toBeInTheDocument()

    const itemRows = screen.getAllByRole('listitem')
    expect(itemRows).toHaveLength(3)
    expect(itemRows[0]).toHaveTextContent('KSampler - model')
    expect(itemRows[1]).toHaveTextContent('KSampler - positive')
    expect(itemRows[2]).toHaveTextContent('CLIP Text Encode - clip')

    const infoButton = within(itemRows[1]).getByRole('button', {
      name: 'Info for KSampler - positive'
    })

    await user.click(infoButton)

    const itemDetail = screen.getByText(
      'KSampler is missing a required input: positive'
    )
    expect(infoButton).toHaveAttribute(
      'aria-controls',
      itemDetail.getAttribute('id')
    )

    const labelLocateButton = within(itemRows[1]).getByRole('button', {
      name: 'KSampler - positive'
    })

    await user.click(labelLocateButton)
    expect(mockFocusNode.mock.calls.at(-1)?.[0]).toBe('1')

    const iconLocateButton = within(itemRows[2]).getByRole('button', {
      name: 'Locate CLIP Text Encode - clip'
    })

    await user.click(iconLocateButton)
    expect(mockFocusNode.mock.calls.at(-1)?.[0]).toBe('2')

    expect(
      screen.queryByText('Required input is missing')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Input: model')).not.toBeInTheDocument()
    expect(screen.queryByText('Input: positive')).not.toBeInTheDocument()
    expect(screen.queryByText('Input: clip')).not.toBeInTheDocument()
  })

  it('renders runtime execution errors from WebSocket', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockReturnValue(
      fromAny<NonNullable<ReturnType<typeof getNodeByExecutionId>>, unknown>({
        title: 'KSampler'
      })
    )

    const { user } = renderComponent((pinia) => {
      useExecutionErrorStore(pinia).recordExecutionError({
        prompt_id: 'abc',
        node_id: '10',
        node_type: 'KSampler',
        executed: [],
        exception_message: 'Out of memory',
        exception_type: 'RuntimeError',
        traceback: ['Line 1', 'Line 2'],
        timestamp: Date.now()
      })
    })

    expect(screen.getAllByText('KSampler').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Execution failed')).toBeInTheDocument()
    expect(
      screen.getByText('Node threw an error during execution.')
    ).toBeInTheDocument()
    expect(screen.getByText('Error log')).toBeInTheDocument()
    expect(screen.getByText(/Line 1/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Details' }))

    expect(screen.queryByText(/Line 1/)).not.toBeInTheDocument()
  })

  it('filters errors based on search query', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockReturnValue(null)

    const { user } = renderComponent((pinia) => {
      useExecutionErrorStore(pinia).recordNodeErrors({
        '1': nodeError(
          [validationError('unknown', undefined, {}, 'Missing text input', '')],
          'CLIPTextEncode'
        ),
        '2': nodeError(
          [validationError('unknown', undefined, {}, 'Out of memory', '')],
          'KSampler'
        )
      })
    })

    expect(screen.getAllByText('CLIPTextEncode').length).toBeGreaterThanOrEqual(
      1
    )
    expect(screen.getAllByText('KSampler').length).toBeGreaterThanOrEqual(1)

    await user.type(screen.getByRole('textbox'), 'Missing text input')

    expect(screen.getAllByText('CLIPTextEncode').length).toBeGreaterThanOrEqual(
      1
    )
    expect(
      within(screen.getByTestId('errors-summary-hero')).getByText('1')
    ).toBeInTheDocument()
    expect(screen.queryByText('KSampler')).not.toBeInTheDocument()
  })

  it('calls copyToClipboard when a runtime error copy button is clicked', async () => {
    const { useCopyToClipboard } =
      await import('@/composables/useCopyToClipboard')
    const mockCopy = vi.fn()
    vi.mocked(useCopyToClipboard).mockReturnValue({ copyToClipboard: mockCopy })

    const { user } = renderComponent((pinia) => {
      useExecutionErrorStore(pinia).recordExecutionError({
        prompt_id: 'abc',
        node_id: '1',
        node_type: 'TestNode',
        executed: [],
        exception_message: 'Test message',
        exception_type: 'RuntimeError',
        traceback: ['Test details'],
        timestamp: Date.now()
      })
    })

    await user.click(screen.getByTestId('error-card-copy'))

    expect(mockCopy).toHaveBeenCalledWith(
      'Node threw an error during execution.\n\nTest details'
    )
  })

  it('renders a single runtime error in the normal execution group', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockReturnValue(
      fromAny<NonNullable<ReturnType<typeof getNodeByExecutionId>>, unknown>({
        title: 'KSampler'
      })
    )

    renderComponent((pinia) => {
      useExecutionErrorStore(pinia).recordExecutionError({
        prompt_id: 'abc',
        node_id: '10',
        node_type: 'KSampler',
        executed: [],
        exception_message: 'Out of memory',
        exception_type: 'RuntimeError',
        traceback: ['Line 1', 'Line 2'],
        timestamp: Date.now()
      })
    })

    expect(screen.getAllByText('KSampler').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Execution failed')).toBeInTheDocument()
    expect(
      within(screen.getByTestId('error-group-execution')).getByTestId(
        'runtime-error-panel'
      )
    ).toBeInTheDocument()
    expect(screen.getAllByText('Execution failed')).toHaveLength(1)
  })

  it('shows missing model Refresh in the section header when no model is downloadable', async () => {
    const missingModel = {
      nodeId: '1',
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      name: 'local-only.safetensors',
      directory: 'checkpoints',
      isMissing: true,
      isAssetSupported: true
    } satisfies MissingModelCandidate

    const { user } = renderComponent((pinia) => {
      useMissingModelStore(pinia).setMissingModels([missingModel])
    })

    expect(screen.getByText('Missing Models')).toBeInTheDocument()
    expect(
      screen.queryByTestId('missing-model-actions')
    ).not.toBeInTheDocument()

    await user.click(screen.getByTestId('missing-model-header-refresh'))

    expect(mockRefreshMissingModels).toHaveBeenCalledWith({ silent: true })
  })

  it('counts missing models per file when several share one directory', () => {
    renderComponent((pinia) => {
      useMissingModelStore(pinia).setMissingModels([
        {
          nodeId: '1',
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          name: 'model-a.safetensors',
          directory: 'checkpoints',
          isMissing: true,
          isAssetSupported: true
        },
        {
          nodeId: '2',
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          name: 'model-b.safetensors',
          directory: 'checkpoints',
          isMissing: true,
          isAssetSupported: true
        }
      ])
    })

    const sectionBadge = within(
      screen.getByTestId('error-group-missing-model')
    ).getByTestId('error-section-count-badge')
    expect(sectionBadge).toHaveTextContent('2')
    expect(sectionBadge).toHaveAttribute('data-severity', 'missing')
    const hero = screen.getByTestId('errors-summary-hero')
    expect(within(hero).getByText('2')).toBeInTheDocument()
    expect(within(hero).getByText('Setup required')).toBeInTheDocument()
    expect(
      within(hero).getByText('Finish setup before running the workflow')
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('errors-summary-filters')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('selection-context-strip')).toHaveTextContent(
      '2 nodes — 2 items'
    )
  })

  it('omits the node count from setup context with no known node ids', () => {
    renderComponent((pinia) => {
      useMissingNodesErrorStore(pinia).setMissingNodeTypes([
        'MissingNodeA',
        'MissingNodeB'
      ])
      useMissingModelStore(pinia).setMissingModels([
        {
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          name: 'workflow-model.safetensors',
          isMissing: true,
          isAssetSupported: false
        }
      ])
    })

    const contextStrip = screen.getByTestId('selection-context-strip')
    expect(contextStrip).toHaveTextContent('2 items')
    expect(contextStrip).not.toHaveTextContent('0 nodes')
  })

  it('uses an error count for mixed context with no known node ids', () => {
    renderComponent((pinia) => {
      useMissingModelStore(pinia).setMissingModels([
        {
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          name: 'workflow-model.safetensors',
          isMissing: true,
          isAssetSupported: false
        }
      ])
      useExecutionErrorStore(pinia).recordPromptError({
        type: 'prompt_no_outputs',
        message: 'No outputs',
        details: ''
      })
    })

    expect(screen.getByTestId('selection-context-strip')).toHaveTextContent(
      '1 error'
    )
  })

  it('renders missing model display message below the section title', () => {
    const missingModel = {
      nodeId: '1',
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      name: 'local-only.safetensors',
      directory: 'checkpoints',
      isMissing: true,
      isAssetSupported: true
    } satisfies MissingModelCandidate

    renderComponent((pinia) => {
      useMissingModelStore(pinia).setMissingModels([missingModel])
    })

    expect(screen.getByText('Missing Models')).toBeInTheDocument()
    expect(
      screen.getByText('Download a model, or open the node to replace it.')
    ).toBeInTheDocument()
  })

  it('renders missing media display message below the section title', () => {
    const missingMedia = {
      nodeId: '3',
      nodeType: 'LoadImage',
      widgetName: 'image',
      mediaType: 'image',
      name: 'portrait.png',
      isMissing: true
    } satisfies MissingMediaCandidate

    renderComponent((pinia) => {
      useMissingMediaStore(pinia).setMissingMedia([missingMedia])
    })

    expect(screen.getByText('Missing Inputs')).toBeInTheDocument()
    expect(
      screen.getByText('A required media input has no file selected.')
    ).toBeInTheDocument()
  })

  it('renders one missing media item per referencing node and locates the selected node', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockImplementation((_, nodeId) => {
      const titles: Record<string, string> = {
        '3': 'First Loader',
        '4': 'Second Loader'
      }
      return fromAny<
        NonNullable<ReturnType<typeof getNodeByExecutionId>>,
        unknown
      >({
        title: titles[String(nodeId)] ?? ''
      })
    })

    const { user } = renderComponent((pinia) => {
      useMissingMediaStore(pinia).setMissingMedia([
        {
          nodeId: '3',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          name: 'shared.png',
          isMissing: true
        },
        {
          nodeId: '4',
          nodeType: 'PreviewImage',
          widgetName: 'image',
          mediaType: 'image',
          name: 'shared.png',
          isMissing: true
        }
      ])
    })

    expect(screen.getAllByTestId('missing-media-row')).toHaveLength(2)
    expect(
      within(screen.getByTestId('error-group-missing-media')).getByText('2')
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('errors-summary-hero')).getByText('2')
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Second Loader - image' })
    )

    expect(mockFocusNode.mock.calls.at(-1)?.[0]).toBe('4')
  })

  it('totals mixed severities in the hero and splits them into filter chips', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockReturnValue(
      fromAny<NonNullable<ReturnType<typeof getNodeByExecutionId>>, unknown>({
        title: 'Node'
      })
    )

    renderComponent((pinia) => {
      useExecutionErrorStore(pinia).recordNodeErrors({
        '1': nodeError(
          [
            validationError(
              'required_input_missing',
              'model',
              {},
              'Required input is missing',
              'Input: model'
            ),
            validationError(
              'required_input_missing',
              'positive',
              {},
              'Required input is missing',
              'Input: positive'
            )
          ],
          'KSampler'
        ),
        '2': nodeError(
          [
            validationError(
              'required_input_missing',
              'clip',
              {},
              'Required input is missing',
              'Input: clip'
            )
          ],
          'CLIPTextEncode'
        )
      })
      useMissingMediaStore(pinia).setMissingMedia([
        {
          nodeId: '3',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          name: 'a.png',
          isMissing: true
        },
        {
          nodeId: '4',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          name: 'b.png',
          isMissing: true
        }
      ])
    })

    const hero = screen.getByTestId('errors-summary-hero')
    expect(within(hero).getByText('5')).toBeInTheDocument()
    expect(within(hero).getByText('Issues detected')).toBeInTheDocument()
    expect(screen.getByTestId('errors-summary-filter-error')).toHaveTextContent(
      '3 Errors'
    )
    expect(
      screen.getByTestId('errors-summary-filter-missing')
    ).toHaveTextContent('2 Setup required')
    expect(
      within(hero).getByText('3 blocking, 2 setup required')
    ).toBeInTheDocument()

    const contextStrip = screen.getByTestId('selection-context-strip')
    expect(contextStrip).toHaveTextContent('4 nodes affected')
    expect(contextStrip).not.toHaveTextContent(/errors/i)
  })

  it('releases the filter when a hidden issue is replaced by another', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockReturnValue(
      fromAny<NonNullable<ReturnType<typeof getNodeByExecutionId>>, unknown>({
        title: 'Node'
      })
    )

    let executionErrorStore!: ReturnType<typeof useExecutionErrorStore>
    renderComponent((pinia) => {
      executionErrorStore = useExecutionErrorStore(pinia)
      executionErrorStore.recordNodeErrors({
        '1': nodeError(
          [
            validationError(
              'required_input_missing',
              'model',
              {},
              'Required input is missing',
              'Input: model'
            )
          ],
          'KSampler'
        )
      })
      useMissingMediaStore(pinia).setMissingMedia([
        {
          nodeId: '3',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          name: 'a.png',
          isMissing: true
        }
      ])
    })

    const user = userEvent.setup()
    const missingChip = screen.getByTestId('errors-summary-filter-missing')
    await user.click(missingChip)
    expect(missingChip).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.queryByTestId('error-group-execution')
    ).not.toBeInTheDocument()

    // Hidden issue replaced in one update: the error total stays 1, but the
    // new issue must not stay silently filtered out.
    executionErrorStore.recordNodeErrors({
      '5': nodeError(
        [
          validationError(
            'required_input_missing',
            'clip',
            {},
            'Required input is missing',
            'Input: clip'
          )
        ],
        'CLIPTextEncode'
      )
    })
    await nextTick()

    expect(screen.getByTestId('errors-summary-filter-missing')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByTestId('error-group-execution')).toBeInTheDocument()
  })

  it('releases the filter when a hidden file gains another referencing node', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockReturnValue(
      fromAny<NonNullable<ReturnType<typeof getNodeByExecutionId>>, unknown>({
        title: 'Node'
      })
    )

    let mediaStore!: ReturnType<typeof useMissingMediaStore>
    renderComponent((pinia) => {
      useExecutionErrorStore(pinia).recordNodeErrors({
        '1': nodeError(
          [
            validationError(
              'required_input_missing',
              'model',
              {},
              'Required input is missing',
              'Input: model'
            )
          ],
          'KSampler'
        )
      })
      mediaStore = useMissingMediaStore(pinia)
      mediaStore.setMissingMedia([
        {
          nodeId: '3',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          name: 'a.png',
          isMissing: true
        }
      ])
    })

    const user = userEvent.setup()
    const errorChip = screen.getByTestId('errors-summary-filter-error')
    await user.click(errorChip)
    expect(
      screen.queryByTestId('error-group-missing-media')
    ).not.toBeInTheDocument()

    // Same file, new referencing node: the name-level identity is unchanged
    // but a new hidden row appeared, so the filter must release.
    mediaStore.setMissingMedia([
      {
        nodeId: '3',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'a.png',
        isMissing: true
      },
      {
        nodeId: '4',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'a.png',
        isMissing: true
      }
    ])
    await nextTick()

    expect(errorChip).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('error-group-missing-media')).toBeInTheDocument()
  })

  it('shows only the chosen severity while its filter chip is pressed', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockReturnValue(
      fromAny<NonNullable<ReturnType<typeof getNodeByExecutionId>>, unknown>({
        title: 'Node'
      })
    )

    renderComponent((pinia) => {
      useExecutionErrorStore(pinia).recordNodeErrors({
        '1': nodeError(
          [
            validationError(
              'required_input_missing',
              'model',
              {},
              'Required input is missing',
              'Input: model'
            )
          ],
          'KSampler'
        )
      })
      useMissingMediaStore(pinia).setMissingMedia([
        {
          nodeId: '3',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          name: 'a.png',
          isMissing: true
        }
      ])
    })

    expect(screen.getByTestId('error-group-execution')).toBeInTheDocument()
    expect(screen.getByTestId('error-group-missing-media')).toBeInTheDocument()

    const user = userEvent.setup()
    const errorChip = screen.getByTestId('errors-summary-filter-error')
    await user.click(errorChip)

    expect(errorChip).toHaveAttribute('aria-pressed', 'true')
    expect(errorChip).toHaveTextContent('1 Error detected')
    expect(screen.getByTestId('error-group-execution')).toBeInTheDocument()
    expect(
      screen.queryByTestId('error-group-missing-media')
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId('errors-summary-hero')).getByText('2')
    ).toBeInTheDocument()

    await user.click(errorChip)

    expect(errorChip).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('error-group-missing-media')).toBeInTheDocument()
  })

  it('releases the filter when the hidden severity gains a new entry', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockReturnValue(
      fromAny<NonNullable<ReturnType<typeof getNodeByExecutionId>>, unknown>({
        title: 'Node'
      })
    )

    let mediaStore!: ReturnType<typeof useMissingMediaStore>
    renderComponent((pinia) => {
      useExecutionErrorStore(pinia).recordNodeErrors({
        '1': nodeError(
          [
            validationError(
              'required_input_missing',
              'model',
              {},
              'Required input is missing',
              'Input: model'
            )
          ],
          'KSampler'
        )
      })
      mediaStore = useMissingMediaStore(pinia)
      mediaStore.setMissingMedia([
        {
          nodeId: '3',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          name: 'a.png',
          isMissing: true
        }
      ])
    })

    const user = userEvent.setup()
    const errorChip = screen.getByTestId('errors-summary-filter-error')
    await user.click(errorChip)
    expect(
      screen.queryByTestId('error-group-missing-media')
    ).not.toBeInTheDocument()

    mediaStore.setMissingMedia([
      {
        nodeId: '3',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'a.png',
        isMissing: true
      },
      {
        nodeId: '4',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'b.png',
        isMissing: true
      }
    ])
    await nextTick()

    expect(errorChip).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('error-group-missing-media')).toBeInTheDocument()
  })

  it('releases the filter when the selection carries the hidden severity', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockImplementation((_, executionId) =>
      fromAny<NonNullable<ReturnType<typeof getNodeByExecutionId>>, unknown>({
        id: String(executionId),
        title: 'Node'
      })
    )

    let canvasStore!: ReturnType<typeof useCanvasStore>
    let executionErrorStore!: ReturnType<typeof useExecutionErrorStore>
    renderComponent((pinia) => {
      canvasStore = useCanvasStore(pinia)
      executionErrorStore = useExecutionErrorStore(pinia)
      executionErrorStore.recordNodeErrors({
        '1': nodeError(
          [
            validationError(
              'required_input_missing',
              'model',
              {},
              'Required input is missing',
              'Input: model'
            )
          ],
          'KSampler'
        )
      })
      useMissingMediaStore(pinia).setMissingMedia([
        {
          nodeId: '3',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          name: 'a.png',
          isMissing: true
        },
        {
          nodeId: '4',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          name: 'b.png',
          isMissing: true
        }
      ])
    })

    const user = userEvent.setup()
    const errorChip = screen.getByTestId('errors-summary-filter-error')
    await user.click(errorChip)
    expect(
      screen.queryByTestId('error-group-missing-media')
    ).not.toBeInTheDocument()

    const missingMediaNode = new LGraphNode('LoadImage')
    missingMediaNode.id = toNodeId(3)
    canvasStore.selectedItems = [missingMediaNode]
    await nextTick()

    expect(errorChip).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('error-group-missing-media')).toBeInTheDocument()
  })

  it('holds an engaged filter until the selection membership changes', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockImplementation((_, executionId) =>
      fromAny<NonNullable<ReturnType<typeof getNodeByExecutionId>>, unknown>({
        id: String(executionId),
        title: 'Node'
      })
    )

    let canvasStore!: ReturnType<typeof useCanvasStore>
    let executionErrorStore!: ReturnType<typeof useExecutionErrorStore>
    renderComponent((pinia) => {
      canvasStore = useCanvasStore(pinia)
      executionErrorStore = useExecutionErrorStore(pinia)
      executionErrorStore.recordNodeErrors({
        '1': nodeError(
          [
            validationError(
              'required_input_missing',
              'model',
              {},
              'Required input is missing',
              'Input: model'
            )
          ],
          'KSampler'
        )
      })
      useMissingMediaStore(pinia).setMissingMedia([
        {
          nodeId: '3',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          name: 'a.png',
          isMissing: true
        }
      ])
    })

    const missingMediaNode = new LGraphNode('LoadImage')
    missingMediaNode.id = toNodeId(3)
    canvasStore.selectedItems = [missingMediaNode]
    await nextTick()

    const user = userEvent.setup()
    const errorChip = screen.getByTestId('errors-summary-filter-error')
    await user.click(errorChip)
    expect(errorChip).toHaveAttribute('aria-pressed', 'true')

    // Unrelated store churn recomputes the selection-scoped Set with
    // identical membership; the engaged filter must survive it.
    executionErrorStore.recordNodeErrors({
      '1': nodeError(
        [
          validationError(
            'required_input_missing',
            'model',
            {},
            'Required input is missing',
            'Input: model'
          )
        ],
        'KSampler'
      ),
      '5': nodeError(
        [
          validationError(
            'required_input_missing',
            'clip',
            {},
            'Required input is missing',
            'Input: clip'
          )
        ],
        'CLIPTextEncode'
      )
    })
    await nextTick()

    expect(errorChip).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.queryByTestId('error-group-missing-media')
    ).not.toBeInTheDocument()
  })

  it('releases the filter when its own severity empties', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockReturnValue(
      fromAny<NonNullable<ReturnType<typeof getNodeByExecutionId>>, unknown>({
        title: 'Node'
      })
    )

    let executionErrorStore!: ReturnType<typeof useExecutionErrorStore>
    renderComponent((pinia) => {
      executionErrorStore = useExecutionErrorStore(pinia)
      executionErrorStore.recordNodeErrors({
        '1': nodeError(
          [
            validationError(
              'required_input_missing',
              'model',
              {},
              'Required input is missing',
              'Input: model'
            )
          ],
          'KSampler'
        )
      })
      useMissingMediaStore(pinia).setMissingMedia([
        {
          nodeId: '3',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          name: 'a.png',
          isMissing: true
        }
      ])
    })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('errors-summary-filter-error'))

    executionErrorStore.recordNodeErrors(null)
    await nextTick()

    // The filtered severity emptied, so the filter let go instead of lying
    // in wait; a later error must not silently hide the missing group again.
    expect(screen.getByTestId('error-group-missing-media')).toBeInTheDocument()
    executionErrorStore.recordNodeErrors({
      '1': nodeError(
        [
          validationError(
            'required_input_missing',
            'model',
            {},
            'Required input is missing',
            'Input: model'
          )
        ],
        'KSampler'
      )
    })
    await nextTick()

    expect(screen.getByTestId('error-group-missing-media')).toBeInTheDocument()
    expect(screen.getByTestId('errors-summary-filter-error')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('keeps the engaged filter through a search that empties it', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockReturnValue(
      fromAny<NonNullable<ReturnType<typeof getNodeByExecutionId>>, unknown>({
        title: 'Node'
      })
    )

    renderComponent((pinia) => {
      useExecutionErrorStore(pinia).recordNodeErrors({
        '1': nodeError(
          [
            validationError(
              'required_input_missing',
              'model',
              {},
              'Required input is missing',
              'Input: model'
            )
          ],
          'KSampler'
        )
      })
      useMissingMediaStore(pinia).setMissingMedia([
        {
          nodeId: '3',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          name: 'a.png',
          isMissing: true
        }
      ])
    })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('errors-summary-filter-error'))

    // A query matching nothing in the filtered severity must show the
    // no-results state, not fall back to the severity the user excluded —
    // and the pressed chip must stay mounted as the release control.
    await user.type(screen.getByRole('textbox'), 'zzz')
    expect(screen.getByText('No results found')).toBeInTheDocument()
    expect(
      screen.queryByTestId('error-group-missing-media')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('errors-summary-filter-error')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await user.clear(screen.getByRole('textbox'))
    expect(screen.getByTestId('error-group-execution')).toBeInTheDocument()
    expect(screen.getByTestId('errors-summary-filter-error')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      screen.queryByTestId('error-group-missing-media')
    ).not.toBeInTheDocument()
  })

  it('renders swap node rows below the section display message', () => {
    const swapNode = {
      type: 'OldSampler',
      nodeId: '1',
      isReplaceable: true,
      replacement: {
        old_node_id: 'OldSampler',
        new_node_id: 'KSampler',
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      }
    } satisfies MissingNodeType

    renderComponent((pinia) => {
      useMissingNodesErrorStore(pinia).setMissingNodeTypes([swapNode])
    })

    expect(screen.getByText('Swap Nodes')).toBeInTheDocument()
    expect(
      screen.getByText('Some nodes can be replaced with alternatives')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'OldSampler' })
    ).toBeInTheDocument()
    expect(screen.getByText('KSampler')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Replace Node/ })
    ).toBeInTheDocument()
  })

  it('renders missing model Refresh in the header and Download all in the card when models are downloadable', () => {
    const missingModel = {
      nodeId: '1',
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      name: 'downloadable.safetensors',
      url: 'https://huggingface.co/comfy/test/resolve/main/downloadable.safetensors',
      directory: 'checkpoints',
      isMissing: true,
      isAssetSupported: true
    } satisfies MissingModelCandidate

    renderComponent((pinia) => {
      useMissingModelStore(pinia).setMissingModels([missingModel])
    })

    expect(screen.getByTestId('missing-model-header-refresh')).toBeVisible()
    expect(screen.getByTestId('missing-model-actions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download all/ })).toBeVisible()
  })

  it('uses the setup glyph and accessible name for missing resources', () => {
    renderRightSidePanel((pinia) => {
      useMissingModelStore(pinia).setMissingModels([
        {
          nodeId: '1',
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          name: 'missing.safetensors',
          isMissing: true,
          isAssetSupported: false
        }
      ])
    })

    const icon = screen.getByTestId('panel-tab-icon')
    expect(icon).toHaveAccessibleName('Setup required')
  })

  it('uses error severity for an unabsorbed node validation error', () => {
    renderRightSidePanel((pinia) => {
      useExecutionErrorStore(pinia).recordNodeErrors({
        '1': nodeError(
          [validationError('value_not_in_list', 'ckpt_name')],
          'CheckpointLoaderSimple'
        )
      })
    })

    const icon = screen.getByTestId('panel-tab-icon')
    expect(icon).toHaveAccessibleName('Blocking errors')
  })
})
