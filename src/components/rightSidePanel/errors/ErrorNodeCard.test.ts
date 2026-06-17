import { createTestingPinia } from '@pinia/testing'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import ErrorNodeCard from './ErrorNodeCard.vue'
import type { ErrorCardData } from './types'

const mockGetLogs = vi.fn(() => Promise.resolve('mock server logs'))
const mockSerialize = vi.fn(() => ({ nodes: [] }))
const mockGenerateErrorReport = vi.fn(
  (_data?: unknown) => '# ComfyUI Error Report\n...'
)

vi.mock('@/scripts/api', () => ({
  api: {
    getLogs: () => mockGetLogs()
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {
      serialize: () => mockSerialize()
    }
  }
}))

vi.mock('@/utils/errorReportUtil', () => ({
  generateErrorReport: (data: unknown) => mockGenerateErrorReport(data)
}))

const mockTrackHelpResourceClicked = vi.fn()

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => ({
    trackUiButtonClicked: vi.fn(),
    trackHelpResourceClicked: mockTrackHelpResourceClicked
  }))
}))

const mockExecuteCommand = vi.fn()
vi.mock('@/stores/commandStore', () => ({
  useCommandStore: vi.fn(() => ({
    execute: mockExecuteCommand
  }))
}))

vi.mock('@/composables/useExternalLink', () => ({
  useExternalLink: vi.fn(() => ({
    staticUrls: {
      githubIssues: 'https://github.com/Comfy-Org/ComfyUI/issues'
    }
  }))
}))

