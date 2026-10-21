import assert from 'node:assert/strict'
import { join } from 'node:path'

import { websiteRoot } from '@website/paths'

import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { expectIslandHydrated } from './fixtures/islands'

import { vfxWorkflows } from '@/data/vfxWorkflows'
import { DEFAULT_OG_IMAGE } from '@/utils/jsonLd'
import { vfxRedSkyMedia, vfxMediaRoot } from '@/data/vfxMedia'

test.beforeEach(async ({ context }) => {
  await context.route(vfxRedSkyMedia.video, (route) =>
    route.fulfill({
      path: join(websiteRoot, 'e2e/assets/vfx-playback.mp4'),
      headers: { 'Accept-Ranges': 'bytes', 'Content-Type': 'video/mp4' }
    })
  )
  await context.route(`${vfxMediaRoot}/*.mp4`, (route) =>
    route.fulfill({
      path: join(websiteRoot, 'e2e/assets/vfx-playback.mp4'),
      headers: { 'Accept-Ranges': 'bytes', 'Content-Type': 'video/mp4' }
    })
  )
})

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    )
    .toBe(true)
}

async function waitForShowcase(section: Locator) {
  await section.locator('.vfx-canvas-window').evaluate((node) => {
    node.scrollIntoView({ block: 'start', behavior: 'instant' })
  })
  await expect(section).toHaveAttribute('data-canvas-ready', '', {
    timeout: 12_000
  })
}

for (const {
  path,
  heading,
  sales,
  contact,
  rain,
  taxi,
  vertical,
  shareAlt
} of [
  {
    path: '/solutions/vfx/v3/',
    heading: 'One shot. More possibilities.',
    sales: 'CONTACT US',
    contact: '/contact/',
    rain: 'Rain',
    taxi: 'London taxi',
    vertical: 'Vertical',
    shareAlt:
      'A classic car outside the Starlite Diner beneath a red sky with meteors.'
  },
  {
    path: '/zh-CN/solutions/vfx/v3/',
    heading: '一个镜头，更多可能。',
    sales: '联系我们',
    contact: '/zh-CN/contact/',
    rain: '雨天',
    taxi: '伦敦出租车',
    vertical: '竖屏',
    shareAlt: '流星划过红色天空，经典汽车停在星光餐厅外。'
  }
]) {
  test(`${path} preserves sales attribution`, async ({ page }) => {
    await page.goto(`${path}?utm_source=linkedin&utm_campaign=vfx-review`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://comfy.org${path}`
    )
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
    expect(
      await page
        .locator('meta[property^="og:image"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => [
            node.getAttribute('property'),
            node.getAttribute('content')
          ])
        )
    ).toEqual([
      ['og:image', vfxRedSkyMedia.share],
      ['og:image:type', 'image/gif'],
      ['og:image:width', '1200'],
      ['og:image:height', '630'],
      ['og:image:alt', shareAlt],
      ['og:image', vfxRedSkyMedia.poster],
      ['og:image:type', 'image/jpeg'],
      ['og:image:width', '1200'],
      ['og:image:height', '630'],
      ['og:image:alt', shareAlt]
    ])
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      'content',
      vfxRedSkyMedia.share
    )

    await expect(
      page.getByRole('link', { name: sales, exact: true }).first()
    ).toHaveAttribute(
      'href',
      `${contact}?interest=vfx&landing_version=v3&utm_source=linkedin&utm_campaign=vfx-review`
    )
  })
  for (const { viewport, suffix } of [
    { viewport: { width: 1440, height: 900 }, suffix: '' },
    { viewport: { width: 390, height: 844 }, suffix: ' @mobile' }
  ]) {
    for (const { demo, option, result } of [
      { demo: 'relight', option: rain, result: 'relight_rain' },
      { demo: 'swap', option: taxi, result: 'swap_uk' }
    ]) {
      test(`${path} ${demo} selects a clean playing result${suffix}`, async ({
        page
      }) => {
        await page.setViewportSize(viewport)
        await page.goto(path)
        const section = page.locator(`[data-vfx-demo="${demo}"]`)
        await waitForShowcase(section)
        const choice = section.getByRole('button', {
          name: option,
          exact: true
        })
        await choice.click()
        await expect(choice).toHaveAttribute('aria-pressed', 'true')
        const output = section.locator('.vfx-main-node')
        await expect(output.getByTestId('workflow-node-label')).toHaveText(
          option
        )
        await expect(output.getByRole('slider')).toHaveCount(0)
        await expect(
          output.getByText(/^(BEFORE|AFTER|处理前|处理后)$/i)
        ).toHaveCount(0)
        const video = output.locator('video')
        await video.scrollIntoViewIfNeeded()
        await expect(video).toHaveAttribute(
          'src',
          `https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/${result}.mp4`
        )
        await expect
          .poll(() =>
            video.evaluate(
              (node: HTMLVideoElement) =>
                !node.paused &&
                node.currentTime > 0.1 &&
                node.muted &&
                node.loop &&
                node.playsInline
            )
          )
          .toBe(true)
        await expect(choice).toHaveAttribute('aria-pressed', 'true')
        await expectNoHorizontalOverflow(page)
      })
    }
    test(`${path} reframe selects a clean image result${suffix}`, async ({
      page
    }) => {
      await page.setViewportSize(viewport)
      await page.goto(path)
      const section = page.locator('[data-vfx-demo="reframe"]')
      await waitForShowcase(section)
      const choice = section.getByRole('button', {
        name: vertical,
        exact: true
      })
      await choice.click()
      await expect(choice).toHaveAttribute('aria-pressed', 'true')
      const output = section.locator('.vfx-main-node')
      await expect(output.getByTestId('workflow-node-label')).toHaveText(
        vertical
      )
      await expect(output.getByRole('slider')).toHaveCount(0)
      await expect(
        output.getByText(/^(BEFORE|AFTER|处理前|处理后)$/i)
      ).toHaveCount(0)
      await expect(output.locator('img')).toHaveAttribute(
        'src',
        'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/reframe_vertical.jpg'
      )
      await expect(output.locator('video')).toHaveCount(0)
      await expectNoHorizontalOverflow(page)
    })
  }
}

