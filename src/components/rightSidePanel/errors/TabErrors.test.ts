import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import TabErrors from './TabErrors.vue'

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
            promptErrors: {
              prompt_no_outputs: {
                desc: 'Prompt has no outputs'
              }
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
          FormSearchInput: {
            template:
              '<input @input="$emit(\'update:modelValue\', $event.target.value)" />'
          },
          PropertiesAccordionItem: {
            template: '<div><slot name="label" /><slot /></div>'
          },
          Button: {
            template: '<button><slot /></button>'
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

  it('renders prompt-level errors (Group title = error message)', async () => {
    renderComponent({
      executionError: {
        lastPromptError: {
          type: 'prompt_no_outputs',
          message: 'Server Error: No outputs',
          details: 'Error details'
        }
      }
    })

    expect(screen.getByText('Server Error: No outputs')).toBeInTheDocument()
    expect(screen.getByText('Prompt has no outputs')).toBeInTheDocument()
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
    expect(screen.getByText('RuntimeError: Out of memory')).toBeInTheDocument()
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
    expect(screen.getByText('RuntimeError: Out of memory')).toBeInTheDocument()
    expect(screen.getByTestId('runtime-error-panel')).toBeInTheDocument()
    expect(screen.getAllByText('RuntimeError: Out of memory')).toHaveLength(1)
  })
})
