import { succeededOperation } from './fixtures/scenario'
import { entryPath, expect, test } from './fixtures/test'

const RESULT = entryPath('result')

test('recovers the operation the server says is pending and reports it on the way back', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.status = {
    ...cloud.scenario.status,
    pending_billing_op_id: 'op_1',
    pending_billing_op_type: 'subscription'
  }
  cloud.scenario.operations.op_1 = succeededOperation('op_1')

  await signIn(RESULT)

  await expect(
    page.getByRole('region', { name: 'Payment complete' })
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Return to ComfyUI' })
  ).toHaveAttribute(
    'href',
    'https://testcloud.comfy.org/?workspace=ws_e2e&billing_result=success&billing_ref=op_1'
  )
  expect(
    cloud.requests.some((request) => request.path === '/billing/ops/op_1')
  ).toBe(true)
})

test('says so when nothing is pending for the workspace', async ({
  page,
  signIn
}) => {
  await signIn(RESULT)

  await expect(
    page.getByText('There is no payment in progress for this workspace.')
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Return to ComfyUI' })
  ).toHaveAttribute(
    'href',
    'https://testcloud.comfy.org/?workspace=ws_e2e&billing_result=pending'
  )
})
