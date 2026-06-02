import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import TabErrors from './TabErrors.vue'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {
      serialize: vi.fn(() => ({})),
      getNodeById: vi.fn()
    }
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByExecutionId: vi.fn(),
  getRootParentNode: vi.fn(() => null),
  forEachNode: vi.fn(),
  mapAllNodes: vi.fn(() => [])
}))

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: vi.fn(() => ({
    copyToClipboard: vi.fn()
  }))
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: vi.fn(() => ({
    fitView: vi.fn()
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
    i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          g: {
            workflow: 'Workflow',
            copy: 'Copy'
          },
          rightSidePanel: {
            noErrors: 'No errors',
            noneSearchDesc: 'No results found',
            missingModels: {
              missingModelsTitle: 'Missing Models',
              downloadAll: 'Download all',
              refresh: 'Refresh',
              refreshing: 'Refreshing missing models.'
            },
            missingMedia: {
              missingMediaTitle: 'Missing Inputs',
              image: 'Images',
              uploadFile: 'Upload {type}',
              useFromLibrary: 'Use from Library',
              confirmSelection: 'Confirm selection',
              locateNode: 'Locate node',
              expandNodes: 'Show referencing nodes',
              collapseNodes: 'Hide referencing nodes',
              cancelSelection: 'Cancel selection',
              or: 'OR'
            }
          }
        }
      }
    })
  })

  function renderComponent(initialState = {}) {
    const user = userEvent.setup()
    render(TabErrors, {
      global: {
        plugins: [
          PrimeVue,
          i18n,
          createTestingPinia({
            createSpy: vi.fn,
            initialState
          })
        ],
        stubs: {
          AsyncSearchInput: {
            template:
              '<input @input="$emit(\'update:modelValue\', $event.target.value)" />'
          },
          PropertiesAccordionItem: {
            template: '<div><slot name="label" /><slot /></div>'
          },
          Button: {
            template: '<button v-bind="$attrs"><slot /></button>'
          }
        }
      }
    })
    return { user }
  }

  it('renders "no errors" state when store is empty', () => {
    renderComponent()
    expect(screen.getByText('No errors')).toBeInTheDocument()
  })

  it('renders prompt-level errors with resolved display message', async () => {
    renderComponent({
      executionError: {
        lastPromptError: {
          type: 'prompt_no_outputs',
          message: 'Server Error: No outputs',
          details: 'Error details'
        }
      }
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

  it('renders node validation errors grouped by class_type', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockReturnValue({
      title: 'CLIP Text Encode'
    } as ReturnType<typeof getNodeByExecutionId>)

    renderComponent({
      executionError: {
        lastNodeErrors: {
          '6': {
            class_type: 'CLIPTextEncode',
            errors: [
              { message: 'Required input is missing', details: 'Input: text' }
            ]
          }
        }
      }
    })

    expect(screen.getByText('CLIPTextEncode')).toBeInTheDocument()
    expect(screen.getByText('#6')).toBeInTheDocument()
    expect(screen.getByText('CLIP Text Encode')).toBeInTheDocument()
    expect(screen.getByText('Required input is missing')).toBeInTheDocument()
  })

  it('renders runtime execution errors from WebSocket', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockReturnValue({
      title: 'KSampler'
    } as ReturnType<typeof getNodeByExecutionId>)

    renderComponent({
      executionError: {
        lastExecutionError: {
          prompt_id: 'abc',
          node_id: '10',
          node_type: 'KSampler',
          exception_message: 'Out of memory',
          exception_type: 'RuntimeError',
          traceback: ['Line 1', 'Line 2'],
          timestamp: Date.now()
        }
      }
    })

    expect(screen.getAllByText('KSampler').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('#10')).toBeInTheDocument()
    expect(screen.getByText('Execution failed')).toBeInTheDocument()
    expect(
      screen.getByText('Node threw an error during execution.')
    ).toBeInTheDocument()
    expect(screen.getByText(/Line 1/)).toBeInTheDocument()
  })

  it('filters errors based on search query', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockReturnValue(null)

    const { user } = renderComponent({
      executionError: {
        lastNodeErrors: {
          '1': {
            class_type: 'CLIPTextEncode',
            errors: [{ message: 'Missing text input' }]
          },
          '2': {
            class_type: 'KSampler',
            errors: [{ message: 'Out of memory' }]
          }
        }
      }
    })

    expect(screen.getAllByText('CLIPTextEncode').length).toBeGreaterThanOrEqual(
      1
    )
    expect(screen.getAllByText('KSampler').length).toBeGreaterThanOrEqual(1)

    await user.type(screen.getByRole('textbox'), 'Missing text input')

    expect(screen.getAllByText('CLIPTextEncode').length).toBeGreaterThanOrEqual(
      1
    )
    expect(screen.queryByText('KSampler')).not.toBeInTheDocument()
  })

  it('calls copyToClipboard when copy button is clicked', async () => {
    const { useCopyToClipboard } =
      await import('@/composables/useCopyToClipboard')
    const mockCopy = vi.fn()
    vi.mocked(useCopyToClipboard).mockReturnValue({ copyToClipboard: mockCopy })

    const { user } = renderComponent({
      executionError: {
        lastNodeErrors: {
          '1': {
            class_type: 'TestNode',
            errors: [{ message: 'Test message', details: 'Test details' }]
          }
        }
      }
    })

    await user.click(screen.getByTestId('error-card-copy'))

    expect(mockCopy).toHaveBeenCalledWith('Test message\n\nTest details')
  })

  it('renders single runtime error outside accordion in full-height panel', async () => {
    const { getNodeByExecutionId } = await import('@/utils/graphTraversalUtil')
    vi.mocked(getNodeByExecutionId).mockReturnValue({
      title: 'KSampler'
    } as ReturnType<typeof getNodeByExecutionId>)

    renderComponent({
      executionError: {
        lastExecutionError: {
          prompt_id: 'abc',
          node_id: '10',
          node_type: 'KSampler',
          exception_message: 'Out of memory',
          exception_type: 'RuntimeError',
          traceback: ['Line 1', 'Line 2'],
          timestamp: Date.now()
        }
      }
    })

    expect(screen.getAllByText('KSampler').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Execution failed')).toBeInTheDocument()
    expect(screen.getByTestId('runtime-error-panel')).toBeInTheDocument()
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

    const { user } = renderComponent({
      missingModel: {
        missingModelCandidates: [missingModel]
      }
    })
    const missingModelStore = useMissingModelStore()

    expect(screen.getByText('Missing Models (1)')).toBeInTheDocument()
    expect(
      screen.queryByTestId('missing-model-actions')
    ).not.toBeInTheDocument()

    await user.click(screen.getByTestId('missing-model-header-refresh'))

    expect(missingModelStore.refreshMissingModels).toHaveBeenCalled()
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

    renderComponent({
      missingModel: {
        missingModelCandidates: [missingModel]
      }
    })

    expect(screen.getByText('Missing Models (1)')).toBeInTheDocument()
    expect(
      screen.getByText('Download a model, or open the node to replace it.')
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        'ComfyUI needs local-only.safetensors in checkpoints. Referenced by 1 node.'
      )
    ).not.toBeInTheDocument()
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

    renderComponent({
      missingMedia: {
        missingMediaCandidates: [missingMedia]
      }
    })

    expect(screen.getByText('Missing Inputs (1)')).toBeInTheDocument()
    expect(
      screen.getByText('A required media input has no file selected.')
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        'Load Image node needs a selected image. Referenced by 1 node.'
      )
    ).not.toBeInTheDocument()
  })

  it('keeps missing model Refresh in the card actions when models are downloadable', () => {
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

    renderComponent({
      missingModel: {
        missingModelCandidates: [missingModel]
      }
    })

    expect(
      screen.queryByTestId('missing-model-header-refresh')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('missing-model-actions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download all/ })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeVisible()
  })
})
