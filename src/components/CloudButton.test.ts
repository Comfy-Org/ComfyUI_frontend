import { useTelemetry } from '@comfyorg/telemetry'
import userEvent from '@testing-library/user-event'
import { reportError } from '@comfyorg/telemetry/reportError'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { openRunOnCloudDialog } from '@/platform/openOnCloud/openRunOnCloudDialog'
import { checkCloudCompatibility } from '@/platform/openOnCloud/cloudCompatibilityApi'
import type {
  CloudWorkflowCheckResult,
  CloudWorkflowVerdict
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import CloudButton from '@/components/CloudButton.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
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
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/openOnCloud/cloudCompatibilityApi'))
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
    vi.mocked(api.storeSetting).mockResolvedValue(new Response())
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

    expect(useTelemetry()?.trackUiButtonClicked).toHaveBeenCalledWith({
      button_id: 'run_bar_cloud_clicked',
      element_group: 'top_menu'
    })

    const dialog = await screen.findByRole('dialog', {
      name: 'Run your workflows on Comfy Cloud'
    })
    expect(
      within(dialog).getByText(/Open this workflow on Comfy Cloud/)
    ).toBeVisible()
    expect(
      within(dialog).getByText(
        /Checking will send this workflow’s node and model names/
      )
    ).toBeVisible()
    expect(checkCloudCompatibility).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: checkLabel }))

    expect(await screen.findByTestId('run-on-cloud-card')).toBeVisible()
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

    await requestCloudCheck(user)

    expect(
      await screen.findByRole('dialog', {
        name: 'Run your workflows on Comfy Cloud'
      })
    ).toBeVisible()
  })

  it('shows the result of the confirmed check in the same dialog', async () => {
    const response = deferredVerdict()
    vi.mocked(checkCloudCompatibility).mockReturnValue(response.promise)
    renderCloudButton()
    const user = userEvent.setup()

    await user.click(screen.getByTestId('cloud-button'))
    const dialog = await screen.findByRole('dialog', {
      name: 'Run your workflows on Comfy Cloud'
    })
    await user.click(within(dialog).getByRole('button', { name: checkLabel }))

    expect(
      within(dialog).getByRole('button', { name: 'Checking Comfy Cloud…' })
    ).toBeDisabled()
    response.resolve({ kind: 'canOpen' })
    expect(
      await within(dialog).findByRole('button', { name: 'Open on Comfy Cloud' })
    ).toBeVisible()
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
      name: 'Run your workflows on Comfy Cloud'
    })

    await user.click(within(dialog).getByRole('button', { name: 'Close' }))

    expect(dialog).not.toBeInTheDocument()
    expect(checkCloudCompatibility).not.toHaveBeenCalled()
  })

  it('cancels the pending check when the confirmation dialog closes', async () => {
    const response = deferredVerdict()
    vi.mocked(checkCloudCompatibility).mockReturnValue(response.promise)
    renderCloudButton()
    const user = userEvent.setup()

    await requestCloudCheck(user)
    const signal = vi.mocked(checkCloudCompatibility).mock.lastCall?.[0]
    expect(signal?.aborted).toBe(false)
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' })
    )

    expect(signal?.aborted).toBe(true)
    response.resolve({ kind: 'canOpen' })
    await response.promise
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('requires a new confirmation after the workflow is edited', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    renderCloudButton()
    const user = userEvent.setup()
    await requestCloudCheck(user)
    const result = await screen.findByTestId('run-on-cloud-card')

    api.dispatchCustomEvent('graphChanged', fromPartial({ nodes: [] }))
    await waitFor(() => expect(result).not.toBeInTheDocument())
    await user.click(screen.getByTestId('cloud-button'))
    expect(checkCloudCompatibility).toHaveBeenCalledOnce()

    await user.click(await screen.findByRole('button', { name: checkLabel }))

    expect(await screen.findByTestId('run-on-cloud-card')).toBeVisible()
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

    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    await requestCloudCheck(user)
    await waitFor(() =>
      expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
        true
      )
    )
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

    expect(await screen.findByTestId('run-on-cloud-card')).toBeVisible()
    expect(checkCloudCompatibility).toHaveBeenCalledTimes(2)
  })

  it.for<{ name: string; result: CloudWorkflowCheckResult; message: string }>([
    {
      name: 'asks for nodes when the workflow has none to run',
      result: { kind: 'emptyWorkflow' },
      message:
        'This workflow has no nodes to run. Add nodes and save it, then try again.'
    },
    {
      name: 'names the missing model loader and explains how to continue',
      result: {
        kind: 'unreadableModelLoader',
        nodeType: 'ImpactCheckpointLoader'
      },
      message:
        'Could not read the model settings for ImpactCheckpointLoader. Install the node pack that provides it, then try again.'
    },
    {
      name: 'asks to try again when Comfy Cloud gives no answer',
      result: null,
      message: 'Could not check this workflow on Comfy Cloud. Try again.'
    }
  ])('$name', async ({ result, message }) => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue(result)
    renderCloudButton()

    await requestCloudCheck(userEvent.setup())

    await waitFor(() =>
      expect(useToast().toasts.map((toast) => toast.title)).toContain(message)
    )
  })

  it('opens the dialog when Cloud is missing nodes or models', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({
      kind: 'missing',
      gaps: { nodePacks: ['ImpactWildcard'], models: [] }
    })
    renderCloudButton()
    const user = userEvent.setup()

    await requestCloudCheck(user)

    await waitFor(() =>
      expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
        true
      )
    )
    expect(useToast().toasts).toEqual([])
  })

  it('closes the open dialog when the Cloud button unmounts', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    const { unmount } = renderCloudButton()
    const dialogs = useDialogStore()

    await requestCloudCheck(userEvent.setup())
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
