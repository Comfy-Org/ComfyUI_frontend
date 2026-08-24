import { createPinia, setActivePinia } from 'pinia'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useErrorOverlayState } from './useErrorOverlayState'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import type { NodeError } from '@/schemas/apiSchema'
import type {
  MissingPackGroup,
  SwapNodeGroup
} from '@/components/rightSidePanel/errors/useErrorGroups'
import type { ErrorGroup } from '@/components/rightSidePanel/errors/types'
import type { MissingMediaGroup } from '@/platform/missingMedia/types'
import type { MissingModelGroup } from '@/platform/missingModel/types'

const mockErrorGroups = vi.hoisted(() => ({
  allErrorGroups: { value: [] as ErrorGroup[] },
  missingPackGroups: { value: [] as MissingPackGroup[] },
  missingModelGroups: { value: [] as MissingModelGroup[] },
  missingMediaGroups: { value: [] as MissingMediaGroup[] },
  swapNodeGroups: { value: [] as SwapNodeGroup[] }
}))

const mockAllErrorGroups = mockErrorGroups.allErrorGroups

vi.mock('@/components/rightSidePanel/errors/useErrorGroups', () => ({
  useErrorGroups: () => mockErrorGroups
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
    mockErrorGroups.missingPackGroups.value = []
    mockErrorGroups.missingModelGroups.value = []
    mockErrorGroups.missingMediaGroups.value = []
    mockErrorGroups.swapNodeGroups.value = []
  })

  it('uses the raw message for a single uncataloged execution error', async () => {
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        groupKey: 'execution:KSampler',
        displayTitle: 'Execution failed',
        count: 1,
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
    mountOverlayState()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.recordNodeErrors({
      '1': makeNodeError(['Only error'])
    })
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('visible')).toHaveTextContent('true')
    expect(screen.getByTestId('title')).toHaveTextContent('Execution failed')
    expect(screen.getByTestId('message')).toHaveTextContent('Only error')
  })

  it('uses toast copy for a single validation error', async () => {
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        groupKey: 'execution:KSampler',
        displayTitle: 'Required input is missing',
        count: 1,
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
    mountOverlayState()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.recordNodeErrors({
      '1': makeNodeError(['Required input is missing'])
    })
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
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        groupKey: 'execution:KSampler',
        displayTitle: 'Friendly validation title',
        count: 1,
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
    mountOverlayState()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.recordNodeErrors({
      '1': makeNodeError(['Raw validation error'])
    })
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
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        groupKey: 'execution:KSampler',
        displayTitle: 'Generation failed',
        count: 1,
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
    mountOverlayState()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.recordExecutionError({
      prompt_id: 'prompt',
      node_id: 1,
      node_type: 'KSampler',
      executed: [],
      exception_message: 'CUDA out of memory',
      exception_type: 'torch.OutOfMemoryError',
      traceback: [],
      timestamp: Date.now()
    })
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('title')).toHaveTextContent('Generation failed')
    expect(screen.getByTestId('message')).toHaveTextContent(
      'Not enough GPU memory. Try reducing image resolution or batch size and run again.'
    )
  })

  it('uses group toast copy for a single missing media error', async () => {
    mockErrorGroups.missingMediaGroups.value = [
      {
        mediaType: 'image',
        items: [
          {
            name: 'image.png',
            mediaType: 'image',
            representative: {
              nodeId: '1',
              nodeType: 'LoadImage',
              widgetName: 'image',
              mediaType: 'image',
              name: 'image.png',
              isMissing: true
            },
            referencingNodes: [
              {
                nodeId: '1',
                nodeType: 'LoadImage',
                widgetName: 'image'
              }
            ]
          }
        ]
      }
    ]
    mockAllErrorGroups.value = [
      {
        type: 'missing_media',
        groupKey: 'missing_media',
        displayTitle: 'Media input missing',
        displayMessage: 'A required media input has no file selected.',
        toastTitle: 'Media input missing',
        toastMessage: 'Load Image is missing a required media file.',
        count: 1,
        priority: 3
      }
    ]
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
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('title')).toHaveTextContent('Media input missing')
    expect(screen.getByTestId('message')).toHaveTextContent(
      'Load Image is missing a required media file.'
    )
  })

  it('uses group copy for one missing model referenced by multiple nodes', async () => {
    mockErrorGroups.missingModelGroups.value = [
      {
        directory: 'checkpoints',
        isAssetSupported: true,
        models: [
          {
            name: 'missing.safetensors',
            representative: {
              nodeId: '1',
              nodeType: 'CheckpointLoaderSimple',
              widgetName: 'ckpt_name',
              name: 'missing.safetensors',
              directory: 'checkpoints',
              isAssetSupported: true,
              isMissing: true
            },
            referencingNodes: [
              { nodeId: '1', widgetName: 'ckpt_name' },
              { nodeId: '2', widgetName: 'ckpt_name' }
            ]
          }
        ]
      }
    ]
    mockAllErrorGroups.value = [
      {
        type: 'missing_model',
        groupKey: 'missing_model',
        displayTitle: 'Missing Models',
        displayMessage: 'Import a model, or open the node to replace it.',
        toastTitle: 'Model missing',
        toastMessage: 'CheckpointLoaderSimple is missing missing.safetensors.',
        count: 1,
        priority: 2
      }
    ]
    mountOverlayState()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('title')).toHaveTextContent('Missing Models')
    expect(screen.getByTestId('message')).toHaveTextContent(
      'Import a model, or open the node to replace it.'
    )
  })

  it('uses group copy for one execution group with multiple errors', async () => {
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        groupKey: 'execution:required_input_missing',
        displayTitle: 'Missing connection',
        displayMessage: 'Required input slots have no connection feeding them.',
        count: 2,
        priority: 1,
        cards: [
          {
            id: '1',
            title: 'KSampler',
            errors: [
              { message: 'KSampler is missing model' },
              { message: 'KSampler is missing positive' }
            ]
          }
        ]
      }
    ]
    mountOverlayState()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('title')).toHaveTextContent('Missing connection')
    expect(screen.getByTestId('message')).toHaveTextContent(
      'Required input slots have no connection feeding them.'
    )
  })

  it('uses aggregate copy for one missing model group with multiple rows', async () => {
    mockErrorGroups.missingModelGroups.value = [
      {
        directory: 'checkpoints',
        isAssetSupported: true,
        models: [
          {
            name: 'first.safetensors',
            representative: {
              nodeId: '1',
              nodeType: 'CheckpointLoaderSimple',
              widgetName: 'ckpt_name',
              name: 'first.safetensors',
              directory: 'checkpoints',
              isAssetSupported: true,
              isMissing: true
            },
            referencingNodes: [{ nodeId: '1', widgetName: 'ckpt_name' }]
          },
          {
            name: 'second.safetensors',
            representative: {
              nodeId: '2',
              nodeType: 'CheckpointLoaderSimple',
              widgetName: 'ckpt_name',
              name: 'second.safetensors',
              directory: 'checkpoints',
              isAssetSupported: true,
              isMissing: true
            },
            referencingNodes: [{ nodeId: '2', widgetName: 'ckpt_name' }]
          }
        ]
      }
    ]
    mockAllErrorGroups.value = [
      {
        type: 'missing_model',
        groupKey: 'missing_model',
        displayTitle: 'Missing Models',
        displayMessage: 'Import a model, or open the node to replace it.',
        toastTitle: 'Missing models',
        toastMessage: '2 model files are missing.',
        count: 2,
        priority: 2
      }
    ]
    mountOverlayState()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('title')).toHaveTextContent('2 errors found')
    expect(screen.getByTestId('message')).toHaveTextContent(
      'Resolve them before running the workflow.'
    )
  })

  it('does not show when a raw error has no resolved overlay message', async () => {
    mountOverlayState()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.recordNodeErrors({
      '1': makeNodeError(['Only error'])
    })
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('visible')).toHaveTextContent('false')
    expect(screen.getByTestId('message')).toBeEmptyDOMElement()
  })

  it('uses grouped error counts for aggregate copy', async () => {
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        groupKey: 'execution:KSampler',
        displayTitle: 'Execution failed',
        displayMessage: 'First group message',
        count: 2,
        priority: 0,
        cards: [
          {
            id: '1',
            title: 'KSampler',
            errors: [{ message: 'First error' }]
          }
        ]
      },
      {
        type: 'execution',
        groupKey: 'execution:CLIPTextEncode',
        displayTitle: 'Invalid CLIP input',
        displayMessage: 'Second group message',
        count: 3,
        priority: 1,
        cards: [
          {
            id: '2',
            title: 'CLIPTextEncode',
            errors: [{ message: 'Second error' }]
          }
        ]
      }
    ]
    mountOverlayState()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('visible')).toHaveTextContent('true')
    expect(screen.getByTestId('title')).toHaveTextContent('5 errors found')
    expect(screen.getByTestId('message')).toHaveTextContent(
      'Resolve them before running the workflow.'
    )
  })
})
