import { capabilitiesWith } from './fixtures/scenario'
import { entryPath, expect, test } from './fixtures/test'

const SUBSCRIPTION = entryPath('subscription')

test('cancels after a confirmation step and then offers to resubscribe', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.reply('POST', '/billing/subscription/cancel', () => {
    cloud.scenario.capabilities = capabilitiesWith({
      can_cancel: false,
      can_reactivate: true
    })
    cloud.scenario.status = {
      ...cloud.scenario.status,
      subscription_status: 'canceled',
      cancel_at: '2026-10-24T12:00:00Z'
    }
    return {
      body: { billing_op_id: 'op_cancel', cancel_at: '2026-10-24T12:00:00Z' }
    }
  })
  await signIn(SUBSCRIPTION)

  await page.getByRole('button', { name: 'Cancel subscription' }).click()
  await expect(
    page.getByText('Cancel your subscription? You can resubscribe at any time.')
  ).toBeVisible()
  await expect(page.getByText(/^Ends on/)).toHaveCount(0)
  expect(
    cloud.requests.some((request) =>
      request.path.startsWith('/billing/subscription/')
    )
  ).toBe(false)

  await page.getByRole('button', { name: 'Confirm cancellation' }).click()

  await expect(page.getByText('Your subscription is cancelled.')).toBeVisible()
  await expect(page.getByText('Ends on Oct 24, 2026')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resubscribe' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Cancel subscription' })
  ).toHaveCount(0)
  expect(
    cloud.requests.some((request) => request.path === '/billing/ops/op_cancel')
  ).toBe(true)
})

test('shows only the actions the server allows', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.capabilities = capabilitiesWith({
    can_cancel: false,
    can_reactivate: false
  })
  await signIn(SUBSCRIPTION)

  await expect(page.getByText('Current plan: Creator · Monthly')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Choose/ })).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Cancel subscription' })
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Resubscribe' })).toHaveCount(0)
})
