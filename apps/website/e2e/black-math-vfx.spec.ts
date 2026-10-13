import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

for (const { path, heading, cta, contact } of [
  {
    path: '/agency-led/vfx/black-math/',
    heading: 'Bring your VFX brief. Explore Black Math’s approach.',
    cta: 'DISCUSS YOUR PROJECT',
    contact: '/contact/'
  },
  {
    path: '/zh-CN/agency-led/vfx/black-math/',
    heading: '告诉我们你的特效项目需求。 探索 Black Math 的创作方式。',
    cta: '讨论项目需求',
    contact: '/zh-CN/contact/'
  }
]) {
  test(`${path} opens a localized Black Math inquiry with ad attribution`, async ({
    page
  }) => {
    await page.goto(
      `${path}?utm_source=linkedin&utm_campaign=black-math-review`
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
    const inquiry = page.getByRole('link', { name: cta, exact: true }).first()
    await expect(inquiry).toHaveAttribute(
      'href',
      `${contact}?interest=vfx&campaign_type=agency-led&landing_version=v2&agency_partner=black-math&utm_source=linkedin&utm_campaign=black-math-review`
    )
    await inquiry.click()
    await expect(page).toHaveURL(
      `${contact}?interest=vfx&campaign_type=agency-led&landing_version=v2&agency_partner=black-math&utm_source=linkedin&utm_campaign=black-math-review`
    )
  })
}

test('Black Math hero opens working playback controls from its muted preview', async ({
  page
}) => {
  await page.goto('/agency-led/vfx/black-math/')
  const film = page.getByLabel('Inside Black Math’s creative systems', {
    exact: true
  })
  await waitForIsland(page, film)
  await expect(page.getByTestId('player-control-bar')).toHaveCount(0)
  await expect
    .poll(() => film.evaluate((video: HTMLVideoElement) => video.muted))
    .toBe(true)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const controls = page.getByTestId('player-control-bar')
  await expect(controls).toBeVisible()
  await expect(
    controls.getByRole('button', { name: 'Mute', exact: true })
  ).toBeVisible()
  await controls.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect
    .poll(() => film.evaluate((video: HTMLVideoElement) => video.paused))
    .toBe(true)
  await controls.getByRole('button', { name: 'Play', exact: true }).click()
  await expect
    .poll(() => film.evaluate((video: HTMLVideoElement) => video.paused))
    .toBe(false)
})
