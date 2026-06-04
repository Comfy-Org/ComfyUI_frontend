import { createPinia, setActivePinia } from 'pinia'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useErrorOverlayState } from './useErrorOverlayState'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import type { NodeError } from '@/schemas/apiSchema'
import type { ErrorGroup } from '@/components/rightSidePanel/errors/types'

const mockAllErrorGroups = vi.hoisted(() => ({ value: [] as ErrorGroup[] }))

vi.mock('@/components/rightSidePanel/errors/useErrorGroups', () => ({
  useErrorGroups: () => ({ allErrorGroups: mockAllErrorGroups })
}))

vi.mock('@/composables/graph/useNodeErrorFlagSync', () => ({
  useNodeErrorFlagSync: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: {
    isGraphReady: false,
    rootGraph: {
      serialize: vi.fn(() => ({})),
      getNodeById: vi.fn()
    }
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  executionIdToNodeLocatorId: vi.fn((id: string) => id),
  getActiveGraphNodeIds: vi.fn(() => new Set()),
  getExecutionIdByNode: vi.fn(),
  getNodeByExecutionId: vi.fn()
}))

function createTestI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        errorOverlay: {
          errorCount: '{count} ERROR | {count} ERRORS',
          multipleErrorCount: '{count} error found | {count} errors found',
          multipleErrorsMessage: 'Resolve them before running the workflow.'
        }
      }
    }
  })
}

function makeNodeError(messages: string[]): NodeError {
  return {
    class_type: 'KSampler',
    dependent_outputs: [],
    errors: messages.map((message) => ({
      type: 'execution_error',
      message,
      details: 'details'
    }))
  }
}

function mountOverlayState() {
  const pinia = createPinia()
  setActivePinia(pinia)

  const Harness = defineComponent({
    setup() {
      return useErrorOverlayState()
    },
    template: `
      <section>
        <span data-testid="visible">{{ isVisible }}</span>
        <span data-testid="title">{{ overlayTitle }}</span>
        <span data-testid="message">{{ overlayMessage }}</span>
      </section>
    `
  })

  return render(Harness, {
    global: {
      plugins: [pinia, createTestI18n()]
    }
  })
}

describe('useErrorOverlayState', () => {
  beforeEach(() => {
    mockAllErrorGroups.value = []
  })

  it('uses the raw message for a single uncataloged execution error', async () => {
    mountOverlayState()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.lastNodeErrors = {
      '1': makeNodeError(['Only error'])
    }
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        groupKey: 'execution:KSampler',
        displayTitle: 'Execution failed',
        priority: 0,
        cards: [
          {
            id: '1',
            title: 'KSampler',
            errors: [{ message: 'Only error' }]
          }
        ]
      }
    ]
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('visible')).toHaveTextContent('true')
    expect(screen.getByTestId('title')).toHaveTextContent('Execution failed')
    expect(screen.getByTestId('message')).toHaveTextContent('Only error')
  })

  it('uses toast copy for a single validation error', async () => {
    mountOverlayState()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.lastNodeErrors = {
      '1': makeNodeError(['Required input is missing'])
    }
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        groupKey: 'execution:KSampler',
        displayTitle: 'Required input is missing',
        priority: 0,
        cards: [
          {
            id: '1',
            title: 'KSampler',
            errors: [
              {
                message: 'Required input is missing',
                toastTitle: 'Required input missing',
                toastMessage: 'KSampler is missing a required input: model'
              }
            ]
          }
        ]
      }
    ]
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('title')).toHaveTextContent(
      'Required input missing'
    )
    expect(screen.getByTestId('message')).toHaveTextContent(
      'KSampler is missing a required input: model'
    )
  })

  it('uses display copy before raw copy when toast copy is absent', async () => {
    mountOverlayState()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.lastNodeErrors = {
      '1': makeNodeError(['Raw validation error'])
    }
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        groupKey: 'execution:KSampler',
        displayTitle: 'Friendly validation title',
        priority: 0,
        cards: [
          {
            id: '1',
            title: 'KSampler',
            errors: [
              {
                message: 'Raw validation error',
                displayMessage: 'Friendly validation message'
              }
            ]
          }
        ]
      }
    ]
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('title')).toHaveTextContent(
      'Friendly validation title'
    )
    expect(screen.getByTestId('message')).toHaveTextContent(
      'Friendly validation message'
    )
  })

  it('uses toast copy for a single runtime error', async () => {
    mountOverlayState()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.lastExecutionError = {
      prompt_id: 'prompt',
      node_id: 1,
      node_type: 'KSampler',
      executed: [],
      exception_message: 'CUDA out of memory',
      exception_type: 'torch.OutOfMemoryError',
      traceback: [],
      timestamp: Date.now()
    }
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        groupKey: 'execution:KSampler',
        displayTitle: 'Generation failed',
        priority: 0,
        cards: [
          {
            id: '1',
            title: 'KSampler',
            errors: [
              {
                message: 'torch.OutOfMemoryError: CUDA out of memory',
                toastTitle: 'Generation failed',
                toastMessage:
                  'Not enough GPU memory. Try reducing image resolution or batch size and run again.'
              }
            ]
          }
        ]
      }
    ]
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('title')).toHaveTextContent('Generation failed')
    expect(screen.getByTestId('message')).toHaveTextContent(
      'Not enough GPU memory. Try reducing image resolution or batch size and run again.'
    )
  })

  it('uses group toast copy for a single missing media error', async () => {
    mountOverlayState()

    const executionErrorStore = useExecutionErrorStore()
    const missingMediaStore = useMissingMediaStore()
    missingMediaStore.setMissingMedia([
      {
        nodeId: '1',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'image.png',
        isMissing: true
      }
    ])
    mockAllErrorGroups.value = [
      {
        type: 'missing_media',
        groupKey: 'missing_media',
        displayTitle: 'Media input missing',
        displayMessage: 'A required media input has no file selected.',
        toastTitle: 'Media input missing',
        toastMessage: 'Load Image is missing a required media file.',
        priority: 3
      }
    ]
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('title')).toHaveTextContent('Media input missing')
    expect(screen.getByTestId('message')).toHaveTextContent(
      'Load Image is missing a required media file.'
    )
  })

  it('does not show when a raw error has no resolved overlay message', async () => {
    mountOverlayState()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.lastNodeErrors = {
      '1': makeNodeError(['Only error'])
    }
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('visible')).toHaveTextContent('false')
    expect(screen.getByTestId('message')).toBeEmptyDOMElement()
  })

  it('uses aggregate copy for multiple errors', async () => {
    mountOverlayState()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.lastNodeErrors = {
      '1': makeNodeError([
        'First error',
        'Second error',
        'Third error',
        'Fourth error',
        'Fifth error',
        'Sixth error',
        'Seventh error'
      ])
    }
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        groupKey: 'execution:KSampler',
        displayTitle: 'Execution failed',
        priority: 0,
        cards: [
          {
            id: '1',
            title: 'KSampler',
            errors: [{ message: 'First error' }]
          }
        ]
      }
    ]
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('visible')).toHaveTextContent('true')
    expect(screen.getByTestId('title')).toHaveTextContent('7 errors found')
    expect(screen.getByTestId('message')).toHaveTextContent(
      'Resolve them before running the workflow.'
    )
  })
})