test('selecting other capabilities preserves the independent relight sample', async ({
  page
}) => {
  await page.goto('/solutions/vfx/v3/')
  const relight = page.locator('[data-vfx-demo="relight"]')
  await waitForShowcase(relight)
  await relight.getByRole('button', { name: 'Rain', exact: true }).click()
  const swap = page.locator('[data-vfx-demo="swap"]')
  await waitForShowcase(swap)
  await swap.getByRole('button', { name: 'London taxi', exact: true }).click()
  const reframe = page.locator('[data-vfx-demo="reframe"]')
  await waitForShowcase(reframe)
  await reframe.getByRole('button', { name: 'Vertical', exact: true }).click()
  await expect(
    relight.getByRole('button', { name: 'Rain', exact: true })
  ).toHaveAttribute('aria-pressed', 'true')
})

for (const mobile of [false, true]) {
  const viewport = mobile
    ? { width: 390, height: 844 }
    : { width: 1440, height: 900 }
  test(`hero comparison stays synchronized through loops and version changes${mobile ? ' @mobile' : ''}`, async ({
    page
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/solutions/vfx/v3/')
    const hero = page.locator('[data-vfx-demo="hero"]')
    const original = hero.getByTestId('video-compare-before')
    const output = hero.getByTestId('video-compare-after')
    await original.scrollIntoViewIfNeeded()
    await expect
      .poll(() =>
        original.evaluate(
          (video: HTMLVideoElement) => !video.paused && video.currentTime > 0.1
        )
      )
      .toBe(true)
    await original.evaluate((video: HTMLVideoElement) => video.pause())
    await expect
      .poll(() => output.evaluate((video: HTMLVideoElement) => video.paused))
      .toBe(true)
    await hero.getByRole('button', { name: 'Snow', exact: true }).click()
    await expect(output).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/relight_snow.mp4'
    )
    await expect
      .poll(() =>
        output.evaluate(
          (video: HTMLVideoElement) => !video.paused && video.currentTime > 0.1
        )
      )
      .toBe(true)
    await original.evaluate((video: HTMLVideoElement) => {
      video.currentTime = video.duration - 0.2
    })
    await expect
      .poll(() =>
        original.evaluate(
          (video: HTMLVideoElement) => !video.paused && video.currentTime < 0.8
        )
      )
      .toBe(true)
    await expect
      .poll(async () =>
        Math.abs(
          (await original.evaluate(
            (video: HTMLVideoElement) => video.currentTime
          )) -
            (await output.evaluate(
              (video: HTMLVideoElement) => video.currentTime
            ))
        )
      )
      .toBeLessThan(0.12)
    const slider = hero.getByRole('slider')
    await slider.focus()
    await page.keyboard.press('Home')
    await expect(slider).toHaveAttribute('aria-valuenow', '0')
    await page.keyboard.press('End')
    await expect(slider).toHaveAttribute('aria-valuenow', '100')
  })
}

test('Studio comparison synchronizes selected samples and pauses when closed', async ({
  page
}) => {
  await page.goto('/solutions/vfx/v3/')
  const section = page.locator('[data-vfx-demo="relight"]')
  await waitForShowcase(section)
  await section
    .getByRole('button', { name: 'OPEN STUDIO', exact: true })
    .click()
  const studio = section.locator('.vfx-studio-view')
  await studio.getByRole('button', { name: 'Rain', exact: true }).click()
  const before = studio.getByTestId('video-compare-before')
  const after = studio.getByTestId('video-compare-after')
  await expect(after).toHaveAttribute(
    'src',
    'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/relight_rain.mp4'
  )
  await before.scrollIntoViewIfNeeded()
  await expect
    .poll(() =>
      before.evaluate(
        (video: HTMLVideoElement) => !video.paused && video.currentTime > 0.1
      )
    )
    .toBe(true)
  await expect
    .poll(async () =>
      Math.abs(
        (await before.evaluate(
          (video: HTMLVideoElement) => video.currentTime
        )) -
          (await after.evaluate((video: HTMLVideoElement) => video.currentTime))
      )
    )
    .toBeLessThan(0.12)
  const slider = studio.getByRole('slider')
  await slider.focus()
  await page.keyboard.press('End')
  await expect(slider).toHaveAttribute('aria-valuenow', '100')
  await studio
    .getByRole('button', { name: '← BACK TO VFX PAGE', exact: true })
    .click()
  await expect
    .poll(() => before.evaluate((video: HTMLVideoElement) => video.paused))
    .toBe(true)
  await expect
    .poll(() => after.evaluate((video: HTMLVideoElement) => video.paused))
    .toBe(true)
})

