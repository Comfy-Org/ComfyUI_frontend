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

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => ({
    trackUiButtonClicked: vi.fn()
  }))
}))

describe('ErrorNodeCard.vue', () => {
  let i18n: ReturnType<typeof createI18n>

  beforeEach(() => {
    vi.clearAllMocks()
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
            findIssueOnGithub: 'Find Issue on Github'
          },
          rightSidePanel: {
            locateNode: 'Locate Node',
            enterSubgraph: 'Enter Subgraph'
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

  function makeRuntimeErrorCard(): ErrorCardData {
    return {
      id: 'exec-10',
      title: 'KSampler',
      nodeId: '10',
      nodeTitle: 'KSampler',
      errors: [
        {
          message: 'RuntimeError: CUDA out of memory',
          details: 'Traceback line 1\nTraceback line 2',
          isRuntimeError: true
        }
      ]
    }
  }

  function makeValidationErrorCard(): ErrorCardData {
    return {
      id: 'node-6',
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

  it('generates full error report for runtime errors on mount', async () => {
    mountCard(makeRuntimeErrorCard())
    await flushPromises()

    expect(mockGetLogs).toHaveBeenCalledOnce()
    expect(mockGenerateErrorReport).toHaveBeenCalledOnce()
    expect(mockGenerateErrorReport).toHaveBeenCalledWith(
      expect.objectContaining({
        exceptionType: 'KSampler',
        exceptionMessage: 'RuntimeError: CUDA out of memory',
        traceback: 'Traceback line 1\nTraceback line 2',
        nodeId: '10',
        nodeType: 'KSampler'
      })
    )
  })

  it('does not generate report for non-runtime errors', async () => {
    mountCard(makeValidationErrorCard())
    await flushPromises()

    expect(mockGetLogs).not.toHaveBeenCalled()
    expect(mockGenerateErrorReport).not.toHaveBeenCalled()
  })

  it('displays enriched report in details section for runtime errors', async () => {
    const reportText = '# ComfyUI Error Report\n## System Information'
    mockGenerateErrorReport.mockReturnValue(reportText)

    const wrapper = mountCard(makeRuntimeErrorCard())
    await flushPromises()

    expect(wrapper.text()).toContain('ComfyUI Error Report')
    expect(wrapper.text()).toContain('System Information')
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

    const copyButton = wrapper.find('button[aria-label="Copy"]')
    expect(copyButton.exists()).toBe(true)
    await copyButton.trigger('click')

    const emitted = wrapper.emitted('copyToClipboard')
    expect(emitted).toHaveLength(1)
    expect(emitted![0][0]).toContain('# Full Report Content')
  })

  it('copies original details when copy button is clicked for validation error', async () => {
    const wrapper = mountCard(makeValidationErrorCard())
    await flushPromises()

    const copyButton = wrapper.find('button[aria-label="Copy"]')
    await copyButton.trigger('click')

    const emitted = wrapper.emitted('copyToClipboard')
    expect(emitted).toHaveLength(1)
    expect(emitted![0][0]).toBe('Required input is missing\n\nInput: text')
  })

  it('falls back to original details when getLogs fails', async () => {
    mockGetLogs.mockRejectedValue(new Error('Network error'))

    const wrapper = mountCard(makeRuntimeErrorCard())
    await flushPromises()

    expect(mockGenerateErrorReport).not.toHaveBeenCalled()
    // Should still display the original traceback
    expect(wrapper.text()).toContain('Traceback line 1')
  })

  it('falls back to original details when generateErrorReport throws', async () => {
    mockGenerateErrorReport.mockImplementation(() => {
      throw new Error('Serialization error')
    })

    const wrapper = mountCard(makeRuntimeErrorCard())
    await flushPromises()

    // Should still display the original traceback
    expect(wrapper.text()).toContain('Traceback line 1')
  })

  it('renders Find Issues button that opens GitHub search', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    const wrapper = mountCard(makeRuntimeErrorCard())
    await flushPromises()

    const findIssuesButton = wrapper.find(
      'button[aria-label="Find Issue on Github"]'
    )
    expect(findIssuesButton.exists()).toBe(true)
    expect(findIssuesButton.text()).toContain('Find Issue on Github')

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

  it('uses flex-1 instead of max-height for runtime error details', async () => {
    const wrapper = mountCard(makeRuntimeErrorCard())
    await flushPromises()

    const detailsDiv = wrapper.find('.bg-secondary-background-hover')
    expect(detailsDiv.classes()).toContain('flex-1')
    expect(detailsDiv.classes()).toContain('min-h-0')
    expect(detailsDiv.classes()).not.toContain('max-h-[6lh]')
  })

  it('applies max-height constraint for non-runtime error details', async () => {
    const wrapper = mountCard(makeValidationErrorCard())
    await flushPromises()

    const detailsDiv = wrapper.find('.bg-secondary-background-hover')
    expect(detailsDiv.classes()).toContain('max-h-[6lh]')
    expect(detailsDiv.classes()).not.toContain('max-h-[10lh]')
  })
})
