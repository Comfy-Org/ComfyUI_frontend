import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

test('customer-story preview opens playback with sound and pauses when another video starts', async ({
  page
}) => {
  await page.goto('/solutions/vfx/')
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

for (const {
  path,
  heading,
  contact,
  cta,
  cleanplate,
  upscale,
  play,
  sound
} of [
  {
    path: '/solutions/vfx/',
    heading: 'VFX workflows. Built for your pipeline.',
    contact: '/contact/',
    cta: 'TALK TO COMFY TEAM',
    cleanplate: 'OBJECT REMOVAL',
    upscale: 'SHOT UPSCALING',
    play: 'Play',
    sound: /^(Mute|Unmute)$/
  },

  {
    path: '/zh-CN/solutions/vfx/',
    heading: '为制作流程而构建的 视觉特效工作流。',
    contact: '/zh-CN/contact/',
    cta: '联系 COMFY 团队',
    cleanplate: '物体移除',
    upscale: '镜头超分辨率',
    play: '播放',
    sound: /^(静音|取消静音)$/
  }
]) {
  test(`${path} proof and inquiry preserve campaign attribution`, async ({
    page
  }) => {
    await page.goto(`${path}?utm_source=linkedin&utm_campaign=vfx-review`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://comfy.org${path}`
    )
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
    const hero = page.getByTestId('vfx-proof-hero')
    await hero.getByRole('button', { name: play, exact: true }).click()
    await expect(hero.getByTestId('player-control-bar')).toBeVisible()
    await expect(hero.getByRole('button', { name: sound })).toHaveCount(0)
    await proof.getByRole('button', { name: upscale, exact: true }).click()
    await expect(
      page.getByTestId('vfx-proof-hero').getByRole('slider', {
        name: 'Utility Video Upscale image comparison'
      })
    ).toBeVisible()
    const sales = page.getByRole('link', { name: cta, exact: true }).first()
    await expect(sales).toHaveAttribute(
      'href',
      `${contact}?interest=vfx&landing_version=v2&utm_source=linkedin&utm_campaign=vfx-review`
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
        `${contact}\\?interest=vfx&landing_version=v2&utm_source=linkedin&utm_campaign=vfx-review$`
      )
    )
  })
}

for (const { path, heading, cta, href } of [
  {
    path: '/solutions/vfx/',
    heading: 'Build your custom workflows with our Forward Deployed Creatives',
    cta: 'LEARN MORE',
    href: '/forward-deployed-creatives/'
  },
  {
    path: '/zh-CN/solutions/vfx/',
    heading: '与前沿驻场创意人才一起构建你的定制工作流',
    cta: '了解更多',
    href: '/zh-CN/forward-deployed-creatives/'
  }
]) {
  test(`${path} links the Forward Deployed Creatives module below the studio section`, async ({
    page
  }) => {
    await page.goto(path)
    const module = page.locator('section').filter({
      has: page.getByRole('heading', { name: heading, exact: true })
    })
    await expect(
      module.getByRole('link', { name: cta, exact: true })
    ).toHaveAttribute('href', href)
  })
}