test('hero autoplay rejection recovers on a new sample', async ({
  page,
  context
}) => {
  await context.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play
    let first = true
    HTMLMediaElement.prototype.play = function () {
      if (first && this.closest('[data-vfx-demo="hero"]')) {
        first = false
        document.documentElement.dataset.vfxAutoplayRejected = 'true'
        return Promise.reject(
          new DOMException('Autoplay blocked', 'NotAllowedError')
        )
      }
      return play.call(this)
    }
  })
  await page.goto('/solutions/vfx/v3/')
  const hero = page.locator('[data-vfx-demo="hero"]')
  await expectIslandHydrated(page, hero)
  await expect(page.locator('html')).toHaveAttribute(
    'data-vfx-autoplay-rejected',
    'true'
  )
  await hero.getByRole('button', { name: 'Snow', exact: true }).click()
  await hero.getByTestId('video-compare-after').scrollIntoViewIfNeeded()
  await expect
    .poll(() =>
      hero
        .getByTestId('video-compare-after')
        .evaluate(
          (video: HTMLVideoElement) => !video.paused && video.currentTime > 0.1
        )
    )
    .toBe(true)
})

test('another version recovers a failed graph output', async ({
  page,
  context
}) => {
  await context.route(
    'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/swap_uk.mp4',
    (route) => route.abort()
  )
  await page.goto('/solutions/vfx/v3/')
  const section = page.locator('[data-vfx-demo="swap"]')
  await waitForShowcase(section)
  await section
    .getByRole('button', { name: 'London taxi', exact: true })
    .click()
  await expect
    .poll(() =>
      section
        .locator('.vfx-main-node video')
        .evaluate((node: HTMLVideoElement) => node.error !== null)
    )
    .toBe(true)
  await section.getByRole('button', { name: 'Fiat 500', exact: true }).click()
  const video = section.locator('.vfx-main-node video')
  await video.scrollIntoViewIfNeeded()
  await expect(video).toHaveAttribute(
    'src',
    'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/swap_it.mp4'
  )
  await expect
    .poll(() =>
      video.evaluate(
        (node: HTMLVideoElement) => !node.paused && node.currentTime > 0.1
      )
    )
    .toBe(true)
})

test('source and output previews pause offscreen while keyboard canvas exploration remains available', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/solutions/vfx/v3/')
  const section = page.locator('[data-vfx-demo="relight"]')
  await waitForShowcase(section)
  const canvas = section.locator('.vfx-canvas-window')
  const source = section.locator('.vfx-source-node video')
  const output = section.locator('.vfx-main-node video')
  await expect(canvas).toHaveAccessibleDescription(
    'Drag left or right to see full workflows Use the arrow keys, Home and End to move with the keyboard.'
  )
  await expect
    .poll(() =>
      output.evaluate(
        (video: HTMLVideoElement) => !video.paused && video.currentTime > 0.1
      )
    )
    .toBe(true)
  await expect
    .poll(() => source.evaluate((video: HTMLVideoElement) => video.paused))
    .toBe(true)
  await canvas.focus()
  await page.keyboard.press('Home')
  await expect(section.locator('.vfx-source-node')).toBeInViewport({
    ratio: 0.99
  })
  await expect
    .poll(() =>
      source.evaluate(
        (video: HTMLVideoElement) => !video.paused && video.currentTime > 0.1
      )
    )
    .toBe(true)
  await page.keyboard.press('End')
  await expect(section.locator('.vfx-main-node')).toBeInViewport({
    ratio: 0.99
  })
  await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded()
  await expect
    .poll(() =>
      section
        .locator('video')
        .evaluateAll((videos) =>
          videos.every(
            (video) => video instanceof HTMLVideoElement && video.paused
          )
        )
    )
    .toBe(true)
})

test('reduced motion keeps graph output still after version selection', async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/solutions/vfx/v3/')
  const section = page.locator('[data-vfx-demo="relight"]')
  await waitForShowcase(section)
  await section.getByRole('button', { name: 'Snow', exact: true }).click()
  await expect(section.locator('.vfx-main-node video')).toHaveAttribute(
    'src',
    'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/relight_snow.mp4'
  )
  expect(
    await section
      .locator('video')
      .evaluateAll((videos) =>
        videos.every(
          (video) => video instanceof HTMLVideoElement && video.paused
        )
      )
  ).toBe(true)
})
for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`sample hero keeps comparison controls without workflow actions with ${reducedMotion} motion`, async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/solutions/vfx/v3/?utm_source=linkedin')
    const hero = page.locator('[data-vfx-demo="hero"]')
    await expectIslandHydrated(page, hero)
    const snow = hero.getByRole('button', { name: 'Snow', exact: true })
    await snow.click()
    await expect(snow).toHaveAttribute('aria-pressed', 'true')
    await expect(hero.getByRole('slider')).toBeVisible()
    const preview = hero.getByTestId('video-compare-surface')
    await expect
      .poll(async () => (await preview.boundingBox())?.width ?? 0)
      .toBeGreaterThan(900)
    await expect(
      hero.getByRole('button', {
        name: reducedMotion === 'reduce' ? 'Play' : 'Pause',
        exact: true
      })
    ).toBeVisible()
    await expect(
      hero.getByRole('button', { name: /use workflow/i })
    ).toHaveCount(0)
    await expect(hero).not.toContainText('Existing sample outputs.')
    await expect(page).toHaveURL(/\?utm_source=linkedin$/)
    await expectNoHorizontalOverflow(page)
  })
}

