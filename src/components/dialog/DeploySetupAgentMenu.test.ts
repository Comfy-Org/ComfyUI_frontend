import { fromPartial } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
import { useTelemetry } from '@comfyorg/telemetry'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

import { downloadBlob } from '@/base/common/downloadUtil'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import type { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { openDeploySetupDialog } from '@/platform/openOnCloud/openRunOnCloudDialog'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { openAgentApp } from '@/platform/workflow/deploy/utils/agentApps'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useToast } from '@/components/ui/toast/toastStore'
import type { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import DeploySetupAgentMenu from '@/platform/openOnCloud/components/DeploySetupAgentMenu.vue'
import { testI18n } from '@/utils/__tests__/testI18n'

const withConsent = vi.hoisted(() =>
  vi.fn<ReturnType<typeof useAgentConsent>['withConsent']>(
    async (_trigger, onAccept) => onAccept()
  )
)

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))
vi.mock(import('@/base/common/downloadUtil'), () => ({
  downloadBlob: vi.fn()
}))
vi.mock(import('@/platform/workflow/deploy/utils/agentApps'), () => ({
  openAgentApp: vi.fn()
}))
vi.mock(import('@/composables/useCopyToClipboard'), () => ({
  useCopyToClipboard: () => ({ copied: ref(false), copyToClipboard })
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
  it.for([
    { flag: false, enabled: true, visible: false },
    { flag: true, enabled: false, visible: false },
    { flag: true, enabled: true, visible: true }
  ])(
    'shows the local agent option when flag=$flag and available=$enabled: $visible',
    async ({ flag, enabled, visible }) => {
      Object.assign(useFeatureFlags().flags, {
        openOnCloudUseLocalAgentEnabled: flag
      })
      useAgentPanelStore().enabled = enabled
      render(GlobalDialog, { global: { plugins: [testI18n] } })
      await openDeploySetupDialog()
      const user = userEvent.setup({ pointerEventsCheck: 0 })

      await user.click(await screen.findByTestId('deploy-setup-agent'))

      expect(
        screen.queryByRole('menuitem', { name: 'Use local agent' }) !== null
      ).toBe(visible)
    }
  )

  it.for([false, true])(
    'prefills the local agent and dismisses the dialog without downloading when already open: %s',
    async (alreadyOpen) => {
      Object.assign(useFeatureFlags().flags, {
        openOnCloudUseLocalAgentEnabled: true
      })
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
      expect(
        vi.mocked(useTelemetry()?.trackUiButtonClicked)?.mock.calls
      ).toEqual([
        [
          {
            button_id: 'run_on_cloud_agent_menu_opened',
            element_group: 'run_on_cloud'
          }
        ],
        [
          {
            button_id: 'run_on_cloud_use_local_agent_clicked',
            element_group: 'run_on_cloud'
          }
        ]
      ])
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
    Object.assign(useFeatureFlags().flags, {
      openOnCloudUseLocalAgentEnabled: true
    })
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

  it.for([
    {
      change: 'agent becomes unavailable',
      applyChange: () => {
        useAgentPanelStore().enabled = false
      },
      opens: false,
      handoff: null
    },
    {
      change: 'rollout flag is disabled',
      applyChange: () => {
        Object.assign(useFeatureFlags().flags, {
          openOnCloudUseLocalAgentEnabled: false
        })
      },
      opens: true,
      handoff: expect.stringContaining(
        'Workflow: "workflows/portraits/upscale.json"'
      )
    }
  ])(
    'opens=$opens when $change during consent',
    async ({ applyChange, opens, handoff }) => {
      Object.assign(useFeatureFlags().flags, {
        openOnCloudUseLocalAgentEnabled: true
      })
      useWorkflowStore().activeWorkflow = fromPartial({
        path: 'workflows/portraits/upscale.json',
        isPersisted: true,
        isModified: false,
        changeTracker: { prepareForSave: vi.fn() }
      })
      const panel = useAgentPanelStore()
      panel.enabled = true
      withConsent.mockImplementationOnce(async (_trigger, onAccept) => {
        applyChange()
        onAccept()
      })
      render(GlobalDialog, { global: { plugins: [testI18n] } })
      await openDeploySetupDialog()
      const user = userEvent.setup({ pointerEventsCheck: 0 })

      await pickRow(user, 'Use local agent')

      expect(panel.isOpen).toBe(opens)
      expect(panel.pendingCloudHandoff).toEqual(handoff)
      expect(downloadBlob).not.toHaveBeenCalled()
    }
  )

  it('cancels pending local agent consent when the deployment dialog closes', async () => {
    Object.assign(useFeatureFlags().flags, {
      openOnCloudUseLocalAgentEnabled: true
    })
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
    {
      row: 'Open in Claude desktop',
      buttonId: 'run_on_cloud_open_in_claude_clicked'
    },
    { row: 'Open in Codex', buttonId: 'run_on_cloud_open_in_codex_clicked' },
    { row: 'Copy prompt', buttonId: 'run_on_cloud_copy_prompt_clicked' }
  ])('reports $row after the menu opens', async ({ row, buttonId }) => {
    const user = renderMenu()

    await pickRow(user, row)

    expect(vi.mocked(useTelemetry()?.trackUiButtonClicked)?.mock.calls).toEqual(
      [
        [
          {
            button_id: 'run_on_cloud_agent_menu_opened',
            element_group: 'run_on_cloud'
          }
        ],
        [{ button_id: buttonId, element_group: 'run_on_cloud' }]
      ]
    )
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

  it.for([
    { gesture: 'click', keys: '[MouseLeft]', closes: true },
    { gesture: 'middle-click', keys: '[MouseMiddle]', closes: false }
  ])('reports Deploy on Platform on $gesture', async ({ keys, closes }) => {
    render(GlobalDialog, { global: { plugins: [testI18n] } })
    await openDeploySetupDialog()
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const link = await screen.findByRole('link', {
      name: 'Deploy on Platform'
    })
    link.addEventListener('click', (event) => event.preventDefault())

    await user.pointer({ keys, target: link })

    expect(
      useTelemetry()?.trackUiButtonClicked
    ).toHaveBeenCalledExactlyOnceWith({
      button_id: 'run_on_cloud_platform_clicked',
      element_group: 'run_on_cloud'
    })
    expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
      !closes
    )
  })

  function mockPlatformTab() {
    const tabDocument = document.implementation.createHTMLDocument()
    const destination = vi.fn<(link: HTMLAnchorElement) => void>()
    tabDocument.body.addEventListener('click', (event) => {
      event.preventDefault()
      if (event.target instanceof HTMLAnchorElement) destination(event.target)
    })
    const tab = fromPartial<Window>({ opener: window, document: tabDocument })
    const open = vi.spyOn(window, 'open').mockReturnValue(tab)
    return { tab, open, destination }
  }

  async function clickPlatformForNewWorkflow() {
    const workflow = fromPartial<LoadedComfyWorkflow>({
      path: 'workflows/Unsaved Workflow.json',
      isPersisted: false,
      isModified: true
    })
    useWorkflowStore().activeWorkflow = workflow
    const platformTab = mockPlatformTab()
    render(GlobalDialog, { global: { plugins: [testI18n] } })
    await openDeploySetupDialog()
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const link = await screen.findByRole('link', {
      name: 'Deploy on Platform'
    })
    const navigated = vi.fn<(prevented: boolean) => void>()
    link.addEventListener('click', (event) => {
      navigated(event.defaultPrevented)
      event.preventDefault()
    })
    await user.click(link)
    return { workflow, ...platformTab, link, navigated }
  }

  it('saves a new workflow, then opens Deploy on Platform', async () => {
    vi.mocked(useWorkflowService().saveWorkflow).mockImplementation(
      async (saved) => {
        Object.assign(saved, { isPersisted: true, isModified: false })
        return true
      }
    )

    const { workflow, tab, open, destination, link, navigated } =
      await clickPlatformForNewWorkflow()

    expect(navigated).toHaveBeenCalledExactlyOnceWith(true)
    expect(useWorkflowService().saveWorkflow).toHaveBeenCalledExactlyOnceWith(
      workflow
    )
    await waitFor(() =>
      expect(open).toHaveBeenCalledExactlyOnceWith('', '_blank')
    )
    expect(tab.opener).toBeNull()
    expect(destination).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        href: link.getAttribute('href'),
        rel: link.getAttribute('rel')
      })
    )
    expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
      false
    )
  })

  it('opens nothing when saving before Deploy on Platform is cancelled', async () => {
    vi.mocked(useWorkflowService().saveWorkflow).mockResolvedValue(false)

    const { workflow, open, navigated } = await clickPlatformForNewWorkflow()

    expect(navigated).toHaveBeenCalledExactlyOnceWith(true)
    await waitFor(() =>
      expect(useWorkflowService().saveWorkflow).toHaveBeenCalledExactlyOnceWith(
        workflow
      )
    )
    expect(open).not.toHaveBeenCalled()
    expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
      true
    )
  })

  it('opens the saved Platform destination in the Desktop system browser', async () => {
    vi.stubGlobal('__comfyDesktop2', {})
    vi.mocked(useWorkflowService().saveWorkflow).mockImplementation(
      async (workflow) => {
        Object.assign(workflow, { isPersisted: true, isModified: false })
        return true
      }
    )

    const { open, link } = await clickPlatformForNewWorkflow()

    await waitFor(() =>
      expect(open).toHaveBeenCalledExactlyOnceWith(
        link.getAttribute('href'),
        '_blank',
        'noopener,noreferrer'
      )
    )
    expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
      false
    )
  })

  it('keeps the dialog open when the browser blocks the Platform tab', async () => {
    useWorkflowStore().activeWorkflow = fromPartial({
      path: 'workflows/portraits/upscale.json',
      isPersisted: true,
      isModified: true
    })
    vi.mocked(useWorkflowService().saveWorkflow).mockImplementation(
      async (saved) => {
        Object.assign(saved, { isModified: false })
        return true
      }
    )
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(GlobalDialog, { global: { plugins: [testI18n] } })
    await openDeploySetupDialog()
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.click(
      await screen.findByRole('link', { name: 'Deploy on Platform' })
    )

    await waitFor(() => expect(open).toHaveBeenCalledOnce())
    expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
      true
    )
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'info',
        title: 'Workflow saved. Click Deploy on Platform again to continue.'
      })
    ])
  })

  it('saves before a middle-click opens Deploy on Platform', async () => {
    useWorkflowStore().activeWorkflow = fromPartial({
      path: 'workflows/portraits/upscale.json',
      isPersisted: true,
      isModified: true
    })
    vi.mocked(useWorkflowService().saveWorkflow).mockImplementation(
      async (saved) => {
        Object.assign(saved, { isModified: false })
        return true
      }
    )
    const { open } = mockPlatformTab()
    render(GlobalDialog, { global: { plugins: [testI18n] } })
    await openDeploySetupDialog()
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await user.pointer({
      keys: '[MouseMiddle]',
      target: await screen.findByRole('link', { name: 'Deploy on Platform' })
    })

    await waitFor(() => expect(open).toHaveBeenCalledOnce())
    expect(useWorkflowService().saveWorkflow).toHaveBeenCalledOnce()
    expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
      true
    )
  })

  it('saves a modified workflow before opening it in an agent', async () => {
    const workflow = fromPartial<LoadedComfyWorkflow>({
      path: 'workflows/portraits/upscale.json',
      isPersisted: true,
      isModified: true,
      changeTracker: { prepareForSave: vi.fn() }
    })
    useWorkflowStore().activeWorkflow = workflow
    vi.mocked(useWorkflowService().saveWorkflow).mockImplementation(
      async (saved) => {
        Object.assign(saved, { isModified: false })
        return true
      }
    )
    render(DeploySetupAgentMenu, { global: { plugins: [testI18n] } })
    const user = userEvent.setup({ pointerEventsCheck: 0 })

    await pickRow(user, 'Open in Codex')

    await waitFor(() =>
      expect(openAgentApp).toHaveBeenCalledExactlyOnceWith(
        'codex',
        expect.stringContaining('Workflow: "workflows/portraits/upscale.json"')
      )
    )
    expect(useWorkflowService().saveWorkflow).toHaveBeenCalledExactlyOnceWith(
      workflow
    )
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
