import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { useTelemetry } from '@comfyorg/telemetry'
import { describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import CloudErrorAction from '@/platform/openOnCloud/components/CloudErrorAction.vue'
import { openDeploySetupDialog } from '@/platform/openOnCloud/openRunOnCloudDialog'
import { useDialogStore } from '@/stores/dialogStore'
import { testI18n } from '@/utils/__tests__/testI18n'

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/openOnCloud/openRunOnCloudDialog'), { spy: true })

await import('@/platform/openOnCloud/components/DeploySetupCard.vue')

describe('Cloud deployment from an out-of-memory error', () => {
  it('opens the deployment dialog from the memory-error action', async () => {
    vi.mocked(useFeatureFlags().flags).openOnCloudEnabled = true
    render(CloudErrorAction, {
      props: { catalogId: 'out_of_memory' },
      global: { plugins: [testI18n] }
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Deploy your setup to Comfy Cloud' })
    )

    await waitFor(() =>
      expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
        true
      )
    )
    expect(
      useTelemetry()?.trackUiButtonClicked
    ).toHaveBeenCalledExactlyOnceWith({
      button_id: 'error_tab_run_on_cloud_clicked',
      element_group: 'errors_panel'
    })
  })

  it('reports the deployment dialog as shown from the errors panel', async () => {
    vi.mocked(useFeatureFlags().flags).openOnCloudEnabled = true
    render(CloudErrorAction, {
      props: { catalogId: 'out_of_memory' },
      global: { plugins: [testI18n] }
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Deploy your setup to Comfy Cloud' })
    )

    await waitFor(() =>
      expect(
        useTelemetry()?.trackRunOnCloudEvent
      ).toHaveBeenCalledExactlyOnceWith({
        name: 'app:run_on_cloud_dialog_shown',
        properties: { state: 'deploy_setup', source: 'errors_panel' }
      })
    )
  })

  it('reports no dialog shown when the deployment dialog fails to load', async () => {
    let opening: Promise<boolean> | undefined
    vi.mocked(openDeploySetupDialog).mockImplementationOnce(() => {
      opening = Promise.resolve(false)
      return opening
    })
    vi.mocked(useFeatureFlags().flags).openOnCloudEnabled = true
    render(CloudErrorAction, {
      props: { catalogId: 'out_of_memory' },
      global: { plugins: [testI18n] }
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Deploy your setup to Comfy Cloud' })
    )
    await opening

    expect(useTelemetry()?.trackRunOnCloudEvent).not.toHaveBeenCalled()
  })

  it('reports one dialog shown when clicked again while the dialog is still loading', async () => {
    let finishOpening: (opened: boolean) => void = () => {}
    vi.mocked(openDeploySetupDialog).mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishOpening = resolve
        })
    )
    vi.mocked(useFeatureFlags().flags).openOnCloudEnabled = true
    render(CloudErrorAction, {
      props: { catalogId: 'out_of_memory' },
      global: { plugins: [testI18n] }
    })
    const action = screen.getByRole('button', {
      name: 'Deploy your setup to Comfy Cloud'
    })

    await userEvent.click(action)
    await userEvent.click(action)
    finishOpening(true)

    await waitFor(() =>
      expect(useTelemetry()?.trackRunOnCloudEvent).toHaveBeenCalledOnce()
    )
    expect(openDeploySetupDialog).toHaveBeenCalledOnce()
  })

  it('opens again after a failed load', async () => {
    vi.mocked(openDeploySetupDialog)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    vi.mocked(useFeatureFlags().flags).openOnCloudEnabled = true
    render(CloudErrorAction, {
      props: { catalogId: 'out_of_memory' },
      global: { plugins: [testI18n] }
    })
    const action = screen.getByRole('button', {
      name: 'Deploy your setup to Comfy Cloud'
    })

    await userEvent.click(action)
    await userEvent.click(action)

    await waitFor(() =>
      expect(useTelemetry()?.trackRunOnCloudEvent).toHaveBeenCalledOnce()
    )
    expect(openDeploySetupDialog).toHaveBeenCalledTimes(2)
  })

  it.for([
    { catalogId: 'out_of_memory', enabled: false },
    { catalogId: 'image_not_loaded', enabled: true }
  ])('does not offer deployment for $catalogId with gate $enabled', (row) => {
    vi.mocked(useFeatureFlags().flags).openOnCloudEnabled = row.enabled
    render(CloudErrorAction, {
      props: { catalogId: row.catalogId },
      global: { plugins: [testI18n] }
    })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