test('reduced motion keeps the sample hero paused after selection', async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/solutions/vfx/v3/')
  const hero = page.locator('[data-vfx-demo="hero"]')
  await expectIslandHydrated(page, hero)
  await hero.getByRole('button', { name: 'Snow', exact: true }).click()
  await expect
    .poll(() =>
      hero
        .locator('video')
        .evaluateAll((videos) =>
          videos.every(
            (video) => video instanceof HTMLVideoElement && video.paused
          )
        )
    )
    .toBe(true)
})

for (const {
  path,
  demo,
  option,
  open,
  back,
  settings,
  workflow,
  shot,
  mobile
} of [
  {
    path: '/solutions/vfx/v3/',
    demo: 'relight',
    option: 'Rain',
    open: 'OPEN STUDIO',
    back: '← BACK TO VFX PAGE',
    settings: 'SETTINGS',
    workflow: 'WORKFLOW',
    shot: 'Describe the shot',
    mobile: false
  },
  {
    path: '/zh-CN/solutions/vfx/v3/',
    demo: 'swap',
    option: '伦敦出租车',
    open: '打开工作室',
    back: '← 返回视觉特效页面',
    settings: '设置',
    workflow: '工作流',
    shot: '描述镜头',
    mobile: true
  }
]) {
  const viewport = mobile
    ? { width: 390, height: 844 }
    : { width: 1440, height: 900 }
  test(`${path} ${demo} Studio preserves independent samples and editable settings${mobile ? ' @mobile' : ''}`, async ({
    page
  }) => {
    await page.setViewportSize(viewport)
    await page.goto(path)
    const section = page.locator(`[data-vfx-demo="${demo}"]`)
    await waitForShowcase(section)
    const choice = section.getByRole('button', { name: option, exact: true })
    await choice.click()
    await section.locator('.vfx-canvas-window').focus()
    await page.keyboard.press('ArrowLeft')
    const trigger = section.getByRole('button', { name: open, exact: true })
    const returnButton = section.getByRole('button', {
      name: back,
      exact: true
    })
    await trigger.scrollIntoViewIfNeeded()
    const savedScroll = await page.evaluate(() => window.scrollY)
    const savedTransform = await section
      .locator('.vfx-scene-stage')
      .evaluate((node) => getComputedStyle(node).transform)
    await trigger.click()
    const studio = section.locator('.vfx-studio-view')
    await expect(returnButton).toBeFocused()
    await expect(
      studio.getByRole('tab', { name: settings, exact: true })
    ).toHaveAttribute('aria-selected', 'true')
    await expect(section.locator('.vfx-showcase-view')).toBeHidden()
    await expect(
      page.locator('vfx-workflow-showcase[data-workspace]')
    ).toHaveCount(1)
    await studio.getByRole('tab', { name: workflow, exact: true }).click()
    await expect(
      studio.getByRole('tab', { name: workflow, exact: true })
    ).toHaveAttribute('aria-selected', 'true')
    await studio.getByRole('tab', { name: settings, exact: true }).click()
    const description = studio.getByRole('textbox', { name: shot, exact: true })
    await description.fill('A retained shot description')
    await expect(
      studio.getByRole('button', { name: option, exact: true })
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      studio.getByRole('button', { name: /^(ADJUST KEY FRAME|调整关键帧)$/ })
    ).toBeDisabled()
    await expect(
      studio.getByRole('button', { name: /^(RUN WORKFLOW|运行工作流)$/ })
    ).toBeDisabled()
    await returnButton.click()
    await expect(trigger).toBeFocused()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(choice).toHaveAttribute('aria-pressed', 'true')
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBe(savedScroll)
    await expect(section.locator('.vfx-scene-stage')).toHaveCSS(
      'transform',
      savedTransform
    )
    await trigger.click()
    await expect(
      studio.getByRole('tab', { name: settings, exact: true })
    ).toHaveAttribute('aria-selected', 'true')
    await expect(description).toHaveValue('A retained shot description')
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await expect(studio).toBeHidden()
    await expectNoHorizontalOverflow(page)
  })
}

test('verified workflow links stay external and use the supplied destinations', async ({
  page
}) => {
  await page.goto('/solutions/vfx/v3/')
  await expect(
    page.getByRole('button', { name: /CUSTOMIZE NOW|立即定制/ })
  ).toHaveCount(0)
  const relight = page.locator('[data-vfx-demo="relight"] [data-try-workflow]')
  await expect(relight).toHaveAttribute(
    'href',
    'https://cloud.comfy.org/?share=8b18c850d38a'
  )
  await expect(relight).toHaveAttribute('target', '_blank')
  await expect(
    page.locator('[data-vfx-demo="swap"] [data-try-workflow]')
  ).toHaveAttribute('href', 'https://cloud.comfy.org/?share=28fa6219c110')
  await expect(
    page.locator('[data-vfx-demo="reframe"] [data-try-workflow]')
  ).toHaveAttribute('href', 'https://cloud.comfy.org/?share=ccfd0e7d75c3')
})

