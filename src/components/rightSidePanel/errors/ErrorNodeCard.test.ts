import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
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
      githubIssues: 'https://github.com/comfyanonymous/ComfyUI/issues'
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

  function mountCard(card: ErrorCardData) {
    return mount(ErrorNodeCard, {
      props: { card },
      global: {
        plugins: [
          PrimeVue,
          i18n,
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
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

    const wrapper = mountCard(makeRuntimeErrorCard())
    await flushPromises()

    expect(wrapper.text()).toContain('ComfyUI Error Report')
    expect(wrapper.text()).toContain('System Information')
    expect(wrapper.text()).toContain('OS: Linux')
  })

  it('does not generate report for non-runtime errors', async () => {
    mountCard(makeValidationErrorCard())
    await flushPromises()

    expect(mockGetLogs).not.toHaveBeenCalled()
    expect(mockGenerateErrorReport).not.toHaveBeenCalled()
  })

  it('displays original details for non-runtime errors', async () => {
    const wrapper = mountCard(makeValidationErrorCard())
    await flushPromises()

    expect(wrapper.text()).toContain('Input: text')
    expect(wrapper.text()).not.toContain('ComfyUI Error Report')
  })

  it('copies enriched report when copy button is clicked for runtime error', async () => {
    const reportText = '# Full Report Content'
    mockGenerateErrorReport.mockReturnValue(reportText)

    const wrapper = mountCard(makeRuntimeErrorCard())
    await flushPromises()

    const copyButton = wrapper
      .findAll('button')
      .find((btn) => btn.text().includes('Copy'))!
    expect(copyButton.exists()).toBe(true)
    await copyButton.trigger('click')

    const emitted = wrapper.emitted('copyToClipboard')
    expect(emitted).toHaveLength(1)
    expect(emitted![0][0]).toContain('# Full Report Content')
  })

  it('copies original details when copy button is clicked for validation error', async () => {
    const wrapper = mountCard(makeValidationErrorCard())
    await flushPromises()

    const copyButton = wrapper
      .findAll('button')
      .find((btn) => btn.text().includes('Copy'))!
    await copyButton.trigger('click')

    const emitted = wrapper.emitted('copyToClipboard')
    expect(emitted).toHaveLength(1)
    expect(emitted![0][0]).toBe('Required input is missing\n\nInput: text')
  })

  it('generates report with fallback logs when getLogs fails', async () => {
    mockGetLogs.mockRejectedValue(new Error('Network error'))

    const wrapper = mountCard(makeRuntimeErrorCard())
    await flushPromises()

    // Report is still generated with fallback log message
    expect(mockGenerateErrorReport).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('ComfyUI Error Report')
  })

  it('falls back to original details when generateErrorReport throws', async () => {
    mockGenerateErrorReport.mockImplementation(() => {
      throw new Error('Serialization error')
    })

    const wrapper = mountCard(makeRuntimeErrorCard())
    await flushPromises()

    expect(wrapper.text()).toContain('Traceback line 1')
  })

  it('opens GitHub issues search when Find Issue button is clicked', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    const wrapper = mountCard(makeRuntimeErrorCard())
    await flushPromises()

    const findIssuesButton = wrapper
      .findAll('button')
      .find((btn) => btn.text().includes('Find on GitHub'))!
    expect(findIssuesButton.exists()).toBe(true)

    await findIssuesButton.trigger('click')

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('github.com/comfyanonymous/ComfyUI/issues?q='),
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
    const wrapper = mountCard(makeRuntimeErrorCard())
    await flushPromises()

    const getHelpButton = wrapper
      .findAll('button')
      .find((btn) => btn.text().includes('Get Help'))!
    expect(getHelpButton.exists()).toBe(true)

    await getHelpButton.trigger('click')

    expect(mockExecuteCommand).toHaveBeenCalledWith('Comfy.ContactSupport')
    expect(mockTrackHelpResourceClicked).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_type: 'help_feedback',
        source: 'error_dialog'
      })
    )
  })

  it('passes exceptionType from error item to report generator', async () => {
    mountCard(makeRuntimeErrorCard())
    await flushPromises()

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

    mountCard(card)
    await flushPromises()

    expect(mockGenerateErrorReport).toHaveBeenCalledWith(
      expect.objectContaining({
        exceptionType: 'Runtime Error'
      })
    )
  })

  it('falls back to original details when systemStats is unavailable', async () => {
    const wrapper = mount(ErrorNodeCard, {
      props: { card: makeRuntimeErrorCard() },
      global: {
        plugins: [
          PrimeVue,
          i18n,
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              systemStats: { systemStats: null }
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
    await flushPromises()

    expect(mockGenerateErrorReport).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Traceback line 1')
  })
})
