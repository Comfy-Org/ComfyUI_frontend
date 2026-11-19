import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { useTelemetry } from '@comfyorg/telemetry'
import { describe, expect, it, vi } from 'vitest'

import RunOnCloudCard from '@/platform/openOnCloud/components/RunOnCloudCard.vue'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
import { testI18n } from '@/utils/__tests__/testI18n'

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/openOnCloud/openWorkflowOnCloud'), () => ({
  openWorkflowOnCloud: vi.fn(async () => {})
}))

describe('RunOnCloudCard', () => {
  it('reports Open on Cloud and opens the workflow', async () => {
    const onDone = vi.fn()
    render(RunOnCloudCard, {
      props: { asksToSignIn: false, onDone },
      global: { plugins: [testI18n] }
    })

    await userEvent.click(screen.getByTestId('run-on-cloud-primary'))

    expect(openWorkflowOnCloud).toHaveBeenCalledOnce()
    expect(onDone).toHaveBeenCalledOnce()
    expect(
      useTelemetry()?.trackUiButtonClicked
    ).toHaveBeenCalledExactlyOnceWith({
      button_id: 'run_on_cloud_open_on_cloud_clicked',
      element_group: 'run_on_cloud'
    })
  })
})
