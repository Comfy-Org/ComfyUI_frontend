import userEvent from '@testing-library/user-event'
import { useTelemetry } from '@comfyorg/telemetry'
import { render, screen, waitFor } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
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
    render(CloudButton, { global: { plugins: [testI18n] } })

    await userEvent.setup().click(screen.getByTestId('cloud-button'))

    await waitFor(() =>
      expect(useToast().toasts.map((toast) => toast.title)).toContain(message)
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