for (const { demo, width, axis, leading, trailing } of [
  {
    demo: 'relight',
    width: 1440,
    axis: 'x',
    leading: '.vfx-section-top',
    trailing: '.vfx-canvas-window'
  },
  {
    demo: 'swap',
    width: 1440,
    axis: 'x',
    leading: '.vfx-canvas-window',
    trailing: '.vfx-section-top'
  },
  {
    demo: 'reframe',
    width: 1440,
    axis: 'x',
    leading: '.vfx-section-top',
    trailing: '.vfx-canvas-window'
  },
  {
    demo: 'sequence',
    width: 1440,
    axis: 'x',
    leading: '.vfx-canvas-window',
    trailing: '.vfx-section-top'
  },
  {
    demo: 'relight',
    width: 390,
    axis: 'y',
    leading: '.vfx-section-top',
    trailing: '.vfx-canvas-window'
  },
  {
    demo: 'swap',
    width: 390,
    axis: 'y',
    leading: '.vfx-section-top',
    trailing: '.vfx-canvas-window'
  },
  {
    demo: 'reframe',
    width: 390,
    axis: 'y',
    leading: '.vfx-section-top',
    trailing: '.vfx-canvas-window'
  },
  {
    demo: 'sequence',
    width: 390,
    axis: 'y',
    leading: '.vfx-section-top',
    trailing: '.vfx-canvas-window'
  }
] as const) {
  const dimension = axis === 'x' ? 'width' : 'height'
  test(`${demo} capability columns follow reading order at ${width}px${width === 390 ? ' @mobile' : ''}`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/solutions/vfx/v3/')
    const section = page.locator(`[data-vfx-demo="${demo}"]`)
    const first = await section.locator(leading).boundingBox()
    const second = await section.locator(trailing).boundingBox()
    assert(first, 'Leading capability panel must have a bounding box')
    assert(second, 'Trailing capability panel must have a bounding box')
    expect(first[axis] + first[dimension]).toBeLessThanOrEqual(second[axis])
  })
}

test('Studio returns to the same playback time after editing Settings', async ({
  page
}) => {
  await page.goto('/solutions/vfx/v3/')
  const section = page.locator('[data-vfx-demo="relight"]')
  await waitForShowcase(section)
  const graphVideo = section.locator('.vfx-main-node video')
  await expect
    .poll(() =>
      graphVideo.evaluate((video: HTMLVideoElement) => video.readyState)
    )
    .toBeGreaterThanOrEqual(2)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await graphVideo.evaluate((video: HTMLVideoElement) => {
    video.currentTime = 1.25
  })
  await expect
    .poll(() =>
      graphVideo.evaluate((video: HTMLVideoElement) => video.currentTime)
    )
    .toBeCloseTo(1.25, 1)
  await section
    .getByRole('button', { name: 'OPEN STUDIO', exact: true })
    .click()
  const studio = section.locator('.vfx-studio-view')
  const studioVideo = studio.getByTestId('video-compare-before')
  await expect
    .poll(() =>
      studioVideo.evaluate((video: HTMLVideoElement) => video.currentTime)
    )
    .toBeCloseTo(1.25, 1)
  await studio.getByRole('tab', { name: 'SETTINGS', exact: true }).click()
  await studio
    .getByRole('textbox', { name: 'Describe the shot', exact: true })
    .fill('A snowy diner at dusk')
  await studio
    .getByRole('button', { name: '← BACK TO VFX PAGE', exact: true })
    .click()
  await expect
    .poll(() =>
      graphVideo.evaluate((video: HTMLVideoElement) => video.currentTime)
    )
    .toBeCloseTo(1.25, 1)
})

