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
    expect(openWorkflowOnCloud).toHaveBeenCalledWith(undefined, undefined)
    expect(onDone).toHaveBeenCalledOnce()
    expect(
      useTelemetry()?.trackUiButtonClicked
    ).toHaveBeenCalledExactlyOnceWith({
      button_id: 'run_on_cloud_open_on_cloud_clicked',
      element_group: 'run_on_cloud'
    })
  })

  it('asks to check before anything opens, and says what the check sends', async () => {
    const onCheck = vi.fn()
    render(RunOnCloudCard, {
      props: { asksToSignIn: false, needsConsent: true, onCheck },
      global: { plugins: [testI18n] }
    })

    expect(
      screen.getByText(
        'Checking will send this workflow’s node and model names to Comfy Cloud.'
      )
    ).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', { name: 'Check compatibility' })
    )

    expect(onCheck).toHaveBeenCalledOnce()
    expect(openWorkflowOnCloud).not.toHaveBeenCalled()
  })

  it('waits on a disabled button while Comfy Cloud checks', () => {
    render(RunOnCloudCard, {
      props: { asksToSignIn: false, needsConsent: true, checking: true },
      global: { plugins: [testI18n] }
    })

    expect(
      screen.getByRole('button', { name: 'Checking Comfy Cloud…' })
    ).toBeDisabled()
  })

  it('names each linked model input Comfy Cloud could not check', () => {
    render(RunOnCloudCard, {
      props: {
        asksToSignIn: false,
        uncheckedInputs: [
          { nodeType: 'CheckpointLoaderSimple', input: 'ckpt_name' },
          { nodeType: 'LoraLoader', input: 'lora_name' }
        ]
      },
      global: { plugins: [testI18n] }
    })

    expect(
      screen.getByText(
        'Comfy Cloud has every node and model it could check. It could not check the models for these inputs: ckpt_name on CheckpointLoaderSimple, lora_name on LoraLoader. It opens in a new tab.'
      )
    ).toBeVisible()
  })

  it('hands off to the workspace confirmed by Cloud compatibility', async () => {
    render(RunOnCloudCard, {
      props: { asksToSignIn: false, workspaceId: 'ws-confirmed' },
      global: { plugins: [testI18n] }
    })

    await userEvent.click(screen.getByTestId('run-on-cloud-primary'))

    expect(openWorkflowOnCloud).toHaveBeenCalledExactlyOnceWith(
      undefined,
      'ws-confirmed'
    )
  })
})
