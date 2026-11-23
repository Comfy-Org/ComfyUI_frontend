import userEvent from '@testing-library/user-event'
import { useTelemetry } from '@comfyorg/telemetry'
import type { RunOnCloudTelemetryEvent } from '@comfyorg/telemetry/types'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { openRunOnCloudDialog } from '@/platform/openOnCloud/openRunOnCloudDialog'
import { checkCloudCompatibility } from '@/platform/openOnCloud/cloudCompatibilityApi'
import type {
  CloudWorkflowCheckResult,
  CloudWorkflowVerdict
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import CloudButton from '@/components/CloudButton.vue'
import { useLocalModelUploadStore } from '@/platform/openOnCloud/stores/localModelUploadStore'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useDialogStore } from '@/stores/dialogStore'
import { testI18n } from '@/utils/__tests__/testI18n'
import type { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const withConsent = vi.hoisted(() =>
  vi.fn<ReturnType<typeof useAgentConsent>['withConsent']>(
    async (_trigger, onAccept) => onAccept()
  )
)

vi.mock(
  import('@/workbench/extensions/agent/composables/agent/useAgentConsent'),
  () => ({
    useAgentConsent: () => ({
      accepted: computed(() => true),
      isChecking: computed(() => false),
      withConsent,
      resumeAcceptAfterReload: vi.fn(async () => {})
    })
  })
)

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/openOnCloud/cloudCompatibilityApi'))
vi.mock(import('@/platform/openOnCloud/openRunOnCloudDialog'), { spy: true })

await import('@/platform/openOnCloud/components/RunOnCloudDialog.vue')

function deferredVerdict() {
  let resolve!: (verdict: CloudWorkflowVerdict) => void
  const promise = new Promise<CloudWorkflowVerdict>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('Cloud button compatibility checks', () => {
  beforeEach(() => {
    Object.assign(useFeatureFlags().flags, {
      openOnCloudModelUploadEnabled: true
    })
  })

  it('shows missing models but hides upload and recovery while rollout is off', async () => {
    Object.assign(useFeatureFlags().flags, {
      openOnCloudModelUploadEnabled: false
    })
    const model = { folder: 'loras', name: 'unavailable.safetensors' }
    vi.mocked(checkCloudCompatibility).mockResolvedValue({
      kind: 'missing',
      gaps: { nodePacks: [], models: [model] }
    })
    useLocalModelUploadStore().upload = {
      phase: 'failed',
      reason: 'storagePending',
      models: [model]
    }
    render(
      {
        components: { CloudButton, GlobalDialog },
        template: '<CloudButton /><GlobalDialog />'
      },
      { global: { plugins: [testI18n] } }
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.click(screen.getByTestId('cloud-button'))

    expect(await screen.findByText(model.name)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Sign in to upload' })
    ).toBeNull()
    expect(screen.queryByTestId('cloud-upload-recovery-button')).toBeNull()
  })

  it('offers finish-only recovery for accepted files while rollout is off', async () => {
    Object.assign(useFeatureFlags().flags, {
      openOnCloudModelUploadEnabled: false
    })
    Object.assign(useCurrentUser(), { isLoggedIn: computed(() => true) })
    const model = { folder: 'loras', name: 'accepted.safetensors' }
    const models = [model]
    const uploads = useLocalModelUploadStore()
    uploads.retryBatches = [models]
    vi.spyOn(uploads, 'canFinish').mockReturnValue(true)
    vi.spyOn(uploads, 'canUpload').mockReturnValue(true)
    const finish = vi.spyOn(uploads, 'start').mockResolvedValue(undefined)
    render(
      {
        components: { CloudButton, GlobalDialog },
        template: '<CloudButton /><GlobalDialog />'
      },
      { global: { plugins: [testI18n] } }
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    await user.click(screen.getByTestId('cloud-upload-recovery-button'))

    expect(await screen.findByText(model.name)).toBeVisible()
    expect(screen.queryByLabelText(`Choose file for ${model.name}`)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Confirm uploads' }))

    expect(finish).toHaveBeenCalledWith(models, { refreshWorkflow: false })
  })

  it('discards the old Cloud check when the model-upload rollout changes', async () => {
    const { flags } = useFeatureFlags()
    Object.assign(flags, { openOnCloudModelUploadEnabled: false })
    const stale = deferredVerdict()
    const model = { folder: 'loras', name: 'unavailable.safetensors' }
    const verdict: CloudWorkflowVerdict = {
      kind: 'missing',
      gaps: { models: [model], nodePacks: [] }
    }
    vi.mocked(checkCloudCompatibility)
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(verdict)
    const store = useCloudWorkflowCheckStore()
    const initial = store.check()

    Object.assign(flags, { openOnCloudModelUploadEnabled: true })
    await waitFor(() =>
      expect(store.state).toEqual({ phase: 'answered', verdict })
    )
    stale.resolve({ kind: 'canOpen' })
    await initial

    expect(checkCloudCompatibility).toHaveBeenCalledTimes(2)
    expect(store.state).toEqual({ phase: 'answered', verdict })
  })

  it.for([
    {
      flag: true,
      enabled: false,
      rows: ['Open in Claude desktop', 'Open in Codex', 'Copy prompt']
    },
    {
      flag: false,
      enabled: true,
      rows: ['Open in Claude desktop', 'Open in Codex', 'Copy prompt']
    },
    {
      flag: true,
      enabled: true,
      rows: [
        'Use local agent',
        'Open in Claude desktop',
        'Open in Codex',
        'Copy prompt'
      ]
    }
  ])(
    'preserves agent choice for missing nodes when flag=$flag and available=$enabled',
    async ({ flag, enabled, rows }) => {
      Object.assign(useFeatureFlags().flags, {
        openOnCloudUseLocalAgentEnabled: flag
      })
      useAgentPanelStore().enabled = enabled
      vi.mocked(checkCloudCompatibility).mockResolvedValue({
        kind: 'missing',
        gaps: { nodePacks: ['ImpactWildcard'], models: [] }
      })
      render(
        {
          components: { CloudButton, GlobalDialog },
          template: '<CloudButton /><GlobalDialog />'
        },
        { global: { plugins: [testI18n] } }
      )
      const user = userEvent.setup({ pointerEventsCheck: 0 })

      await user.click(screen.getByTestId('cloud-button'))
      await user.click(await screen.findByTestId('deploy-setup-agent'))

      expect(
        (await screen.findAllByRole('menuitem')).map((row) =>
          row.textContent.trim()
        )
      ).toEqual(rows)
      expect(useAgentPanelStore().isVisible).toBe(false)
    }
  )

  it('opens the completed hover result without requesting it again', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    render(CloudButton, { global: { plugins: [testI18n] } })
    const user = userEvent.setup()
    const button = screen.getByTestId('cloud-button')

    await user.hover(button)
    await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'))
    expect(useTelemetry()?.trackUiButtonClicked).not.toHaveBeenCalled()
    await user.click(button)

    await waitFor(() =>
      expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
        true
      )
    )
    expect(checkCloudCompatibility).toHaveBeenCalledOnce()
    expect(
      useTelemetry()?.trackUiButtonClicked
    ).toHaveBeenCalledExactlyOnceWith({
      button_id: 'run_bar_cloud_clicked',
      element_group: 'top_menu'
    })
  })

  it('names the dialog after its title', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    render(
      {
        components: { CloudButton, GlobalDialog },
        template: '<CloudButton /><GlobalDialog />'
      },
      { global: { plugins: [testI18n] } }
    )
    const user = userEvent.setup()

    await user.click(screen.getByTestId('cloud-button'))

    expect(
      await screen.findByRole('dialog', { name: 'Run on Comfy Cloud' })
    ).toBeVisible()
  })

  it('keeps upload recovery available beside the current workflow check', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    const model = { folder: 'loras', name: 'unfinished.safetensors' }
    useLocalModelUploadStore().upload = {
      phase: 'failed',
      reason: 'storagePending',
      models: [model]
    }
    render(
      {
        components: { CloudButton, GlobalDialog },
        template: '<CloudButton /><GlobalDialog />'
      },
      { global: { plugins: [testI18n] } }
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.click(screen.getByTestId('cloud-button'))
    expect(await screen.findByTestId('run-on-cloud-card')).toBeVisible()
    useDialogStore().closeDialog({ key: 'global-run-on-comfy-cloud' })
    await nextTick()

    await user.click(
      screen.getByRole('button', { name: 'Resume model upload' })
    )
    expect(await screen.findByText(model.name)).toBeVisible()
  })

  it('keeps a reopened progress dialog on its batch when the upload fails', async () => {
    const model = { folder: 'loras', name: 'interrupted.safetensors' }
    const models = [model]
    const uploads = useLocalModelUploadStore()
    uploads.upload = {
      phase: 'uploading',
      sent: 1,
      total: 2,
      models,
      canCancel: true
    }
    render(
      {
        components: { CloudButton, GlobalDialog },
        template: '<CloudButton /><GlobalDialog />'
      },
      { global: { plugins: [testI18n] } }
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    await user.click(screen.getByTestId('cloud-button'))
    expect(await screen.findByText(model.name)).toBeVisible()

    uploads.upload = { phase: 'failed', reason: 'failed', models }
    await nextTick()

    expect(screen.getByText(model.name)).toBeVisible()
  })

  it('keeps the selected upload recovery open when rollback refreshes the workflow check', async () => {
    Object.assign(useCurrentUser(), { isLoggedIn: computed(() => true) })
    const refresh = deferredVerdict()
    vi.mocked(checkCloudCompatibility)
      .mockResolvedValueOnce({ kind: 'canOpen' })
      .mockReturnValueOnce(refresh.promise)
    const model = {
      folder: 'loras',
      name: 'accepted-other-workflow.safetensors'
    }
    const models = [model]
    const uploads = useLocalModelUploadStore()
    uploads.retryBatches = [models]
    vi.spyOn(uploads, 'canFinish').mockReturnValue(true)
    vi.spyOn(uploads, 'canUpload').mockReturnValue(true)
    const finish = vi.spyOn(uploads, 'start').mockResolvedValue(undefined)
    render(
      {
        components: { CloudButton, GlobalDialog },
        template: '<CloudButton /><GlobalDialog />'
      },
      { global: { plugins: [testI18n] } }
    )
    const checks = useCloudWorkflowCheckStore()
    await checks.check()
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    await user.click(screen.getByTestId('cloud-upload-recovery-button'))
    const recovery = await screen.findByTestId('missing-models-card')
    expect(within(recovery).getByText(model.name)).toBeVisible()

    Object.assign(useFeatureFlags().flags, {
      openOnCloudModelUploadEnabled: false
    })
    await nextTick()

    expect(checks.state.phase).toBe('checking')
    expect(recovery).toBeVisible()
    refresh.resolve({ kind: 'canOpen' })
    await waitFor(() => expect(checks.state.phase).toBe('answered'))
    expect(recovery).toBeVisible()
    await user.click(
      within(recovery).getByRole('button', { name: 'Confirm uploads' })
    )
    expect(finish).toHaveBeenCalledWith(models, { refreshWorkflow: false })
  })

  it('keeps progress and cancellation accessible when Open on Cloud is rolled back', async () => {
    const model = { folder: 'loras', name: 'in-flight.safetensors' }
    useLocalModelUploadStore().upload = {
      phase: 'uploading',
      sent: 1,
      total: 2,
      models: [model],
      canCancel: true
    }
    render(
      {
        components: { CloudButton, GlobalDialog },
        template: '<CloudButton :show-cloud-action="false" /><GlobalDialog />'
      },
      { global: { plugins: [testI18n] } }
    )
    Object.assign(useFeatureFlags().flags, {
      openOnCloudModelUploadEnabled: false
    })
    await nextTick()

    expect(screen.getByTestId('cloud-button-upload-progress')).toBeVisible()
    await userEvent
      .setup({ pointerEventsCheck: 0 })
      .click(screen.getByTestId('cloud-button'))

    expect(await screen.findByText(model.name)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cancel upload' })).toBeVisible()
  })

  it('dismisses reopened progress when a cancelled upload has nothing to recover', async () => {
    const model = { folder: 'loras', name: 'cancelled.safetensors' }
    const uploads = useLocalModelUploadStore()
    uploads.upload = {
      phase: 'uploading',
      sent: 0,
      total: 2,
      models: [model],
      canCancel: true
    }
    render(
      {
        components: { CloudButton, GlobalDialog },
        template: '<CloudButton /><GlobalDialog />'
      },
      { global: { plugins: [testI18n] } }
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    await user.click(screen.getByTestId('cloud-button'))
    expect(await screen.findByText(model.name)).toBeVisible()

    uploads.upload = { phase: 'failed', reason: 'cancelled' }

    await waitFor(() =>
      expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
        false
      )
    )
  })

  it('lets users open an older failed batch when a newer batch is waiting', async () => {
    const newer = { folder: 'loras', name: 'newer.safetensors' }
    const older = { folder: 'checkpoints', name: 'older.safetensors' }
    const newerBatch = [newer]
    const uploads = useLocalModelUploadStore()
    uploads.retryBatches = [newerBatch, [older]]
    uploads.upload = {
      phase: 'failed',
      reason: 'storageLimit',
      models: newerBatch
    }
    render(
      {
        components: { CloudButton, GlobalDialog },
        template: '<CloudButton /><GlobalDialog />'
      },
      { global: { plugins: [testI18n] } }
    )
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    await user.click(
      screen.getByRole('button', { name: 'Resume model upload' })
    )
    await user.click(await screen.findByRole('menuitem', { name: older.name }))

    const card = await screen.findByTestId('missing-models-card')
    expect(within(card).getByText(older.name)).toBeVisible()
  })

  it('waits for the pending hover request when clicked', async () => {
    const response = deferredVerdict()
    vi.mocked(checkCloudCompatibility).mockReturnValue(response.promise)
    render(CloudButton, { global: { plugins: [testI18n] } })
    const user = userEvent.setup()
    const button = screen.getByTestId('cloud-button')

    await user.hover(button)
    await user.click(button)
    expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
      false
    )
    response.resolve({ kind: 'canOpen' })

    await waitFor(() =>
      expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
        true
      )
    )
    expect(checkCloudCompatibility).toHaveBeenCalledOnce()
  })

  it('keeps a held answer when hovered again', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    render(CloudButton, { global: { plugins: [testI18n] } })
    const user = userEvent.setup()
    const button = screen.getByTestId('cloud-button')
    await user.hover(button)
    await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'))

    await user.unhover(button)
    await user.hover(button)

    expect(button).not.toHaveAttribute('aria-busy')
    expect(checkCloudCompatibility).toHaveBeenCalledOnce()
  })

  it('checks again after the workflow is edited', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    render(CloudButton, { global: { plugins: [testI18n] } })
    const user = userEvent.setup()
    const button = screen.getByTestId('cloud-button')
    await user.hover(button)
    await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'))

    api.dispatchCustomEvent('graphChanged', fromPartial({ nodes: [] }))
    await user.click(button)

    await waitFor(() =>
      expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
        true
      )
    )
    expect(checkCloudCompatibility).toHaveBeenCalledTimes(2)
  })

  it('ignores a pending answer for a workflow that is no longer active', async () => {
    const response = deferredVerdict()
    vi.mocked(checkCloudCompatibility).mockReturnValueOnce(response.promise)
    render(CloudButton, { global: { plugins: [testI18n] } })
    const user = userEvent.setup()
    const button = screen.getByTestId('cloud-button')
    await user.click(button)

    useWorkflowStore().activeWorkflow = fromPartial({ filename: 'other.json' })
    await nextTick()
    expect(button).not.toHaveAttribute('aria-busy')
    response.resolve({ kind: 'canOpen' })
    await response.promise
    await nextTick()
    expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
      false
    )

    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    await user.click(button)
    await waitFor(() =>
      expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
        true
      )
    )
    expect(checkCloudCompatibility).toHaveBeenCalledTimes(2)
  })

  it('waits for a click before checking again after a failed check', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValueOnce(null)
    render(CloudButton, { global: { plugins: [testI18n] } })
    const user = userEvent.setup()
    const button = screen.getByTestId('cloud-button')
    await user.hover(button)
    await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'))

    await user.unhover(button)
    await user.hover(button)
    expect(checkCloudCompatibility).toHaveBeenCalledOnce()

    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    await user.click(button)
    await waitFor(() =>
      expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
        true
      )
    )
    expect(checkCloudCompatibility).toHaveBeenCalledTimes(2)
  })

  it.for<{
    name: string
    result: CloudWorkflowCheckResult
    message: string
    properties: RunOnCloudTelemetryEvent['properties']
  }>([
    {
      name: 'asks for nodes when the workflow has none to run',
      result: { kind: 'emptyWorkflow' },
      message:
        'This workflow has no nodes to run. Add nodes and save it, then try again.',
      properties: { reason: 'empty_workflow' }
    },
    {
      name: 'names the missing model loader and explains how to continue',
      result: {
        kind: 'unreadableModelLoader',
        nodeType: 'ImpactCheckpointLoader'
      },
      message:
        'Could not read the model settings for ImpactCheckpointLoader. Install the node pack that provides it, then try again.',
      properties: {
        reason: 'unreadable_model_loader',
        node_type: 'ImpactCheckpointLoader'
      }
    },
    {
      name: 'asks to try again when Comfy Cloud gives no answer',
      result: null,
      message: 'Could not check this workflow on Comfy Cloud. Try again.',
      properties: { reason: 'no_verdict' }
    }
  ])('$name', async ({ result, message, properties }) => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue(result)
    render(CloudButton, { global: { plugins: [testI18n] } })

    await userEvent.setup().click(screen.getByTestId('cloud-button'))

    await waitFor(() =>
      expect(useToast().toasts.map((toast) => toast.title)).toContain(message)
    )
    expect(
      useTelemetry()?.trackRunOnCloudEvent
    ).toHaveBeenCalledExactlyOnceWith({
      name: 'app:run_on_cloud_check_failed',
      properties
    })
    expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
      false
    )
  })

  it('opens the dialog when Cloud is missing nodes or models', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({
      kind: 'missing',
      gaps: { nodePacks: ['ImpactWildcard'], models: [] }
    })
    render(CloudButton, { global: { plugins: [testI18n] } })
    const user = userEvent.setup()

    await user.click(screen.getByTestId('cloud-button'))

    await waitFor(() =>
      expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
        true
      )
    )
    expect(useToast().toasts).toEqual([])
  })

  it('closes the open dialog when the Cloud button unmounts', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    const { unmount } = render(CloudButton, {
      global: { plugins: [testI18n] }
    })
    const dialogs = useDialogStore()

    await userEvent.setup().click(screen.getByTestId('cloud-button'))
    await waitFor(() =>
      expect(dialogs.isDialogOpen('global-run-on-comfy-cloud')).toBe(true)
    )

    unmount()

    expect(dialogs.isDialogOpen('global-run-on-comfy-cloud')).toBe(false)
  })

  it('opens nothing when the button unmounts while the dialog loads', async () => {
    let opening: Promise<boolean> | undefined
    vi.mocked(openRunOnCloudDialog).mockImplementationOnce((isStillWanted) => {
      opening = openRunOnCloudDialog(isStillWanted)
      return opening
    })
    const response = deferredVerdict()
    vi.mocked(checkCloudCompatibility).mockReturnValue(response.promise)
    const { unmount } = render(CloudButton, {
      global: { plugins: [testI18n] }
    })
    const user = userEvent.setup()
    await user.click(screen.getByTestId('cloud-button'))

    response.resolve({ kind: 'canOpen' })
    await response.promise
    await nextTick()
    unmount()

    await expect(opening).resolves.toBe(false)

    expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
      false
    )
  })
})