for (const demo of ['relight', 'swap', 'reframe', 'sequence']) {
  for (const width of [1440, 390]) {
    test(`${demo} wires follow socket centers and preserve whole-frame media after resizing to ${width}px${width === 390 ? ' @mobile' : ''}`, async ({
      page
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.goto('/solutions/vfx/v3/')
      await page.setViewportSize({ width, height: 1000 })
      const section = page.locator(`[data-vfx-demo="${demo}"]`)
      await waitForShowcase(section)
      const panel = section.locator('.vfx-visual-panel')
      await expect(panel.locator('.vfx-canvas-window')).toHaveCount(1)
      await expect(panel.locator('.vfx-versions')).toHaveCount(1)
      await expect(section.locator('.vfx-sample-caption')).toHaveCount(0)
      await expect
        .poll(() =>
          section.evaluate((root) => {
            const paths = [
              ...root.querySelectorAll<SVGPathElement>('.vfx-connections path')
            ]
            const ports = [
              [
                '.vfx-source-node .vfx-port-out',
                '.vfx-keyframe-node .vfx-port-in'
              ],
              [
                '.vfx-keyframe-node .vfx-port-out',
                '.vfx-main-node .vfx-port-in'
              ]
            ]
            if (paths.length !== ports.length) return Number.POSITIVE_INFINITY
            return Math.max(
              ...paths.flatMap((path, index) =>
                ports[index].map((selector, endpoint) => {
                  const bounds = root
                    .querySelector(selector)
                    ?.getBoundingClientRect()
                  const matrix = path.getScreenCTM()
                  if (!bounds || !matrix) return Number.POSITIVE_INFINITY
                  const point = path.getPointAtLength(
                    endpoint === 0 ? 0 : path.getTotalLength()
                  )
                  const screen = new DOMPoint(point.x, point.y).matrixTransform(
                    matrix
                  )
                  return Math.hypot(
                    screen.x - bounds.x - bounds.width / 2,
                    screen.y - bounds.y - bounds.height / 2
                  )
                })
              )
            )
          })
        )
        .toBeLessThanOrEqual(1)
      await expect
        .poll(
          async () =>
            new Set(
              await panel
                .locator(
                  '.vfx-source-node video, .vfx-source-node img, .vfx-keyframe-node img, .vfx-main-node video, .vfx-main-node img, .vfx-versions img'
                )
                .evaluateAll((media) =>
                  media.map((node) => getComputedStyle(node).objectFit)
                )
            )
        )
        .toEqual(new Set(['contain']))
    })
  }
}

test('hero comparison media fills its wide frame', async ({ page }) => {
  await page.goto('/solutions/vfx/v3/')
  const hero = page.locator('[data-vfx-demo="hero"]')
  await expect(hero.getByTestId('video-compare-before')).toHaveCSS(
    'object-fit',
    'cover'
  )
})

for (const {
  path,
  push,
  orbit,
  open,
  settings,
  workflow,
  back,
  expose,
  reference,
  mobile
} of [
  {
    path: '/solutions/vfx/v3/',
    push: 'Push-in',
    orbit: 'Orbit',
    open: 'OPEN STUDIO',
    settings: 'SETTINGS',
    workflow: 'WORKFLOW',
    back: '← BACK TO VFX PAGE',
    expose: 'EXPOSE WORKFLOW',
    reference: 'Reference frame',
    mobile: false
  },
  {
    path: '/zh-CN/solutions/vfx/v3/',
    push: '推进镜头',
    orbit: '环绕镜头',
    open: '打开工作室',
    settings: '设置',
    workflow: '工作流',
    back: '← 返回视觉特效页面',
    expose: '查看工作流',
    reference: '参考帧',
    mobile: true
  }
]) {
  const viewport = mobile
    ? { width: 390, height: 844 }
    : { width: 1440, height: 900 }
  test(`${path} sequence uses its reference and returns from the shared Studio with its selected shot${mobile ? ' @mobile' : ''}`, async ({
    page
  }) => {
    await page.setViewportSize(viewport)
    await page.goto(path)
    const section = page.locator('[data-vfx-demo="sequence"]')
    await waitForShowcase(section)
    await expect(section.locator('.vfx-source-node video')).toHaveAttribute(
      'data-src',
      'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/rain.mp4'
    )
    const referenceFrame = section.locator('.vfx-keyframe-node img')
    await expect(referenceFrame).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/rain.jpg'
    )
    await expect(
      section.locator('.vfx-keyframe-node').getByTestId('workflow-node-label')
    ).toHaveText(reference)
    await section.getByRole('button', { name: push, exact: true }).click()
    await expect(section.locator('.vfx-main-node video')).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/seedance_push.mp4'
    )
    await expect(
      section.locator('.vfx-main-node').getByTestId('workflow-node-label')
    ).toHaveText(push)
    await expect(referenceFrame).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/rain.jpg'
    )
    const cloud = section.locator('[data-try-workflow]')
    await expect(cloud).toHaveAttribute(
      'href',
      'https://cloud.comfy.org/?share=c2191c018939'
    )
    await expect(cloud).toHaveAttribute('target', '_blank')
    const trigger = section.getByRole('button', { name: open, exact: true })
    await trigger.click()
    const studio = section.locator('.vfx-studio-view')
    await expect(
      studio.getByRole('tab', { name: settings, exact: true })
    ).toHaveAttribute('aria-selected', 'true')
    await expect(studio.getByRole('slider')).toHaveCount(0)
    await expect(
      studio.getByRole('button', { name: /ADJUST KEY FRAME|调整关键帧/ })
    ).toHaveCount(0)
    await expect(
      studio.getByRole('button', { name: /^(RUN WORKFLOW|运行工作流)$/ })
    ).toBeDisabled()
    await studio.getByRole('button', { name: orbit, exact: true }).click()
    await expect(studio.locator('video')).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/seedance_orbit.mp4'
    )
    await expect(studio.locator('video')).toHaveCSS('object-fit', 'contain')
    const studioVideo = studio.locator('video')
    await studioVideo.scrollIntoViewIfNeeded()
    await expect
      .poll(() =>
        studioVideo.evaluate(
          (video: HTMLVideoElement) => !video.paused && video.currentTime > 0.1
        )
      )
      .toBe(true)
    await studioVideo.evaluate((video: HTMLVideoElement) => {
      video.currentTime = 2
      video.dispatchEvent(new Event('timeupdate'))
    })
    await expect
      .poll(() =>
        studio
          .locator('[data-playback-time]')
          .getAttribute('data-playback-time')
          .then(Number)
      )
      .toBeGreaterThanOrEqual(2)
    await studio.getByRole('tab', { name: workflow, exact: true }).click()
    await expect(
      studio.getByRole('link', { name: new RegExp(expose) })
    ).toHaveAttribute('href', 'https://cloud.comfy.org/?share=c2191c018939')
    await studio.getByRole('button', { name: back, exact: true }).click()
    await expect
      .poll(() =>
        studioVideo.evaluate((video: HTMLVideoElement) => video.paused)
      )
      .toBe(true)
    await expect
      .poll(() =>
        section
          .locator('.vfx-main-node video')
          .evaluate((video: HTMLVideoElement) => video.currentTime)
      )
      .toBeGreaterThanOrEqual(2)
    await expect(trigger).toBeFocused()
    await expect(
      section.getByRole('button', { name: orbit, exact: true })
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(section.locator('.vfx-main-node video')).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/seedance_orbit.mp4'
    )
    await expect(
      section.locator('.vfx-main-node').getByTestId('workflow-node-label')
    ).toHaveText(orbit)
    await expect(referenceFrame).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/rain.jpg'
    )
    await expect(
      section.locator('.vfx-main-node').getByRole('slider')
    ).toHaveCount(0)
    const output = section.locator('.vfx-main-node video')
    await output.scrollIntoViewIfNeeded()
    await expect
      .poll(() =>
        output.evaluate(
          (video: HTMLVideoElement) => !video.paused && video.currentTime > 0.1
        )
      )
      .toBe(true)
    await expectNoHorizontalOverflow(page)
  })
}

