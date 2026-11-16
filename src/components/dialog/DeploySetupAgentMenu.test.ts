import { fromPartial } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'

import { downloadBlob } from '@/base/common/downloadUtil'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import type { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { openDeploySetupDialog } from '@/platform/openOnCloud/openRunOnCloudDialog'
import { openAgentApp } from '@/platform/workflow/deploy/utils/agentApps'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useDialogStore } from '@/stores/dialogStore'
import type { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import DeploySetupAgentMenu from '@/platform/openOnCloud/components/DeploySetupAgentMenu.vue'
import { testI18n } from '@/utils/__tests__/testI18n'

const withConsent = vi.hoisted(() =>
  vi.fn<ReturnType<typeof useAgentConsent>['withConsent']>(
    async (_trigger, onAccept) => onAccept()
  )
)

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/base/common/downloadUtil'), () => ({
  downloadBlob: vi.fn()
}))
vi.mock(import('@/platform/workflow/deploy/utils/agentApps'), () => ({
  openAgentApp: vi.fn()
}))
vi.mock(import('@/composables/useCopyToClipboard'), () => ({
  useCopyToClipboard: () => ({ copyToClipboard })
}))
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

const copyToClipboard = vi.fn<
  ReturnType<typeof useCopyToClipboard>['copyToClipboard']
>(async () => true)

await import('@/platform/openOnCloud/components/DeploySetupCard.vue')

function renderMenu() {
  useWorkflowStore().activeWorkflow = fromPartial({
    path: 'workflows/portraits/upscale.json',
    isPersisted: true,
    isModified: false,
    changeTracker: { prepareForSave: vi.fn() }
  })
  render(DeploySetupAgentMenu, { global: { plugins: [testI18n] } })
  return userEvent.setup({ pointerEventsCheck: 0 })
}

async function pickRow(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByTestId('deploy-setup-agent'))
  await user.click(await screen.findByRole('menuitem', { name }))
}

