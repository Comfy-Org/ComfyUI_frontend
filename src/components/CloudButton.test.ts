import userEvent from '@testing-library/user-event'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { RunOnCloudTelemetryEvent } from '@comfyorg/telemetry/types'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import * as localOpenOnCloudRollout from '@/platform/openOnCloud/localOpenOnCloudRollout'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
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
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
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
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/openOnCloud/cloudCompatibilityApi'))
vi.mock(import('@/platform/openOnCloud/openWorkflowOnCloud'))
vi.mock(import('@/platform/openOnCloud/openRunOnCloudDialog'), { spy: true })

await import('@/platform/openOnCloud/components/RunOnCloudDialog.vue')

const checkLabel = 'Check compatibility'
const openLabel = 'Open on Comfy Cloud'
const dialogName = 'Run your workflows on Comfy Cloud'

function renderCloudButton() {
  return render(
    {
      components: { CloudButton, GlobalDialog },
      template: '<CloudButton /><GlobalDialog />'
    },
    { global: { plugins: [testI18n] } }
  )
}

function renderCloudButtonHiddenWhenSwitchedOff() {
  return render(
    {
      components: { CloudButton, GlobalDialog },
      setup: () => ({ checkStore: useCloudWorkflowCheckStore() }),
      template:
        '<CloudButton v-if="!checkStore.isSwitchedOffOnCloud" /><GlobalDialog />'
    },
    { global: { plugins: [testI18n] } }
  )
}

async function requestCloudCheck(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('cloud-button'))
  await user.click(await screen.findByRole('button', { name: checkLabel }))
}

async function openCheckedWorkflow(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: openLabel }))
}

