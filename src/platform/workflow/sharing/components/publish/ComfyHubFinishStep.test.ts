import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { AssetInfo, ComfyHubProfile } from '@/schemas/apiSchema'

import ComfyHubFinishStep from './ComfyHubFinishStep.vue'

const mockAsyncState = vi.hoisted(() => ({
  refs: null as null | {
    state: { value: AssetInfo[] }
    isLoading: { value: boolean }
    error: { value: Error | null }
  }
}))

vi.mock('@vueuse/core', async () => {
  const { ref } = await import('vue')

  const state = ref<AssetInfo[]>([])
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
  assets?: AssetInfo[]
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
      mocks: { $t: (key: string) => key }
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
      assets: [
        {
          id: 'asset-1',
          name: 'private.png',
          preview_url: '',
          storage_url: '',
          model: false,
          public: false,
          in_library: false
        }
      ]
    })

    renderStep()

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByTestId('asset-warning')).toHaveTextContent('private.png')

    await user.click(screen.getByRole('button', { name: 'acknowledge' }))
    await nextTick()

    expect(screen.getByTestId('asset-warning')).toBeInTheDocument()
  })

  it('is ready when no assets are private', () => {
    renderStep()

    expect(
      screen.queryByText('comfyHubPublish.additionalInfo')
    ).not.toBeInTheDocument()
  })

  it('is not ready when asset loading fails', () => {
    setAsyncState({ error: new Error('failed') })
    renderStep()

    expect(
      screen.queryByText('shareWorkflow.checkingAssets')
    ).not.toBeInTheDocument()
  })
})