describe('DeploySetupAgentMenu', () => {
  it.for([false, true])(
    'shows the local agent option when eligible: %s',
    async (enabled) => {
      useAgentPanelStore().enabled = enabled
      render(GlobalDialog, { global: { plugins: [testI18n] } })
      await openDeploySetupDialog()
      const user = userEvent.setup({ pointerEventsCheck: 0 })

      await user.click(await screen.findByTestId('deploy-setup-agent'))

      expect(
        screen.queryByRole('menuitem', { name: 'Use local agent' }) !== null
      ).toBe(enabled)
    }
  )

  it.for([false, true])(
    'prefills the local agent and dismisses the dialog without downloading when already open: %s',
    async (alreadyOpen) => {
      useWorkflowStore().activeWorkflow = fromPartial({
        path: 'workflows/portraits/upscale.json',
        isPersisted: true,
        isModified: false,
        changeTracker: { prepareForSave: vi.fn() }
      })
      const panel = useAgentPanelStore()
      panel.enabled = true
      panel.isOpen = alreadyOpen
      panel.view = {
        screen: 'history',
        previousThreadId: null,
        selection: { status: 'idle' }
      }
      render(GlobalDialog, { global: { plugins: [testI18n] } })
      await openDeploySetupDialog()
      const user = userEvent.setup({ pointerEventsCheck: 0 })

      await pickRow(user, 'Use local agent')

      await waitFor(() => expect(panel.isVisible).toBe(true))
      expect(panel.view).toEqual({ screen: 'chat' })
      expect(panel.pendingCloudHandoff).toContain(
        'Workflow: "workflows/portraits/upscale.json"'
      )
      expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
        false
      )
      expect(downloadBlob).not.toHaveBeenCalled()
      expect(openAgentApp).not.toHaveBeenCalled()
      expect(copyToClipboard).not.toHaveBeenCalled()
    }
  )

  it('keeps the deployment dialog when local agent consent is declined', async () => {
    useWorkflowStore().activeWorkflow = fromPartial({
      path: 'workflows/portraits/upscale.json',
      isPersisted: true,
      isModified: false,
      changeTracker: { prepareForSave: vi.fn() }
    })
    const panel = useAgentPanelStore()
    panel.enabled = true
    withConsent.mockResolvedValueOnce(undefined)
    render(GlobalDialog, { global: { plugins: [testI18n] } })
    await openDeploySetupDialog()
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await pickRow(user, 'Use local agent')

    expect(withConsent).toHaveBeenCalledOnce()
    expect(panel.pendingCloudHandoff).toBeNull()
    expect(panel.isVisible).toBe(false)
    expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
      true
    )
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('does not hand off after the local agent becomes unavailable during consent', async () => {
    useWorkflowStore().activeWorkflow = fromPartial({
      path: 'workflows/portraits/upscale.json',
      isPersisted: true,
      isModified: false,
      changeTracker: { prepareForSave: vi.fn() }
    })
    const panel = useAgentPanelStore()
    panel.enabled = true
    withConsent.mockImplementationOnce(async (_trigger, onAccept) => {
      panel.enabled = false
      onAccept()
    })
    render(GlobalDialog, { global: { plugins: [testI18n] } })
    await openDeploySetupDialog()
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await pickRow(user, 'Use local agent')

    expect(panel.isOpen).toBe(false)
    expect(panel.pendingCloudHandoff).toBeNull()
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('cancels pending local agent consent when the deployment dialog closes', async () => {
    useWorkflowStore().activeWorkflow = fromPartial({
      path: 'workflows/portraits/upscale.json',
      isPersisted: true,
      isModified: false,
      changeTracker: { prepareForSave: vi.fn() }
    })
    const panel = useAgentPanelStore()
    panel.enabled = true
    let finishConsentRead!: () => void
    const consentRead = new Promise<void>((resolve) => {
      finishConsentRead = resolve
    })
    const canShowConsent = vi.fn<(canShow: boolean | undefined) => void>()
    withConsent.mockImplementationOnce(async (_trigger, onAccept, hooks) => {
      await consentRead
      canShowConsent(hooks?.canShow?.())
      onAccept()
    })
    render(GlobalDialog, { global: { plugins: [testI18n] } })
    await openDeploySetupDialog()
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    await pickRow(user, 'Use local agent')

    useDialogStore().closeDialog({ key: 'global-run-on-comfy-cloud' })
    await nextTick()
    finishConsentRead()

    await waitFor(() => expect(canShowConsent).toHaveBeenCalledWith(false))
    expect(panel.isOpen).toBe(false)
    expect(panel.pendingCloudHandoff).toBeNull()
  })

  it('offers external agents when no local agent is provided', async () => {
    const user = renderMenu()

    await user.click(screen.getByTestId('deploy-setup-agent'))

    expect(
      (await screen.findAllByRole('menuitem')).map((row) =>
        row.textContent.trim()
      )
    ).toEqual(['Open in Claude desktop', 'Open in Codex', 'Copy prompt'])
  })

  it.for([
    { row: 'Open in Claude desktop', app: 'claude' },
    { row: 'Open in Codex', app: 'codex' }
  ])('$row opens the brief in that app', async ({ row, app }) => {
    const user = renderMenu()

    await pickRow(user, row)

    expect(openAgentApp).toHaveBeenCalledExactlyOnceWith(
      app,
      expect.stringContaining('Workflow: "workflows/portraits/upscale.json"')
    )
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('says Copied after Copy prompt, and shows its label again when the menu reopens', async () => {
    const user = renderMenu()
    const button = screen.getByTestId('deploy-setup-agent')

    await pickRow(user, 'Copy prompt')
    expect(button).toHaveTextContent(/^Copied/)
    expect(copyToClipboard).toHaveBeenCalledWith(
      expect.stringContaining('Workflow: "workflows/portraits/upscale.json"'),
      { toastOnSuccess: false }
    )
    expect(downloadBlob).not.toHaveBeenCalled()

    await user.click(button)
    expect(button).toHaveTextContent('Deploy with your agent')
  })

  it('keeps its label when the brief did not reach the clipboard', async () => {
    copyToClipboard.mockResolvedValueOnce(false)
    const user = renderMenu()

    await pickRow(user, 'Copy prompt')

    expect(screen.getByTestId('deploy-setup-agent')).toHaveTextContent(
      'Deploy with your agent'
    )
  })
})
