import { computed, onMounted, onScopeDispose, shallowRef } from 'vue'
import { useEventListener } from '@vueuse/core'

import type { WorkflowWorkshopModelDetail } from '../config/models-catalogue'
import type { FormValues } from '../config/workshop-playground'
import { validateForm } from '../config/workshop-playground'
import { initialWorkshopPageState } from '../config/workshop-page-state'
import { useWorkshopSession } from '../config/workshop-session-state'
import { markWorkshopCreditsDirty } from '../config/workshop-credits'
import {
  createWorkflowApi,
  WorkshopWorkflowError
} from '../config/workshop-workflow-api'
import { createWorkflowController } from '../config/workshop-workflow-controller'
import type { WorkflowState } from '../config/workshop-workflow-state'
import { workflowStorage } from '../config/workshop-workflow-storage'
import { workshopIdempotencyKey } from '../config/workshop-snippets'
import { captureWorkshopEvent } from '../scripts/posthog'
import type { WorkshopRunAnalytics } from '../scripts/workshop-analytics'
import {
  workshopFieldErrorCodes,
  workshopModelAnalytics,
  workshopWorkflowFailureAnalytics
} from '../scripts/workshop-analytics'

const CHARGE_WINDOW_MS = 5 * 60_000

export function useWorkflowRun(
  model: WorkflowWorkshopModelDetail,
  scope: string,
  restoreInputs: (inputs: FormValues) => void
) {
  const session = useWorkshopSession()
  const state = shallowRef<WorkflowState>({ phase: 'idle' })
  const lifetime = new AbortController()
  const initial = initialWorkshopPageState(model)
  const modelAnalytics = workshopModelAnalytics(model)
  const attempt = shallowRef<{
    analytics: WorkshopRunAnalytics
    startedAt: number
    finished: boolean
  }>()
  let controller: ReturnType<typeof createWorkflowController> | undefined

  function observeAttempt(next: WorkflowState) {
    const active = attempt.value
    if (!active || active.finished) return
    if (next.phase !== 'settled' && next.phase !== 'failed') return
    attempt.value = { ...active, finished: true }
    const common = {
      ...active.analytics,
      duration_ms: Date.now() - active.startedAt
    }
    if (next.phase === 'failed') {
      captureWorkshopEvent({
        name: 'run_finished',
        properties: {
          ...common,
          status: 'failed',
          ...workshopWorkflowFailureAnalytics(next.error, initial.schema)
        }
      })
      return
    }
    const run = next.observation.run
    const outcome =
      run.state === 'succeeded'
        ? {
            status: 'succeeded' as const,
            output_count: next.observation.outputs.length
          }
        : run.state === 'cancelled'
          ? { status: 'cancelled' as const }
          : {
              status: 'failed' as const,
              ...workshopWorkflowFailureAnalytics(
                new WorkshopWorkflowError('execution_failed'),
                initial.schema
              )
            }
    captureWorkshopEvent({
      name: 'run_finished',
      properties: { ...common, request_id: run.id, ...outcome }
    })
  }

  function sameCaller() {
    const current = session.session.value
    return current &&
      scope === JSON.stringify([current.uid, current.workspace.id])
      ? current
      : undefined
  }

  const api = createWorkflowApi({
    definition: model.workflow,
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

  const chargedRuns = new Set<string>()

  async function settle(command?: Promise<void>) {
    await command
    if (lifetime.signal.aborted || !sameCaller()) return
    if (state.value.phase !== 'settled') return
    const { id, completedAt, updatedAt } = state.value.observation.run
    if (
      chargedRuns.has(id) ||
      Date.now() - Date.parse(completedAt ?? updatedAt) > CHARGE_WINDOW_MS
    )
      return
    chargedRuns.add(id)
    markWorkshopCreditsDirty()
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
          if (!lifetime.signal.aborted && sameCaller()) {
            state.value = next
            observeAttempt(next)
          }
        }
      })
      await settle(controller.resume())
    } catch {
      if (!lifetime.signal.aborted && sameCaller())
        state.value = {
          phase: 'failed',
          error: new WorkshopWorkflowError('persistence')
        }
    }
  })

  useEventListener('online', () => {
    if (
      state.value.phase === 'interrupted' &&
      state.value.record.stage === 'run'
    )
      void settle(controller?.resume())
  })
  onScopeDispose(() => {
    controller?.dispose()
    lifetime.abort()
  })

  async function start(inputs: FormValues) {
    const owner = sameCaller()
    if (
      !controller ||
      !owner ||
      lifetime.signal.aborted ||
      ['preparing', 'active', 'interrupted'].includes(state.value.phase)
    )
      return
    const errors = validateForm(initial.schema, {
      ...initial.values,
      ...inputs
    })
    if (Object.keys(errors).length) {
      captureWorkshopEvent({
        name: 'run_validation_failed',
        properties: {
          ...modelAnalytics,
          field_error_codes: workshopFieldErrorCodes(errors),
          field_error_names: initial.schema
            .filter((field) => Object.hasOwn(errors, field.name))
            .map((field) => field.name)
        }
      })
      return settle(controller.start(inputs))
    }
    const analytics: WorkshopRunAnalytics = {
      ...modelAnalytics,
      user_id: owner.uid,
      workspace_id: owner.workspace.id,
      attempt_id: workshopIdempotencyKey()
    }
    attempt.value = { analytics, startedAt: Date.now(), finished: false }
    captureWorkshopEvent({ name: 'run_started', properties: analytics })
    await settle(controller.start(inputs))
  }

  async function cancel() {
    await settle(controller?.cancel())
    const active = attempt.value
    if (
      active &&
      !active.finished &&
      state.value.phase === 'idle' &&
      !lifetime.signal.aborted &&
      sameCaller()
    ) {
      attempt.value = { ...active, finished: true }
      captureWorkshopEvent({
        name: 'run_finished',
        properties: {
          ...active.analytics,
          duration_ms: Date.now() - active.startedAt,
          status: 'cancelled'
        }
      })
    }
  }

  function dismiss() {
    const previous = state.value
    controller?.dismiss()
    if (
      previous.phase === 'interrupted' &&
      previous.record.stage === 'intent' &&
      state.value.phase === 'idle' &&
      !lifetime.signal.aborted &&
      sameCaller()
    )
      observeAttempt({ phase: 'failed', error: previous.error })
  }

  return {
    state,
    analytics: computed(() => attempt.value?.analytics),
    identitySettled: session.settled,
    signedIn: computed(() => Boolean(sameCaller())),
    observation: computed(() =>
      'observation' in state.value ? state.value.observation : undefined
    ),
    start,
    resume: () => settle(controller?.resume()),
    cancel,
    dismiss,
    retryDelivery: () => settle(controller?.retryDelivery()),
    refreshOutput: (id: string) => controller?.refreshOutput(id)
  }
}
