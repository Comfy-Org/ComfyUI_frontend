import { createTestingPinia } from '@pinia/testing'
import type { TestingPinia } from '@pinia/testing'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import RightSidePanel from '@/components/rightSidePanel/RightSidePanel.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import type { MissingNodeType } from '@/types/comfy'
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

vi.mock('@/platform/missingModel/missingModelDownload', () => ({
  downloadModel: vi.fn(),
  fetchModelMetadata: vi.fn().mockResolvedValue({
    fileSize: null,
    gatedRepoUrl: null
  }),
  isModelDownloadable: vi.fn(() => true),
  toBrowsableUrl: vi.fn((url: string) => url)
}))

describe('TabErrors.vue', () => {
  let i18n: ReturnType<typeof createI18n>

  beforeEach(() => {
    vi.clearAllMocks()
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
            noErrors: 'No errors',
            noneSearchDesc: 'No results found',
            errorsDetected: 'Error detected | Errors detected',
            resolveBeforeRun: 'Resolve before running the workflow',
            setupPending: 'Setup pending',
            setupPendingDesc: 'This workflow needs resources before it can run',
            setupSummary: '{count} item | {count} items',
            setupNodeSummary:
              '{nodes} node — {count} item | {nodes} node — {count} items',
            setupNodesSummary:
              '{nodes} nodes — {count} item | {nodes} nodes — {count} items',
            nodesAffected: '{count} node affected | {count} nodes affected',
            errorsSummary: '{count} error | {count} errors',
            blockedLastRun: 'Blocked last run',
            severityErrorLabel: 'Blocking errors',
            severitySetupLabel: 'Setup pending',
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
    return pinia
  }

  it('renders "no errors" state when store is empty', () => {
    renderComponent()
    expect(screen.getByText('No errors')).toBeInTheDocument()
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
      return {
        title: titles[String(nodeId)] ?? ''
      } as ReturnType<typeof getNodeByExecutionId>
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
    expect(sectionBadge).toHaveClass('bg-destructive-background-hover')
    expect(
      within(screen.getByTestId('errors-summary-hero-error')).getByText('3')
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('errors-summary-hero-missing')
    ).not.toBeInTheDocument()
    expect(screen.getByText('Errors detected')).toBeInTheDocument()
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
    vi.mocked(getNodeByExecutionId).mockReturnValue({
      title: 'KSampler'
    } as ReturnType<typeof getNodeByExecutionId>)

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
    vi.mocked(getNodeByExecutionId).mockReturnValue({
      title: 'KSampler'
    } as ReturnType<typeof getNodeByExecutionId>)

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
    expect(sectionBadge).toHaveClass(
      'bg-warning-background',
      'text-charcoal-800'
    )
    const missingHero = screen.getByTestId('errors-summary-hero-missing')
    const missingHeroCount = within(missingHero).getByText('2')
    expect(missingHeroCount).toHaveClass('text-warning-background')
    expect(within(missingHero).getByText('Setup pending')).toBeInTheDocument()
    expect(
      screen.queryByTestId('errors-summary-hero-error')
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
      useMissingNodesErrorStore(pinia).setMissingNodeTypes(['MissingNode'])
      useExecutionErrorStore(pinia).recordPromptError({
        type: 'prompt_no_outputs',
        message: 'No outputs',
        details: ''
      })
    })

    expect(screen.getByTestId('selection-context-strip')).toHaveTextContent(
      '2 errors'
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

  it('keeps an absorbed missing model card amber and labels the failed run', () => {
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
      useExecutionErrorStore(pinia).recordNodeErrors({
        '1': nodeError(
          [
            validationError('value_not_in_list', 'ckpt_name', {
              received_value: 'local-only.safetensors'
            })
          ],
          'CheckpointLoaderSimple'
        )
      })
    })

    const missingSection = screen.getByTestId('error-group-missing-model')
    const marker = within(missingSection).getByTestId(
      'blocked-last-run-indicator'
    )
    expect(marker).toHaveTextContent('Blocked last run')
    expect(
      within(missingSection).getByTestId('error-section-count-badge')
    ).toHaveClass('bg-warning-background')
    expect(
      screen.queryByTestId('error-group-execution')
    ).not.toBeInTheDocument()
  })

  it('keeps absorbed missing-node markers visible when sections collapse', async () => {
    const { user } = renderComponent((pinia) => {
      useMissingNodesErrorStore(pinia).setMissingNodeTypes([
        {
          type: 'OldNode',
          nodeId: '1',
          isReplaceable: true,
          replacement: {
            old_node_id: 'OldNode',
            new_node_id: 'NewNode',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: null
          }
        },
        {
          type: 'MissingNode',
          nodeId: '2',
          cnrId: 'missing-pack',
          isReplaceable: false
        }
      ])
      useExecutionErrorStore(pinia).recordPromptError({
        type: 'missing_node_type',
        message: 'Node types are unavailable',
        details: ''
      })
    })

    expect(
      screen.queryByTestId('errors-summary-hero-error')
    ).not.toBeInTheDocument()
    const setupHero = screen.getByTestId('errors-summary-hero-missing')
    expect(within(setupHero).getByText('2')).toBeInTheDocument()
    expect(within(setupHero).getByText('Setup pending')).toBeInTheDocument()
    expect(screen.queryByText('Missing node type')).not.toBeInTheDocument()

    for (const section of [
      screen.getByTestId('error-group-swap-nodes'),
      screen.getByTestId('error-group-missing-node')
    ]) {
      const marker = within(section).getByTestId('blocked-last-run-indicator')
      expect(marker).toHaveTextContent('Blocked last run')
      await user.click(
        within(section).getByRole('button', { name: 'Collapse' })
      )
      expect(
        within(section).getByTestId('blocked-last-run-indicator')
      ).toHaveTextContent('Blocked last run')
    }
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
      return {
        title: titles[String(nodeId)] ?? ''
      } as ReturnType<typeof getNodeByExecutionId>
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

  it('splits mixed summary counts without rendering their sum', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockReturnValue({
      title: 'Node'
    } as ReturnType<typeof getNodeByExecutionId>)

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

    expect(
      within(screen.getByTestId('errors-summary-hero-error')).getByText('3')
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('errors-summary-hero-missing')).getByText('2')
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('errors-summary-hero')).queryByText('5')
    ).not.toBeInTheDocument()
    const contextStrip = screen.getByTestId('selection-context-strip')
    expect(contextStrip).toHaveTextContent('4 nodes affected')
    expect(contextStrip).not.toHaveTextContent(/errors/i)
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
    renderRightSidePanel((testPinia) => {
      useMissingModelStore(testPinia).setMissingModels([
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
    expect(icon).toHaveClass(
      'icon-[lucide--triangle-alert]',
      'bg-warning-background'
    )
    expect(icon).toHaveAccessibleName('Setup pending')
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
    expect(icon).toHaveClass(
      'icon-[lucide--octagon-alert]',
      'bg-node-stroke-error'
    )
    expect(icon).toHaveAccessibleName('Blocking errors')
  })

  it('uses error severity for a runtime error with an unnormalisable node id', () => {
    renderRightSidePanel((pinia) => {
      useExecutionErrorStore(pinia).recordExecutionError({
        prompt_id: 'abc',
        node_id: 'not::a-node',
        node_type: 'KSampler',
        executed: [],
        exception_message: 'Execution failed',
        exception_type: 'RuntimeError',
        traceback: [],
        timestamp: Date.now()
      })
    })

    const icon = screen.getByTestId('panel-tab-icon')
    expect(icon).toHaveClass(
      'icon-[lucide--octagon-alert]',
      'bg-node-stroke-error'
    )
    expect(icon).toHaveAccessibleName('Blocking errors')
  })

  it('uses setup severity when the same node error is absorbed', () => {
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
      useExecutionErrorStore(pinia).recordNodeErrors({
        '1': nodeError(
          [validationError('value_not_in_list', 'ckpt_name')],
          'CheckpointLoaderSimple'
        )
      })
    })

    const icon = screen.getByTestId('panel-tab-icon')
    expect(icon).toHaveClass(
      'icon-[lucide--triangle-alert]',
      'bg-warning-background'
    )
    expect(icon).toHaveAccessibleName('Setup pending')
  })
})