describe('ErrorNodeCard.vue', () => {
  let i18n: ReturnType<typeof createI18n>

  beforeEach(() => {
    vi.clearAllMocks()
    cardIdCounter = 0
    mockGetLogs.mockResolvedValue('mock server logs')
    mockGenerateErrorReport.mockReturnValue('# ComfyUI Error Report\n...')

    i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          g: {
            copy: 'Copy',
            details: 'Details',
            findIssues: 'Find Issues',
            findOnGithub: 'Find on GitHub',
            getHelpAction: 'Get Help'
          },
          rightSidePanel: {
            locateNode: 'Locate Node',
            enterSubgraph: 'Enter Subgraph',
            errorLog: 'Error log',
            findOnGithubTooltip: 'Search GitHub issues for related problems',
            getHelpTooltip:
              'Report this error and we\u0027ll help you resolve it'
          },
          issueReport: {
            helpFix: 'Help Fix This'
          }
        }
      }
    })
  })

  function renderCard(
    card: ErrorCardData,
    options: { initialState?: Record<string, unknown> } = {}
  ) {
    const user = userEvent.setup()
    const onCopyToClipboard = vi.fn()
    const onLocateNode = vi.fn()
    render(ErrorNodeCard, {
      props: { card, onCopyToClipboard, onLocateNode },
      global: {
        plugins: [
          PrimeVue,
          i18n,
          createTestingPinia({
            createSpy: vi.fn,
            initialState: options.initialState ?? {
              systemStats: {
                systemStats: {
                  system: {
                    os: 'Linux',
                    python_version: '3.11.0',
                    embedded_python: false,
                    comfyui_version: '1.0.0',
                    pytorch_version: '2.1.0',
                    argv: ['--listen']
                  },
                  devices: [
                    {
                      name: 'NVIDIA RTX 4090',
                      type: 'cuda',
                      vram_total: 24000,
                      vram_free: 12000,
                      torch_vram_total: 24000,
                      torch_vram_free: 12000
                    }
                  ]
                }
              }
            }
          })
        ],
        stubs: {
          TransitionCollapse: { template: '<div><slot /></div>' },
          Button: {
            template: '<button v-bind="$attrs"><slot /></button>'
          }
        }
      }
    })
    return { user, onCopyToClipboard, onLocateNode }
  }

  async function toggleRuntimeDetails(
    user: ReturnType<typeof userEvent.setup>
  ) {
    await user.click(screen.getByRole('button', { name: /Details/ }))
  }

  let cardIdCounter = 0

  function makeRuntimeErrorCard(): ErrorCardData {
    return {
      id: `exec-${++cardIdCounter}`,
      title: 'KSampler',
      nodeId: '10',
      nodeTitle: 'KSampler',
      errors: [
        {
          message: 'RuntimeError: CUDA out of memory',
          details: 'Traceback line 1\nTraceback line 2',
          isRuntimeError: true,
          exceptionType: 'RuntimeError'
        }
      ]
    }
  }

  function makePromptErrorCard(): ErrorCardData {
    return {
      id: '__prompt__',
      title: 'Prompt has no outputs',
      errors: [
        {
          message: 'Server Error: No outputs',
          details: 'Error details',
          displayMessage:
            'The workflow does not contain any output nodes to produce a result.'
        }
      ]
    }
  }

  it('shows runtime details by default and can collapse them', async () => {
    const reportText =
      '# ComfyUI Error Report\n## System Information\n- OS: Linux'
    mockGenerateErrorReport.mockReturnValue(reportText)

    const { user } = renderCard(makeRuntimeErrorCard())

    await waitFor(() => {
      expect(mockGenerateErrorReport).toHaveBeenCalledOnce()
    })
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    expect(screen.getByText('Error log')).toBeInTheDocument()
    const detailsButton = screen.getByRole('button', { name: /Details/ })
    const detailsRegion = screen.getByRole('region', { name: 'Error log' })
    expect(detailsButton).toHaveAttribute(
      'aria-controls',
      detailsRegion.getAttribute('id')
    )
    expect(screen.getByText(/ComfyUI Error Report/)).toBeInTheDocument()
    expect(screen.getByText(/System Information/)).toBeInTheDocument()
    expect(screen.getByText(/OS: Linux/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Find on GitHub/ })
    ).toBeInTheDocument()

    await toggleRuntimeDetails(user)

    expect(screen.queryByText(/ComfyUI Error Report/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Find on GitHub/ })
    ).not.toBeInTheDocument()
  })

  it('locates the node when the runtime node title is clicked', async () => {
    const { user, onLocateNode } = renderCard(makeRuntimeErrorCard())

    await user.click(screen.getByRole('button', { name: 'KSampler' }))

    expect(onLocateNode).toHaveBeenCalledWith('10')
  })

  it('does not generate report for non-runtime errors', async () => {
    renderCard(makePromptErrorCard())

    await waitFor(() => {
      expect(screen.getByText('Error details')).toBeInTheDocument()
    })

    expect(mockGetLogs).not.toHaveBeenCalled()
    expect(mockGenerateErrorReport).not.toHaveBeenCalled()
  })

  it('displays original details for non-runtime errors', async () => {
    renderCard(makePromptErrorCard())

    await waitFor(() => {
      expect(screen.getByText('Error details')).toBeInTheDocument()
    })
    expect(screen.queryByText(/ComfyUI Error Report/)).not.toBeInTheDocument()
  })

  it('hides grouped catalog copy and shows the item label as a list item', async () => {
    renderCard({
      id: `node-${++cardIdCounter}`,
      title: 'KSampler',
      nodeId: '10',
      nodeTitle: 'KSampler',
      errors: [
        {
          message: 'Required input is missing',
          details: 'model',
          displayTitle: 'Missing connection',
          displayMessage:
            'Required input slots have no connection feeding them.',
          displayDetails: 'KSampler is missing a required input: model',
          displayItemLabel: 'KSampler - model'
        }
      ]
    })

    await waitFor(() => {
      expect(screen.getByText('KSampler - model')).toBeInTheDocument()
    })
    expect(screen.getByRole('listitem')).toHaveTextContent('KSampler - model')
    expect(screen.queryByText('Missing connection')).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        'Required input slots have no connection feeding them.'
      )
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('KSampler is missing a required input: model')
    ).not.toBeInTheDocument()
  })

  it('copies enriched report when copy button is clicked for runtime error', async () => {
    const reportText = '# Full Report Content'
    mockGenerateErrorReport.mockReturnValue(reportText)

    const { user, onCopyToClipboard } = renderCard(makeRuntimeErrorCard())

    await waitFor(() => {
      expect(mockGenerateErrorReport).toHaveBeenCalledOnce()
    })
    expect(screen.getByText(/Full Report Content/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Copy/ }))

    expect(onCopyToClipboard).toHaveBeenCalledTimes(1)
    expect(onCopyToClipboard.mock.calls[0][0]).toContain(
      '# Full Report Content'
    )
  })

  it('generates report with fallback logs when getLogs fails', async () => {
    mockGetLogs.mockRejectedValue(new Error('Network error'))

    renderCard(makeRuntimeErrorCard())

    await waitFor(() => {
      expect(mockGenerateErrorReport).toHaveBeenCalledOnce()
    })
    expect(mockGenerateErrorReport).toHaveBeenCalledWith(
      expect.objectContaining({
        serverLogs: 'Failed to retrieve server logs'
      })
    )
    expect(screen.getByText(/ComfyUI Error Report/)).toBeInTheDocument()
  })

  it('falls back to original details when generateErrorReport throws', async () => {
    mockGenerateErrorReport.mockImplementation(() => {
      throw new Error('Serialization error')
    })

    renderCard(makeRuntimeErrorCard())

    await waitFor(() => {
      expect(mockGenerateErrorReport).toHaveBeenCalledOnce()
    })
    expect(screen.getByText(/Traceback line 1/)).toBeInTheDocument()
  })

  it('opens GitHub issues search when Find Issue button is clicked', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    const { user } = renderCard(makeRuntimeErrorCard())

    await waitFor(() => {
      expect(mockGenerateErrorReport).toHaveBeenCalledOnce()
    })

    await user.click(screen.getByRole('button', { name: /Find on GitHub/ }))

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('github.com/Comfy-Org/ComfyUI/issues?q='),
      '_blank',
      'noopener,noreferrer'
    )
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('CUDA%20out%20of%20memory'),
      expect.any(String),
      expect.any(String)
    )

    openSpy.mockRestore()
  })

  it('executes ContactSupport command when Get Help button is clicked', async () => {
    const { user } = renderCard(makeRuntimeErrorCard())

    await waitFor(() => {
      expect(mockGenerateErrorReport).toHaveBeenCalledOnce()
    })

    await user.click(screen.getByRole('button', { name: /Get Help/ }))

    expect(mockExecuteCommand).toHaveBeenCalledWith('Comfy.ContactSupport')
    expect(mockTrackHelpResourceClicked).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_type: 'help_feedback',
        source: 'error_dialog'
      })
    )
  })

  it('passes exceptionType from error item to report generator', async () => {
    renderCard(makeRuntimeErrorCard())

    await waitFor(() => {
      expect(mockGenerateErrorReport).toHaveBeenCalledOnce()
    })
    expect(mockGenerateErrorReport).toHaveBeenCalledWith(
      expect.objectContaining({
        exceptionType: 'RuntimeError'
      })
    )
  })

  it('uses fallback exception type when error item has no exceptionType', async () => {
    const card: ErrorCardData = {
      id: `exec-${++cardIdCounter}`,
      title: 'KSampler',
      nodeId: '10',
      nodeTitle: 'KSampler',
      errors: [
        {
          message: 'Unknown error occurred',
          details: 'Some traceback',
          isRuntimeError: true
        }
      ]
    }

    renderCard(card)

    await waitFor(() => {
      expect(mockGenerateErrorReport).toHaveBeenCalledOnce()
    })
    expect(mockGenerateErrorReport).toHaveBeenCalledWith(
      expect.objectContaining({
        exceptionType: 'Runtime Error'
      })
    )
  })

  it('falls back to original details when systemStats is unavailable', async () => {
    renderCard(makeRuntimeErrorCard(), {
      initialState: {
        systemStats: { systemStats: null }
      }
    })

    expect(screen.getByText(/Traceback line 1/)).toBeInTheDocument()

    expect(mockGenerateErrorReport).not.toHaveBeenCalled()
  })
})