async function startHeroPlayback(
  hero: Locator,
  comparison: Locator,
  play: string,
  reducedMotion: 'reduce' | 'no-preference'
) {
  if (reducedMotion === 'reduce') {
    const control = hero.getByRole('button', { name: play, exact: true })
    await control.focus()
    await control.press('Space')
  }
  await comparison.scrollIntoViewIfNeeded()
}

for (const { path, pause, play, sample, reducedMotion, mobile } of [
  {
    path: '/solutions/vfx/v3/',
    pause: 'Pause',
    play: 'Play',
    sample: 'Rain',
    reducedMotion: 'no-preference',
    mobile: false
  },
  {
    path: '/zh-CN/solutions/vfx/v3/',
    pause: '暂停',
    play: '播放',
    sample: '雨天',
    reducedMotion: 'reduce',
    mobile: true
  }
] as const) {
  test(`${path} hero preserves visitor playback choice${mobile ? ' @mobile' : ''}`, async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion })
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }
    )
    await page.goto(path)
    const hero = page.locator('[data-vfx-demo="hero"]')
    await expectIslandHydrated(page, hero)
    const comparison = hero.getByTestId('video-compare-surface')
    await comparison.scrollIntoViewIfNeeded()
    const control = hero.getByRole('button', { name: pause, exact: true })
    await startHeroPlayback(hero, comparison, play, reducedMotion)
    await expect
      .poll(() =>
        comparison
          .locator('video')
          .evaluateAll(
            (videos) =>
              videos.length === 2 &&
              videos.every(
                (video) =>
                  video instanceof HTMLVideoElement &&
                  !video.paused &&
                  video.readyState >= 2
              )
          )
      )
      .toBe(true)
    await control.focus()
    await control.press('Space')
    await hero.getByRole('button', { name: sample, exact: true }).click()
    await comparison.scrollIntoViewIfNeeded()
    await expect
      .poll(() =>
        comparison
          .locator('video')
          .evaluateAll(
            (videos) =>
              videos.length === 2 &&
              videos.every(
                (video) => video instanceof HTMLVideoElement && video.paused
              )
          )
      )
      .toBe(true)
    await expect(hero.getByRole('slider')).toHaveAttribute(
      'aria-valuenow',
      '50'
    )
    const resume = hero.getByRole('button', { name: play, exact: true })
    await resume.focus()
    await resume.press('Space')
    await comparison.scrollIntoViewIfNeeded()
    await expect
      .poll(() =>
        comparison
          .locator('video')
          .evaluateAll(
            (videos) =>
              videos.length === 2 &&
              videos.every(
                (video) =>
                  video instanceof HTMLVideoElement &&
                  !video.paused &&
                  video.readyState >= 2
              )
          )
      )
      .toBe(true)
  })
}

test('VFX hero follows fine-pointer hover without a press and preserves keyboard and page scrolling', async ({
  page
}) => {
  await page.goto('/solutions/vfx/v3/')
  const hero = page.locator('[data-vfx-demo="hero"]')
  await expectIslandHydrated(page, hero)
  const comparison = hero.getByTestId('video-compare-surface')
  await comparison.scrollIntoViewIfNeeded()
  const bounds = await comparison.boundingBox()
  assert(bounds)
  const slider = hero.getByRole('slider')
  await page.mouse.move(
    bounds.x + bounds.width * 0.25,
    bounds.y + bounds.height / 2
  )
  await expect(slider).toHaveAttribute('aria-valuenow', '25')
  await slider.focus()
  await slider.press('ArrowRight')
  await expect(slider).toHaveAttribute('aria-valuenow', '27')
  await page.mouse.move(
    bounds.x + bounds.width * 0.75,
    bounds.y + bounds.height / 2
  )
  await expect(slider).toHaveAttribute('aria-valuenow', '75')
  const beforeScroll = await page.evaluate(() => window.scrollY)
  await page.mouse.wheel(0, 200)
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(beforeScroll)
})

