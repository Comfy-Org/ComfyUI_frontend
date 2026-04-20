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
            findIssues: 'Find Issues',
            findOnGithub: 'Find on GitHub',
            getHelpAction: 'Get Help'
          },
          rightSidePanel: {
            locateNode: 'Locate Node',
            enterSubgraph: 'Enter Subgraph',
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
    render(ErrorNodeCard, {
      props: { card, onCopyToClipboard },
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
          Button: {
            template:
              '<button :aria-label="$attrs[\'aria-label\']"><slot /></button>'
          }
        }
      }
    })
    return { user, onCopyToClipboard }
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

  function makeValidationErrorCard(): ErrorCardData {
    return {
      id: `node-${++cardIdCounter}`,
      title: 'CLIPTextEncode',
      nodeId: '6',
      nodeTitle: 'CLIP Text Encode',
      errors: [
        {
          message: 'Required input is missing',
          details: 'Input: text'
        }
      ]
    }
  }

  it('displays enriched report for runtime errors on mount', async () => {
    const reportText =
      '# ComfyUI Error Report\n## System Information\n- OS: Linux'
    mockGenerateErrorReport.mockReturnValue(reportText)

    renderCard(makeRuntimeErrorCard())

    await waitFor(() => {
      expect(screen.getByText(/ComfyUI Error Report/)).toBeInTheDocument()
    })
    expect(screen.getByText(/System Information/)).toBeInTheDocument()
    expect(screen.getByText(/OS: Linux/)).toBeInTheDocument()
  })

  it('does not generate report for non-runtime errors', async () => {
    renderCard(makeValidationErrorCard())

    await waitFor(() => {
      expect(screen.getByText('Input: text')).toBeInTheDocument()
    })

    expect(mockGetLogs).not.toHaveBeenCalled()
    expect(mockGenerateErrorReport).not.toHaveBeenCalled()
  })

  it('displays original details for non-runtime errors', async () => {
    renderCard(makeValidationErrorCard())

    await waitFor(() => {
      expect(screen.getByText('Input: text')).toBeInTheDocument()
    })
    expect(screen.queryByText(/ComfyUI Error Report/)).not.toBeInTheDocument()
  })

  it('copies enriched report when copy button is clicked for runtime error', async () => {
    const reportText = '# Full Report Content'
    mockGenerateErrorReport.mockReturnValue(reportText)

    const { user, onCopyToClipboard } = renderCard(makeRuntimeErrorCard())

    await waitFor(() => {
      expect(screen.getByText(/Full Report Content/)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Copy/ }))

    expect(onCopyToClipboard).toHaveBeenCalledTimes(1)
    expect(onCopyToClipboard.mock.calls[0][0]).toContain(
      '# Full Report Content'
    )
  })

  it('copies original details when copy button is clicked for validation error', async () => {
    const { user, onCopyToClipboard } = renderCard(makeValidationErrorCard())

    await waitFor(() => {
      expect(screen.getByText('Input: text')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Copy/ }))

    expect(onCopyToClipboard).toHaveBeenCalledTimes(1)
    expect(onCopyToClipboard.mock.calls[0][0]).toBe(
      'Required input is missing\n\nInput: text'
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
      expect(screen.getByText(/Traceback line 1/)).toBeInTheDocument()
    })
  })

  it('opens GitHub issues search when Find Issue button is clicked', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    const { user } = renderCard(makeRuntimeErrorCard())

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Find on GitHub/ })
      ).toBeInTheDocument()
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
      expect(
        screen.getByRole('button', { name: /Get Help/ })
      ).toBeInTheDocument()
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

    await waitFor(() => {
      expect(screen.getByText(/Traceback line 1/)).toBeInTheDocument()
    })

    expect(mockGenerateErrorReport).not.toHaveBeenCalled()
  })
})
