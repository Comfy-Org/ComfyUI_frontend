import { expect } from '@playwright/test'

import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { load3dTest as test } from '@e2e/fixtures/helpers/Load3DFixtures'

type Load3dImageInput = {
  image: string
  mask: string
  normal: string
  recording: string
}

type PromptBody = {
  prompt?: Record<
    string,
    { class_type?: string; inputs?: Record<string, unknown> }
  >
}

function getLoad3dImageInput(body: unknown, nodeId: string): Load3dImageInput {
  const prompt = (body as PromptBody).prompt ?? {}
  const node = prompt[nodeId]
  expect(node?.class_type, `node ${nodeId} should be Load3D`).toBe('Load3D')
  const input = node!.inputs!.image as Load3dImageInput
  expect(typeof input.image).toBe('string')
  expect(typeof input.recording).toBe('string')
  return input
}

test.describe('Load3D serialize cache', () => {
  test('starting a recording forces the next queue to re-capture (FE-905)', async ({
    comfyPage,
    load3d
  }) => {
    const exec = new ExecutionHelper(comfyPage)

    let firstBody: unknown
    await exec.run({
      onPromptRequest: (body) => {
        firstBody = body
      }
    })
    const firstInput = getLoad3dImageInput(firstBody, '1')
    expect(firstInput.recording).toBe('')

    await load3d.recordingButton.click()
    await expect(load3d.stopRecordingButton).toBeVisible()

    let secondBody: unknown
    await exec.run({
      onPromptRequest: (body) => {
        secondBody = body
      }
    })
    const secondInput = getLoad3dImageInput(secondBody, '1')

    expect(
      secondInput.image,
      'after starting a recording, the next queue must re-capture ' +
        '(image filename must change) so the recording is not dropped'
    ).not.toBe(firstInput.image)
  })
})
