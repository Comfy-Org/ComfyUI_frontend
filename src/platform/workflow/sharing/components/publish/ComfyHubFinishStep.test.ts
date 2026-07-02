import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { ComfyHubProfile } from '@/schemas/apiSchema'

import ComfyHubFinishStep from './ComfyHubFinishStep.vue'

interface PrivateAsset {
  id: string
  name: string
}

const mockAsyncState = vi.hoisted(() => ({
  refs: null as null | {
    state: { value: PrivateAsset[] }
    isLoading: { value: boolean }
    error: { value: Error | null }
  }
}))

vi.mock('@vueuse/core', async () => {
  const { ref } = await import('vue')

  const state = ref<PrivateAsset[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  mockAsyncState.refs = {
    state,
    isLoading,
    error
  }

  return {
    useAsyncState: () => ({
      state,
      isLoading,
      error
    })
  }
})

vi.mock('@/platform/workflow/sharing/services/workflowShareService', () => ({
  useWorkflowShareService: () => ({
    getShareableAssets: vi.fn()
  })
}))

vi.mock(
  '@/platform/workflow/sharing/components/ShareAssetWarningBox.vue',
  () => ({
    default: {
      props: ['items', 'acknowledged'],
      emits: ['update:acknowledged'],
      template: `
        <section data-testid="asset-warning">
          <span v-for="item in items" :key="item.id">{{ item.name }}</span>
          <button type="button" @click="$emit('update:acknowledged', true)">
            acknowledge
          </button>
        </section>
      `
    }
  })
)

const profile: ComfyHubProfile = {
  username: 'ada',
  name: 'Ada Lovelace',
  description: 'First programmer'
}

function setAsyncState({
  assets = [],
  loading = false,
  error = null
}: {
  assets?: PrivateAsset[]
  loading?: boolean
  error?: Error | null
} = {}) {
  if (!mockAsyncState.refs)
    throw new Error('async state refs were not initialized')
  mockAsyncState.refs.state.value = assets
  mockAsyncState.refs.isLoading.value = loading
  mockAsyncState.refs.error.value = error
}

function renderStep(
  props: Partial<InstanceType<typeof ComfyHubFinishStep>['$props']> = {}
) {
  return render(ComfyHubFinishStep, {
    props: {
      profile,
      ...props
    },
    global: {
      config: {
        globalProperties: {
          $t: (key: string) => key
        }
      }
    }
  })
}

describe('ComfyHubFinishStep', () => {
  beforeEach(() => {
    setAsyncState()
  })

  it('renders profile pictures while assets are loading', () => {
    setAsyncState({ loading: true })

    renderStep({
      profile: {
        ...profile,
        profilePictureUrl: 'https://cdn.example.com/ada.png'
      }
    })

    expect(screen.getByAltText('ada')).toHaveAttribute(
      'src',
      'https://cdn.example.com/ada.png'
    )
    expect(screen.getByText('shareWorkflow.checkingAssets')).toBeInTheDocument()
  })

  it('requires acknowledging private assets before it becomes ready', async () => {
    const user = userEvent.setup()
    setAsyncState({
      assets: [{ id: 'asset-1', name: 'private.png' }]
    })

    renderStep()

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByTestId('asset-warning')).toHaveTextContent('private.png')

    await user.click(screen.getByRole('button', { name: 'acknowledge' }))
    await nextTick()

    expect(screen.getByTestId('asset-warning')).toBeInTheDocument()
  })

  it('is ready when no assets are private and not ready when asset loading fails', () => {
    renderStep()

    expect(
      screen.queryByText('comfyHubPublish.additionalInfo')
    ).not.toBeInTheDocument()

    setAsyncState({ error: new Error('failed') })
    renderStep()

    expect(
      screen.queryByText('shareWorkflow.checkingAssets')
    ).not.toBeInTheDocument()
  })
})
