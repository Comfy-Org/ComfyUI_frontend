import { computed, onMounted, onScopeDispose, shallowRef } from 'vue'
import { useEventListener } from '@vueuse/core'

import type { components } from '@comfyorg/registry-types'

import type { WorkflowWorkshopModelDetail } from '../config/models-catalogue'
import type { FormValues } from '../config/workshop-playground'
import { useWorkshopSession } from '../config/workshop-session-state'
import { refreshWorkshopCredits } from '../config/workshop-credits'
import {
  createWorkflowApi,
  WorkshopWorkflowError
} from '../config/workshop-workflow-api'
import { createWorkflowController } from '../config/workshop-workflow-controller'
import type { WorkflowState } from '../config/workshop-workflow-state'
import { workflowStorage } from '../config/workshop-workflow-storage'
import type { WorkflowRunSummary } from '../config/workshop-workflow-response'

type HistoryPage = components['schemas']['WorkshopWorkflowRunPage']

export function useWorkflowRun(
  model: WorkflowWorkshopModelDetail,
  scope: string,
  restoreInputs: (inputs: FormValues) => void
) {
  const session = useWorkshopSession()
  const state = shallowRef<WorkflowState>({ phase: 'idle' })
  const history = shallowRef<{
    status: 'ready' | 'loading' | 'failed'
    page: HistoryPage
  }>({ status: 'ready', page: { items: [] } })
  const lifetime = new AbortController()
  let controller: ReturnType<typeof createWorkflowController> | undefined

  function sameCaller() {
    const current = session.session.value
    return current &&
      scope === JSON.stringify([current.uid, current.workspace.id])
      ? current
      : undefined
  }

  const api = createWorkflowApi({
    token: async (refresh) => {
      const owner = sameCaller()
      if (!owner || lifetime.signal.aborted)
        throw new WorkshopWorkflowError('not_authenticated')
      const credential = await (refresh ? session.remint : session.ensureFresh)(
        undefined,
        { workspaceId: owner.workspace.id, signal: lifetime.signal }
      )
      lifetime.signal.throwIfAborted()
      if (
        !sameCaller() ||
        credential?.status !== 'ok' ||
        credential.session.uid !== owner.uid ||
        credential.session.workspace.id !== owner.workspace.id
      )
        throw new WorkshopWorkflowError('access_denied')
      return credential.session.token
    }
  })

  async function loadHistory(more = false) {
    if (!sameCaller() || history.value.status === 'loading') return
    const previous = history.value.page
    history.value = { status: 'loading', page: previous }
    try {
      const page = await api.history(
        lifetime.signal,
        model.workflowId,
        more ? previous.nextCursor : undefined
      )
      lifetime.signal.throwIfAborted()
      if (!sameCaller()) return
      history.value = {
        status: 'ready',
        page: {
          ...page,
          items: more ? [...previous.items, ...page.items] : page.items
        }
      }
    } catch {
      if (!lifetime.signal.aborted && sameCaller())
        history.value = { status: 'failed', page: previous }
    }
  }

  async function settle(command?: Promise<void>) {
    await command
    if (lifetime.signal.aborted || !sameCaller()) return
    if (state.value.phase === 'settled')
      await Promise.allSettled([loadHistory(), refreshWorkshopCredits()])
  }

  onMounted(async () => {
    if (!sameCaller()) return
    try {
      const storage = workflowStorage(sessionStorage, scope, model.workflowId)
      const restored = storage.read()
      const inputs =
        restored?.stage === 'intent'
          ? restored.attempt.request.appInputs
          : restored?.appInputs
      if (inputs) restoreInputs(inputs)
      controller = createWorkflowController({
        model,
        api,
        storage,
        onChange: (next) => {
          if (!lifetime.signal.aborted && sameCaller()) state.value = next
        }
      })
      await Promise.allSettled([settle(controller.resume()), loadHistory()])
    } catch {
      if (!lifetime.signal.aborted && sameCaller())
        state.value = {
          phase: 'failed',
          error: new WorkshopWorkflowError('persistence')
        }
    }
  })

  useEventListener('online', () => {
    if (state.value.phase === 'interrupted') void settle(controller?.resume())
  })
  onScopeDispose(() => {
    controller?.dispose()
    lifetime.abort()
  })

  return {
    state,
    history,
    loadHistory,
    identitySettled: session.settled,
    signedIn: computed(() => Boolean(sameCaller())),
    observation: computed(() =>
      'observation' in state.value ? state.value.observation : undefined
    ),
    start: (inputs: FormValues) => settle(controller?.start(inputs)),
    resume: () => settle(controller?.resume()),
    cancel: () => settle(controller?.cancel()),
    retryDelivery: () => settle(controller?.retryDelivery()),
    refreshOutput: (id: string) => controller?.refreshOutput(id),
    open: (run: WorkflowRunSummary) => settle(controller?.open(run))
  }
}
