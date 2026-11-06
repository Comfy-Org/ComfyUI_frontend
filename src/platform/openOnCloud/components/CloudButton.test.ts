import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { checkCloudCompatibility } from '@/platform/openOnCloud/cloudCompatibilityApi'
import type { CloudWorkflowVerdict } from '@/platform/openOnCloud/cloudWorkflowCheck'
import CloudButton from '@/platform/openOnCloud/components/CloudButton.vue'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useDialogStore } from '@/stores/dialogStore'
import { testI18n } from '@/utils/__tests__/testI18n'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/openOnCloud/cloudCompatibilityApi'))

await import('@/platform/openOnCloud/components/RunOnCloudDialog.vue')

function deferredVerdict() {
  let resolve!: (verdict: CloudWorkflowVerdict) => void
  const promise = new Promise<CloudWorkflowVerdict>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('Cloud button compatibility checks', () => {
  it('opens the completed hover result without requesting it again', async () => {
    vi.mocked(checkCloudCompatibility).mockResolvedValue({ kind: 'canOpen' })
    render(CloudButton, { global: { plugins: [testI18n] } })
    const user = userEvent.setup()
    const button = screen.getByTestId('cloud-button')

    await user.hover(button)
    await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'))
    await user.click(button)

    await waitFor(() =>
      expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
        true
      )
    )
    expect(checkCloudCompatibility).toHaveBeenCalledOnce()
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
})