for (const { path, image, dimensions } of [
  { path: '/', image: DEFAULT_OG_IMAGE, dimensions: 1 },
  {
    path: '/solutions/vfx/',
    image: vfxWorkflows[5].template.thumbnails[0],
    dimensions: 0
  }
]) {
  test(`${path} keeps its existing share image when V3 uses animated metadata`, async ({
    page
  }) => {
    await page.goto(path)
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1)
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      image
    )
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      'content',
      image
    )
    await expect(page.locator('meta[property="og:image:type"]')).toHaveCount(0)
    await expect(page.locator('meta[property="og:image:width"]')).toHaveCount(
      dimensions
    )
  })
}

for (const { path, redSky, daylight, openStudio } of [
  {
    path: '/solutions/vfx/v3/',
    redSky: 'Red sky',
    daylight: 'Daylight',
    openStudio: 'OPEN STUDIO'
  },
  {
    path: '/zh-CN/solutions/vfx/v3/',
    redSky: '红色天空',
    daylight: '白天',
    openStudio: '打开工作室'
  }
]) {
  test(`${path} replaces only Blue hour across hero, canvas and Studio`, async ({
    page
  }) => {
    await page.goto(path)
    const hero = page.locator('[data-vfx-demo="hero"]')
    await hero.getByRole('button', { name: redSky, exact: true }).click()
    const after = hero.getByTestId('video-compare-after')
    await expect(after).toHaveAttribute('src', vfxRedSkyMedia.video)
    await expect(after).toHaveAttribute('poster', vfxRedSkyMedia.poster)
    await expect(hero.getByTestId('video-compare-before')).toHaveAttribute(
      'src',
      `${vfxMediaRoot}/diner.mp4`
    )
    await hero.getByRole('button', { name: daylight, exact: true }).click()
    await expect(after).toHaveAttribute(
      'src',
      `${vfxMediaRoot}/relight_day.mp4`
    )
    const section = page.locator('[data-vfx-demo="relight"]')
    await waitForShowcase(section)
    const choice = section.getByRole('button', { name: redSky, exact: true })
    await expect(choice.locator('img')).toHaveAttribute(
      'src',
      vfxRedSkyMedia.poster
    )
    await choice.click()
    const output = section.locator('.vfx-main-node video')
    await expect(output).toHaveAttribute('src', vfxRedSkyMedia.video)
    await expect(output).toHaveAttribute('poster', vfxRedSkyMedia.poster)
    await expect(section.locator('.vfx-keyframe-node img')).toHaveAttribute(
      'src',
      vfxRedSkyMedia.poster
    )
    await section.getByRole('button', { name: openStudio, exact: true }).click()
    const studio = section.locator('.vfx-studio-view')
    await expect(studio.getByTestId('video-compare-after')).toHaveAttribute(
      'src',
      vfxRedSkyMedia.video
    )
    await expect(studio.getByTestId('video-compare-before')).toHaveAttribute(
      'src',
      `${vfxMediaRoot}/diner.mp4`
    )
    await studio.getByRole('button', { name: daylight, exact: true }).click()
    await expect(studio.getByTestId('video-compare-after')).toHaveAttribute(
      'src',
      `${vfxMediaRoot}/relight_day.mp4`
    )
  })
}

for (const { path, demo, share, open, workflow, expose } of [
  {
    path: '/solutions/vfx/v3/',
    demo: 'swap',
    share: '28fa6219c110',
    open: 'OPEN STUDIO',
    workflow: 'WORKFLOW',
    expose: 'EXPOSE WORKFLOW ↗'
  },
  {
    path: '/solutions/vfx/v3/',
    demo: 'reframe',
    share: 'ccfd0e7d75c3',
    open: 'OPEN STUDIO',
    workflow: 'WORKFLOW',
    expose: 'EXPOSE WORKFLOW ↗'
  },
  {
    path: '/zh-CN/solutions/vfx/v3/',
    demo: 'swap',
    share: '28fa6219c110',
    open: '打开工作室',
    workflow: '工作流',
    expose: '查看工作流 ↗'
  },
  {
    path: '/zh-CN/solutions/vfx/v3/',
    demo: 'reframe',
    share: 'ccfd0e7d75c3',
    open: '打开工作室',
    workflow: '工作流',
    expose: '查看工作流 ↗'
  }
]) {
  test(`${path} ${demo} uses its supplied workflow in the page and Studio`, async ({
    page
  }) => {
    await page.goto(
      `${path}?utm_source=linkedin&utm_campaign=vfx&utm_content=v3`
    )
    const section = page.locator(`[data-vfx-demo="${demo}"]`)
    const expected = `https://cloud.comfy.org/?share=${share}&utm_source=linkedin&utm_campaign=vfx&utm_content=v3`
    const cta = section.locator('[data-try-workflow]')
    await expect(cta).toHaveAttribute('href', expected)
    await expect(cta).toHaveAttribute('target', '_blank')
    await waitForShowcase(section)
    await section.getByRole('button', { name: open, exact: true }).click()
    const studio = section.locator('[data-vfx-studio]')
    await studio.getByRole('tab', { name: workflow, exact: true }).click()
    await expect(
      studio.getByRole('link', { name: expose, exact: true })
    ).toHaveAttribute('href', expected)
  })
}
