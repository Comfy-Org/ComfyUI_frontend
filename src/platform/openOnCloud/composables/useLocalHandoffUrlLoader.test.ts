import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoute, useRouter } from 'vue-router'

import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useLocalHandoffUrlLoader } from '@/platform/openOnCloud/composables/useLocalHandoffUrlLoader'
import { app } from '@/scripts/app'
import { defaultGraph } from '@/scripts/defaultGraph'

const preservedQueryMocks = vi.hoisted(() => ({
  clearPreservedQuery: vi.fn(),
  hydratePreservedQuery: vi.fn(),
  mergePreservedQueryIntoQuery: vi.fn()
}))

vi.mock(
  import('@/platform/navigation/preservedQueryManager'),
  () => preservedQueryMocks
)
vi.mock(import('vue-router'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/scripts/app'))

function linkWithNonce(): string {
  const nonce = crypto.randomUUID()
  useRoute().query.from_local = nonce
  return nonce
}

function handOff(
  data: unknown,
  source: MessageEventSource | null = window
): void {
  window.dispatchEvent(new MessageEvent('message', { data, source }))
}

function workflowMessage(nonce: string, workflow: unknown = defaultGraph) {
  return {
    type: 'comfy-local-handoff:workflow',
    nonce,
    filename: 'portrait',
    workflow
  }
}

async function loadWithOpener(opener: Window | null = window) {
  const { loadLocalHandoffFromUrl } = useLocalHandoffUrlLoader(() => opener)
  await loadLocalHandoffFromUrl()
}

describe(useLocalHandoffUrlLoader, () => {
  beforeEach(() => {
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
    vi.mocked(useFeatureFlags().flags).openOnCloudEnabled = true
    vi.spyOn(window, 'postMessage')
  })

  it('does nothing without a from_local param', async () => {
    await loadWithOpener()

    expect(useRouter().replace).not.toHaveBeenCalled()
    expect(window.postMessage).not.toHaveBeenCalled()
  })

  it('strips the param and asks the opener for the workflow with its nonce', async () => {
    const nonce = linkWithNonce()
    useRoute().query.other = 'kept'

    await loadWithOpener()

    expect(useRouter().replace).toHaveBeenCalledWith({
      query: { other: 'kept' }
    })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'local_handoff'
    )
    expect(window.postMessage).toHaveBeenCalledExactlyOnceWith(
      { type: 'comfy-local-handoff:ready', nonce },
      '*'
    )
  })

  it('opens the handed-over workflow and says where it came from', async () => {
    const nonce = linkWithNonce()
    await loadWithOpener()

    handOff(workflowMessage(nonce))

    await vi.waitFor(() =>
      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({
          kind: 'info',
          title: 'Opened from ComfyUI on your computer',
          description:
            "Comfy Cloud has every node and model this workflow uses. Press Run when you're ready."
        })
      )
    )
    expect(app.loadGraphData).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ type: 'KSampler' })
        ])
      }),
      true,
      true,
      'portrait'
    )
  })

  it.for([
    { name: 'another window', sameNonce: true, source: null },
    { name: 'the opener with another nonce', sameNonce: false, source: window }
  ])('ignores a workflow from $name', async ({ sameNonce, source }) => {
    const nonce = linkWithNonce()
    await loadWithOpener()

    handOff(workflowMessage(sameNonce ? nonce : crypto.randomUUID()), source)
    await vi.advanceTimersByTimeAsync(0)

    expect(app.loadGraphData).not.toHaveBeenCalled()
  })

  it('refuses a handed-over workflow that fails validation', async () => {
    const nonce = linkWithNonce()
    await loadWithOpener()

    handOff(workflowMessage(nonce, { nodes: 'not a workflow' }))

    await vi.waitFor(() =>
      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({
          kind: 'error',
          title: "Couldn't open the workflow from ComfyUI on your computer"
        })
      )
    )
    expect(app.loadGraphData).not.toHaveBeenCalled()
  })

  it.for([
    { name: 'the flag is off', flag: false, opener: window },
    { name: 'no tab opened this one', flag: true, opener: null }
  ])('only strips the param when $name', async ({ flag, opener }) => {
    vi.mocked(useFeatureFlags().flags).openOnCloudEnabled = flag
    linkWithNonce()

    await loadWithOpener(opener)

    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
    expect(window.postMessage).not.toHaveBeenCalled()
  })
})
