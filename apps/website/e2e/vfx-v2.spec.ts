import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

test('customer-story preview opens playback with sound and pauses when another video starts', async ({
  page
}) => {
  await page.goto('/vfx/v2/')
  const story = page.locator('section').filter({
    has: page.getByRole('heading', {
      name: 'Inside Black Math’s creative systems',
      exact: true
    })
  })
  const storyVideo = story.getByLabel('Inside Black Math’s creative systems', {
    exact: true
  })
  await waitForIsland(page, storyVideo)
  await expect(
    story.getByRole('button', { name: 'Play', exact: true })
  ).toBeVisible()
  await expect(story.getByTestId('player-control-bar')).toHaveCount(0)
  await expect
    .poll(() => storyVideo.evaluate((video: HTMLVideoElement) => video.muted))
    .toBe(true)

  await story.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(story.getByTestId('player-control-bar')).toBeVisible()
  await expect(
    story.getByRole('button', { name: 'Mute', exact: true })
  ).toBeVisible()
  await expect
    .poll(() => storyVideo.evaluate((video: HTMLVideoElement) => video.paused))
    .toBe(false)

  const tutorials = page.locator('section').filter({
    has: page.getByRole('heading', {
      name: 'Replace the sky. Keep the shot.',
      exact: true
    })
  })
  const tutorialPlay = tutorials
    .getByRole('button', { name: 'Play', exact: true })
    .first()
  await waitForIsland(page, tutorialPlay)
  await tutorialPlay.click()
  await expect
    .poll(() => storyVideo.evaluate((video: HTMLVideoElement) => video.paused))
    .toBe(true)
})

for (const { path, heading, contact, cta, agency, cleanplate, upscale } of [
  {
    path: '/vfx/v2/',
    heading: 'VFX workflows. Built for your pipeline.',
    contact: '/contact/',
    cta: 'TALK TO COMFY',
    agency: false,
    cleanplate: 'OBJECT REMOVAL',
    upscale: 'SHOT UPSCALING'
  },
  {
    path: '/agency-led/vfx/v2/',
    heading: 'Bring your VFX brief. Find your production partner.',
    contact: '/contact/',
    cta: 'DISCUSS YOUR PROJECT',
    agency: true,
    cleanplate: 'OBJECT REMOVAL',
    upscale: 'SHOT UPSCALING'
  },
  {
    path: '/zh-CN/vfx/v2/',
    heading: '为制作流程而构建的 视觉特效工作流。',
    contact: '/zh-CN/contact/',
    cta: '联系 COMFY',
    agency: false,
    cleanplate: '物体移除',
    upscale: '镜头超分辨率'
  },
  {
    path: '/zh-CN/agency-led/vfx/v2/',
    heading: '带来特效项目需求。 寻找制作合作伙伴。',
    contact: '/zh-CN/contact/',
    cta: '讨论项目需求',
    agency: true,
    cleanplate: '物体移除',
    upscale: '镜头超分辨率'
  }
]) {
  test(`${path} proof and inquiry preserve campaign attribution`, async ({
    page
  }) => {
    await page.goto(`${path}?utm_source=linkedin&utm_campaign=vfx-review`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' })
    ).toBeVisible()
    const proof = page.locator('[data-vfx-v2]').getByRole('group').first()
    await proof.getByRole('button', { name: cleanplate, exact: true }).click()
    await expect(
      proof.getByRole('button', { name: cleanplate, exact: true })
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-vfx-v2] video').first()).toHaveAttribute(
      'src',
      'https://media.comfy.org/hub-media/video/8a3a846f-5017-428e-b2a2-24025c55e884.mp4'
    )
    await proof.getByRole('button', { name: upscale, exact: true }).click()
    await expect(
      page.getByTestId('vfx-proof-hero').getByRole('slider', {
        name: 'Utility Video Upscale image comparison'
      })
    ).toBeVisible()
    const sales = page.getByRole('link', { name: cta, exact: true }).first()
    await expect(sales).toHaveAttribute(
      'href',
      `${contact}?interest=vfx${agency ? '&campaign_type=agency-led' : ''}&landing_version=v2&utm_source=linkedin&utm_campaign=vfx-review`
    )
    await sales.click()
    await expect(page.getByTestId('hubspot-form-embed')).toHaveAttribute(
      'data-form-id',
      contact.startsWith('/zh-CN')
        ? '6885750c-02ef-4aa2-ba0d-213be9cccf93'
        : '94e05eab-1373-47f7-ab5e-d84f9e6aa262'
    )
    await expect(page).toHaveURL(
      new RegExp(
        `${contact}\\?interest=vfx${agency ? '&campaign_type=agency-led' : ''}&landing_version=v2&utm_source=linkedin&utm_campaign=vfx-review$`
      )
    )
  })
}