function deferredVerdict() {
  let resolve!: (verdict: CloudWorkflowVerdict) => void
  const promise = new Promise<CloudWorkflowVerdict>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('Cloud button compatibility checks', () => {
  beforeEach(() => {
    vi.mocked(openWorkflowOnCloud).mockResolvedValue(undefined)
    vi.mocked(api.storeSetting).mockResolvedValue(new Response())
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

    await requestCloudCheck(user)

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

  it('discards a pending check without resending when the upload rollout changes', async () => {
    const { flags } = useFeatureFlags()
    Object.assign(flags, { openOnCloudModelUploadEnabled: false })
    const stale = deferredVerdict()
    vi.mocked(checkCloudCompatibility).mockReturnValueOnce(stale.promise)
    const store = useCloudWorkflowCheckStore()
    const initial = store.check()

    Object.assign(flags, { openOnCloudModelUploadEnabled: true })
    stale.resolve({ kind: 'canOpen' })
    await initial

    expect(checkCloudCompatibility).toHaveBeenCalledOnce()
    expect(store.state.phase).toBe('idle')
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

      await requestCloudCheck(user)
      await user.click(await screen.findByTestId('deploy-setup-agent'))

      expect(
        (await screen.findAllByRole('menuitem')).map((row) =>
          row.textContent.trim()
        )
      ).toEqual(rows)
      expect(useAgentPanelStore().isVisible).toBe(false)
    }
  )

  it('sends no compatibility request until the user accepts the disclosure', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    renderCloudButton()
    const user = userEvent.setup()
    const button = screen.getByTestId('cloud-button')

    await user.hover(button)
    await user.tab()
    expect(button).toHaveFocus()
    expect(checkCloudCompatibility).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')

    const dialog = await screen.findByRole('dialog', {
      name: dialogName
    })
    expect(dialog).toHaveAccessibleDescription(
      expect.stringContaining(
        'Checking will send this workflow’s node and model names to Comfy Cloud.'
      )
    )
    expect(checkCloudCompatibility).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: checkLabel }))

    const open = await within(dialog).findByRole('button', { name: openLabel })
    expect(dialog).toHaveAccessibleDescription(
      expect.stringContaining(
        'Comfy Cloud has every node and model this workflow uses.'
      )
    )
    expect(checkCloudCompatibility).toHaveBeenCalledOnce()
    expect(openWorkflowOnCloud).not.toHaveBeenCalled()

    await user.click(open)

    expect(openWorkflowOnCloud).toHaveBeenCalledExactlyOnceWith(
      undefined,
      undefined
    )
    expect(dialog).not.toBeInTheDocument()
    expect(checkCloudCompatibility).toHaveBeenCalledOnce()
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
      await screen.findByRole('dialog', { name: dialogName })
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

    await requestCloudCheck(user)
    await openCheckedWorkflow(user)
    expect(openWorkflowOnCloud).toHaveBeenCalledOnce()

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

  it('keeps the selected upload recovery open when rollback invalidates the workflow check', async () => {
    Object.assign(useCurrentUser(), { isLoggedIn: computed(() => true) })
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
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

    expect(checks.state.phase).toBe('idle')
    expect(checkCloudCompatibility).toHaveBeenCalledOnce()
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

  it('checks once in the same dialog when refreshing the upload grant enables uploads', async () => {
    const { flags } = useFeatureFlags()
    Object.assign(flags, { openOnCloudModelUploadEnabled: false })
    useLocalModelUploadStore().retryBatches = [
      [{ folder: 'loras', name: 'retry.safetensors' }]
    ]
    let finishRefresh!: () => void
    const refresh = new Promise<void>((resolve) => {
      finishRefresh = resolve
    })
    vi.spyOn(
      localOpenOnCloudRollout,
      'bindLocalOpenOnCloudGrant'
    ).mockReturnValueOnce({
      isCurrent: () => true,
      revalidate: async () => {
        await refresh
        Object.assign(flags, { openOnCloudModelUploadEnabled: true })
        return true
      },
      allowsModelTransfer: async () => true
    })
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    renderCloudButton()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('cloud-button'))
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await user.click(within(dialog).getByRole('button', { name: checkLabel }))

    expect(
      within(dialog).getByRole('button', { name: 'Checking Comfy Cloud…' })
    ).toBeDisabled()
    expect(checkCloudCompatibility).not.toHaveBeenCalled()
    finishRefresh()

    expect(
      await within(dialog).findByRole('button', { name: openLabel })
    ).toBeEnabled()
    expect(checkCloudCompatibility).toHaveBeenCalledOnce()
  })

  it('shows the first signed-in result when the check initializes its workspace', async () => {
    const workspaceId = 'ws-personal'
    Object.assign(useCurrentUser(), { isLoggedIn: computed(() => true) })
    vi.mocked(checkCloudCompatibility).mockImplementationOnce(async () => {
      const workspaces = useTeamWorkspaceStore()
      Object.assign(workspaces, { initState: 'loading' })
      await nextTick()
      Object.assign(workspaces, { activeWorkspaceId: workspaceId })
      Object.assign(workspaces, { initState: 'ready' })
      return { kind: 'canOpen', workspaceId }
    })
    renderCloudButton()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('cloud-button'))
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    await user.click(within(dialog).getByRole('button', { name: checkLabel }))
    await user.click(
      await within(dialog).findByRole('button', { name: openLabel })
    )

    expect(openWorkflowOnCloud).toHaveBeenCalledExactlyOnceWith(
      undefined,
      workspaceId
    )
  })

  it('keeps a reopened compatibility dialog dismissible during a recheck', async () => {
    const response = deferredVerdict()
    vi.mocked(checkCloudCompatibility)
      .mockResolvedValueOnce({ kind: 'canOpen' })
      .mockReturnValueOnce(response.promise)
    const checks = useCloudWorkflowCheckStore()
    await checks.check()
    renderCloudButton()
    await openRunOnCloudDialog(() => true)
    const dialog = await screen.findByRole('dialog', { name: dialogName })
    const recheck = checks.check()

    expect(
      await within(dialog).findByRole('button', {
        name: 'Checking Comfy Cloud…'
      })
    ).toBeDisabled()
    const user = userEvent.setup()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    response.resolve({ kind: 'canOpen' })
    await recheck
  })

  it('shows the result of the confirmed check in the same dialog', async () => {
    const response = deferredVerdict()
    vi.mocked(checkCloudCompatibility).mockReturnValue(response.promise)
    renderCloudButton()
    const user = userEvent.setup()

    await user.click(screen.getByTestId('cloud-button'))
    const dialog = await screen.findByRole('dialog', {
      name: dialogName
    })
    await user.click(within(dialog).getByRole('button', { name: checkLabel }))

    expect(
      within(dialog).getByRole('button', { name: 'Checking Comfy Cloud…' })
    ).toBeDisabled()
    expect(openWorkflowOnCloud).not.toHaveBeenCalled()
    const model = { folder: 'checkpoints', name: 'missing.safetensors' }
    response.resolve({
      kind: 'missing',
      gaps: { models: [model], nodePacks: [] }
    })
    expect(await within(dialog).findByText(model.name)).toBeVisible()
    expect(openWorkflowOnCloud).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBe(dialog)
    expect(checkCloudCompatibility).toHaveBeenCalledOnce()
  })

  it("checks directly on the next Cloud click after Don't ask again", async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    renderCloudButton()
    const user = userEvent.setup()
    const settings = useSettingStore()

    await user.click(screen.getByTestId('cloud-button'))
    const consent = await screen.findByRole('dialog', { name: dialogName })
    await user.click(
      within(consent).getByRole('checkbox', { name: "Don't ask again" })
    )
    expect(checkCloudCompatibility).not.toHaveBeenCalled()
    expect(settings.get('Comfy.Cloud.AskBeforeCompatibilityCheck')).not.toBe(
      false
    )
    await user.click(within(consent).getByRole('button', { name: checkLabel }))
    await openCheckedWorkflow(user)

    expect(settings.get('Comfy.Cloud.AskBeforeCompatibilityCheck')).toBe(false)
    expect(checkCloudCompatibility).toHaveBeenCalledOnce()

    await user.click(screen.getByTestId('cloud-button'))
    const dialog = await screen.findByRole('dialog', { name: dialogName })

    expect(
      await within(dialog).findByRole('button', { name: openLabel })
    ).toBeVisible()
    expect(
      within(dialog).queryByRole('button', { name: checkLabel })
    ).toBeNull()
    expect(checkCloudCompatibility).toHaveBeenCalledTimes(2)
  })

  it("reports a failed save of Don't ask again", async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    const failure = new Error('offline')
    vi.mocked(api.storeSetting).mockRejectedValueOnce(failure)
    renderCloudButton()
    const user = userEvent.setup()

    await user.click(screen.getByTestId('cloud-button'))
    const consent = await screen.findByRole('dialog', { name: dialogName })
    await user.click(
      within(consent).getByRole('checkbox', { name: "Don't ask again" })
    )
    await user.click(within(consent).getByRole('button', { name: checkLabel }))

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        failure,
        expect.objectContaining({
          errorType: 'error_saving_cloud_check_consent'
        })
      )
    )
  })

  it("keeps asking when Don't ask again is left unchecked", async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    renderCloudButton()
    const user = userEvent.setup()

    await requestCloudCheck(user)
    await openCheckedWorkflow(user)
    await user.click(screen.getByTestId('cloud-button'))
    const dialog = await screen.findByRole('dialog', { name: dialogName })

    expect(
      within(dialog).getByRole('button', { name: checkLabel })
    ).toBeVisible()
    expect(
      useSettingStore().get('Comfy.Cloud.AskBeforeCompatibilityCheck')
    ).not.toBe(false)
    expect(checkCloudCompatibility).toHaveBeenCalledOnce()
  })

  it("stores nothing when the disclosure closes with Don't ask again ticked", async () => {
    renderCloudButton()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('cloud-button'))
    const dialog = await screen.findByRole('dialog', { name: dialogName })

    await user.click(
      within(dialog).getByRole('checkbox', { name: "Don't ask again" })
    )
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))

    expect(
      useSettingStore().get('Comfy.Cloud.AskBeforeCompatibilityCheck')
    ).not.toBe(false)
    expect(checkCloudCompatibility).not.toHaveBeenCalled()
  })

  it('asks again once the setting is turned back on', async () => {
    const settings = useSettingStore()
    await settings.set('Comfy.Cloud.AskBeforeCompatibilityCheck', false)
    await settings.set('Comfy.Cloud.AskBeforeCompatibilityCheck', true)
    renderCloudButton()
    const user = userEvent.setup()

    await user.click(screen.getByTestId('cloud-button'))
    const dialog = await screen.findByRole('dialog', { name: dialogName })

    expect(
      within(dialog).getByRole('button', { name: checkLabel })
    ).toBeVisible()
    expect(checkCloudCompatibility).not.toHaveBeenCalled()
  })

  it('dismisses the disclosure without sending a request', async () => {
    renderCloudButton()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('cloud-button'))
    const dialog = await screen.findByRole('dialog', {
      name: dialogName
    })

    await user.click(within(dialog).getByRole('button', { name: 'Close' }))

    expect(dialog).not.toBeInTheDocument()
    expect(checkCloudCompatibility).not.toHaveBeenCalled()
  })

  it('skips the handoff if the user closes the dialog during a check', async () => {
    const response = deferredVerdict()
    vi.mocked(checkCloudCompatibility).mockReturnValue(response.promise)
    renderCloudButton()
    const user = userEvent.setup()
    await requestCloudCheck(user)

    await user.click(screen.getByRole('button', { name: 'Close' }))
    response.resolve({ kind: 'canOpen' })
    await response.promise
    await nextTick()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(openWorkflowOnCloud).not.toHaveBeenCalled()
  })

  it('allows a fresh check after an edited workflow finishes uploading', async () => {
    const models = [{ folder: 'loras', name: 'upload.safetensors' }]
    vi.mocked(checkCloudCompatibility).mockResolvedValue({
      kind: 'missing',
      gaps: { models, nodePacks: [] }
    })
    renderCloudButton()
    const user = userEvent.setup()
    await requestCloudCheck(user)
    await screen.findByText(models[0].name)
    const dialog = screen.getByRole('dialog')
    const uploads = useLocalModelUploadStore()
    uploads.upload = {
      phase: 'uploading',
      sent: 0,
      total: 1,
      models,
      canCancel: true
    }
    await nextTick()

    api.dispatchCustomEvent('graphChanged', fromPartial({ nodes: [] }))
    await nextTick()
    expect(dialog).toBeVisible()
    uploads.upload = { phase: 'done' }

    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    await user.click(screen.getByTestId('cloud-button'))
    expect(
      await screen.findByRole('button', { name: checkLabel })
    ).toBeEnabled()
    expect(checkCloudCompatibility).toHaveBeenCalledOnce()
  })

  it('requires a new confirmation after the workflow is edited', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({
      kind: 'missing',
      gaps: {
        models: [{ folder: 'checkpoints', name: 'missing.safetensors' }],
        nodePacks: []
      }
    })
    renderCloudButton()
    const user = userEvent.setup()
    await requestCloudCheck(user)
    const result = await screen.findByTestId('missing-models-card')

    api.dispatchCustomEvent('graphChanged', fromPartial({ nodes: [] }))
    await waitFor(() => expect(result).not.toBeInTheDocument())
    await user.click(screen.getByTestId('cloud-button'))
    expect(checkCloudCompatibility).toHaveBeenCalledOnce()

    await user.click(await screen.findByRole('button', { name: checkLabel }))

    expect(await screen.findByTestId('missing-models-card')).toBeVisible()
    expect(checkCloudCompatibility).toHaveBeenCalledTimes(2)
  })

  it('ignores a pending answer for a workflow that is no longer active', async () => {
    const response = deferredVerdict()
    vi.mocked(checkCloudCompatibility).mockReturnValueOnce(response.promise)
    renderCloudButton()
    const user = userEvent.setup()
    const button = screen.getByTestId('cloud-button')
    await requestCloudCheck(user)

    useWorkflowStore().activeWorkflow = fromPartial({ filename: 'other.json' })
    await nextTick()
    expect(button).not.toHaveAttribute('aria-busy')
    response.resolve({ kind: 'canOpen' })
    await response.promise
    await nextTick()
    expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
      false
    )

    expect(openWorkflowOnCloud).not.toHaveBeenCalled()
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    await requestCloudCheck(user)
    await openCheckedWorkflow(user)
    expect(openWorkflowOnCloud).toHaveBeenCalledOnce()
    expect(checkCloudCompatibility).toHaveBeenCalledTimes(2)
  })

  it('requires a new confirmation after a failed check', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValueOnce(null)
    renderCloudButton()
    const user = userEvent.setup()
    await requestCloudCheck(user)
    await waitFor(() => expect(useToast().toasts).toHaveLength(1))

    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    await user.click(screen.getByTestId('cloud-button'))
    expect(checkCloudCompatibility).toHaveBeenCalledOnce()
    await user.click(await screen.findByRole('button', { name: checkLabel }))
    await openCheckedWorkflow(user)

    expect(openWorkflowOnCloud).toHaveBeenCalledOnce()
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
      name: 'says Comfy Cloud could not be reached',
      result: { kind: 'checkFailed', reason: 'unreachable' },
      message:
        'Could not reach Comfy Cloud. Check your internet connection, then try again.',
      properties: { reason: 'unreachable' }
    },
    {
      name: 'asks to wait a minute when Comfy Cloud is busy',
      result: { kind: 'checkFailed', reason: 'busy' },
      message: 'Comfy Cloud is busy right now. Try again in a minute.',
      properties: { reason: 'busy' }
    },
    {
      name: 'asks to sign in again when the workspace cannot be used',
      result: { kind: 'checkFailed', reason: 'workspace' },
      message:
        'Could not use your Comfy Cloud workspace. Sign out and back in, then try again.',
      properties: { reason: 'workspace' }
    },
    {
      name: 'names the limits when the workflow is too big',
      result: { kind: 'checkFailed', reason: 'tooBig' },
      message:
        'This workflow is too big to check on Comfy Cloud. It can have up to 2,000 node types and 500 models.',
      properties: { reason: 'too_big' }
    },
    {
      name: 'asks to update when the answer cannot be read',
      result: { kind: 'checkFailed', reason: 'outdated' },
      message:
        "This version of ComfyUI can't read Comfy Cloud's answer. Update ComfyUI, then try again.",
      properties: { reason: 'outdated' }
    },
    {
      name: 'asks to reload when the workflow cannot be read',
      result: { kind: 'checkFailed', reason: 'unreadable' },
      message:
        'Could not read this workflow to check it. Reload ComfyUI, then try again.',
      properties: { reason: 'unreadable' }
    }
  ])('$name', async ({ result, message, properties }) => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue(result)
    renderCloudButton()

    await requestCloudCheck(userEvent.setup())

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

  it('shows no toast, records the switch-off and then hides the button when Comfy Cloud has switched the check off', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({
      kind: 'checkFailed',
      reason: 'switchedOff'
    })
    renderCloudButtonHiddenWhenSwitchedOff()

    await requestCloudCheck(userEvent.setup())

    await waitFor(() =>
      expect(screen.queryByTestId('cloud-button')).not.toBeInTheDocument()
    )
    expect(useToast().toasts).toEqual([])
    expect(
      useTelemetry()?.trackRunOnCloudEvent
    ).toHaveBeenCalledExactlyOnceWith({
      name: 'app:run_on_cloud_check_failed',
      properties: { reason: 'switched_off' }
    })
  })

  it('shows the button again once the workspace changes after a switch-off', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({
      kind: 'checkFailed',
      reason: 'switchedOff'
    })
    renderCloudButtonHiddenWhenSwitchedOff()
    await requestCloudCheck(userEvent.setup())
    await waitFor(() =>
      expect(screen.queryByTestId('cloud-button')).not.toBeInTheDocument()
    )

    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-team' })

    expect(await screen.findByTestId('cloud-button')).toBeInTheDocument()
  })

  it('shows the button again once a later check gets an answer after a switch-off', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({
      kind: 'checkFailed',
      reason: 'switchedOff'
    })
    renderCloudButtonHiddenWhenSwitchedOff()
    await requestCloudCheck(userEvent.setup())
    await waitFor(() =>
      expect(screen.queryByTestId('cloud-button')).not.toBeInTheDocument()
    )

    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    await useCloudWorkflowCheckStore().check()

    expect(await screen.findByTestId('cloud-button')).toBeInTheDocument()
  })

  it('says nodes are missing and offers a Build when Cloud lacks a node pack', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({
      kind: 'missing',
      gaps: { nodePacks: ['ImpactWildcard'], models: [] }
    })
    renderCloudButton()
    const user = userEvent.setup()

    await requestCloudCheck(user)

    expect(
      await screen.findByText(
        /^Comfy Cloud doesn’t have some of the nodes this workflow uses\./
      )
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Deploy on Platform' })
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: openLabel })).toBeNull()
    expect(useToast().toasts).toEqual([])
  })

  it('closes the open dialog when the Cloud button unmounts', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    const { unmount } = renderCloudButton()
    const dialogs = useDialogStore()

    await userEvent.setup().click(screen.getByTestId('cloud-button'))
    await waitFor(() =>
      expect(dialogs.isDialogOpen('global-run-on-comfy-cloud')).toBe(true)
    )

    unmount()

    expect(dialogs.isDialogOpen('global-run-on-comfy-cloud')).toBe(false)
  })

  it('opens nothing when the button unmounts while the dialog loads', async () => {
    let resolveLoading!: () => void
    const loading = new Promise<void>((resolve) => {
      resolveLoading = resolve
    })
    let opening: Promise<boolean> | undefined
    vi.mocked(openRunOnCloudDialog).mockImplementationOnce(
      (isStillWanted, options) => {
        const pending = loading.then(() =>
          openRunOnCloudDialog(isStillWanted, options)
        )
        opening = pending
        return pending
      }
    )
    const { unmount } = renderCloudButton()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('cloud-button'))

    unmount()
    resolveLoading()

    await expect(opening).resolves.toBe(false)

    expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
      false
    )
  })
})
