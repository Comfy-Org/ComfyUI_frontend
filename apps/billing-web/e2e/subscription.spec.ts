import { capabilitiesWith } from './fixtures/scenario'
import { entryPath, expect, test } from './fixtures/test'

const SUBSCRIPTION = entryPath('subscription')

test('renders the catalog with the current plan marked and priced', async ({
  page,
  signIn
}) => {
  await signIn(SUBSCRIPTION)

  await expect(page.getByText('Current plan: Creator · Monthly')).toBeVisible()
  const creator = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Creator · Monthly' }) })
  await expect(creator.getByText('Current plan', { exact: true })).toBeVisible()
  await expect(creator.getByText('This is your current plan.')).toBeVisible()
  await expect(
    creator.getByRole('button', { name: 'Choose Creator · Monthly' })
  ).toBeDisabled()

  const pro = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Pro · Monthly' }) })
  await expect(pro.getByText('$50.00')).toBeVisible()
  await expect(pro.getByText('$100.00 in monthly credits')).toBeVisible()
  await expect(pro.getByText('1 seat')).toBeVisible()
})

test('choosing a plan quotes it from the server and continues to checkout', async ({
  page,
  cloud,
  signIn
}) => {
  await signIn(SUBSCRIPTION)

  await page.getByRole('button', { name: 'Choose Pro · Monthly' }).click()

  const quote = page.locator('section', {
    has: page.getByRole('heading', { name: 'Your plan change' })
  })
  await expect(quote.getByText('Upgrade')).toBeVisible()
  await expect(quote.getByText('$50.00').first()).toBeVisible()
  const preview = cloud.requests.find(
    (request) => request.path === '/billing/preview-subscribe'
  )
  expect(preview?.body).toStrictEqual({ plan_slug: 'pro_monthly' })

  await quote.getByRole('button', { name: 'Continue to checkout' }).click()

  await expect(page).toHaveURL(/\/v1\/checkout\?.*plan=pro_monthly/)
  await expect(
    page.getByRole('heading', { name: 'Confirm your payment' })
  ).toBeVisible()
  await expect(page.getByText('Pro · Monthly')).toBeVisible()
  await expect(page.getByText('Total due today')).toBeVisible()
  await expect(
    page.getByText("The payment form isn't available right now.", {
      exact: false
    })
  ).toBeVisible()
})

test('a checkout link naming a team credit stop quotes it along with the plan', async ({
  page,
  cloud,
  signIn
}) => {
  await signIn(
    entryPath('checkout', {
      plan: 'pro_monthly',
      team_credit_stop_id: 'stop_700'
    })
  )

  await expect(
    page.getByRole('heading', { name: 'Confirm your payment' })
  ).toBeVisible()
  const preview = cloud.requests.find(
    (request) => request.path === '/billing/preview-subscribe'
  )
  expect(preview?.body).toStrictEqual({
    plan_slug: 'pro_monthly',
    team_credit_stop_id: 'stop_700'
  })
})

test('a checkout link that names no plan sends the customer to choose one', async ({
  page,
  signIn
}) => {
  await signIn(entryPath('checkout'))

  await expect(
    page.getByRole('heading', { name: 'Choose a plan first' })
  ).toBeVisible()
  await page.getByRole('link', { name: 'See plans' }).click()

  await expect(page).toHaveURL(/\/v1\/subscription\?/)
  await expect(page.getByText('Current plan: Creator · Monthly')).toBeVisible()
})

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
  await expect(
    page.getByRole('button', { name: 'Cancel subscription' })
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Resubscribe' })).toHaveCount(0)
})
