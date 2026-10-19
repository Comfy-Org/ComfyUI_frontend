import { join } from 'node:path'

import { websiteRoot } from '@website/paths'

import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.beforeEach(async ({ context }) => {
  await context.route(
    'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/*.mp4',
    (route) =>
      route.fulfill({
        path: join(websiteRoot, 'e2e/assets/vfx-playback.mp4'),
        headers: { 'Accept-Ranges': 'bytes', 'Content-Type': 'video/mp4' }
      })
  )
})

async function waitForShowcase(section: Locator) {
  await section.locator('.vfx-canvas-window').evaluate((node) => {
    node.scrollIntoView({ block: 'start', behavior: 'instant' })
  })
  await expect(section).toHaveAttribute('data-canvas-ready', '', {
    timeout: 12_000
  })
}

for (const { path, heading, sales, contact, rain, taxi, vertical } of [
  {
    path: '/solutions/vfx/v3/',
    heading: 'One shot. More possibilities.',
    sales: 'TALK TO SALES',
    contact: '/contact/',
    rain: 'Rain',
    taxi: 'London taxi',
    vertical: 'Vertical'
  },
  {
    path: '/zh-CN/solutions/vfx/v3/',
    heading: '一个镜头，更多可能。',
    sales: '联系销售',
    contact: '/zh-CN/contact/',
    rain: '雨天',
    taxi: '伦敦出租车',
    vertical: '竖屏'
  }
]) {
  for (const mobile of [false, true]) {
    test(`${path} selects clean result previews and preserves sales attribution${mobile ? ' @mobile' : ''}`, async ({
      page
    }) => {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`${path}?utm_source=linkedin&utm_campaign=vfx-review`)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
      await expect(
        page.getByRole('link', { name: sales, exact: true }).first()
      ).toHaveAttribute(
        'href',
        `${contact}?interest=vfx&landing_version=v3&utm_source=linkedin&utm_campaign=vfx-review`
      )
      for (const { demo, option, result } of [
        { demo: 'relight', option: rain, result: 'relight_rain' },
        { demo: 'swap', option: taxi, result: 'swap_uk' },
        { demo: 'reframe', option: vertical, result: 'reframe_vertical' }
      ]) {
        const section = page.locator(`[data-vfx-demo="${demo}"]`)
        await waitForShowcase(section)
        const choice = section.getByRole('button', {
          name: option,
          exact: true
        })
        await choice.click()
        await expect(choice).toHaveAttribute('aria-pressed', 'true')
        const output = section.locator('.vfx-main-node')
        await expect(
          output.locator('.wf-node-heading .ppformula-text-center')
        ).toHaveText(option)
        await expect(output.getByRole('slider')).toHaveCount(0)
        await expect(
          output.getByText(/^(BEFORE|AFTER|处理前|处理后)$/i)
        ).toHaveCount(0)
        if (demo === 'reframe') {
          await expect(output.locator('img')).toHaveAttribute(
            'src',
            `https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/${result}.jpg`
          )
          await expect(output.locator('video')).toHaveCount(0)
        } else {
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
        }
      }
      await expect(
        page
          .locator('[data-vfx-demo="relight"]')
          .getByRole('button', { name: rain, exact: true })
      ).toHaveAttribute('aria-pressed', 'true')
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
    })
  }
}

test('relight output defaults to Golden hour and changes its native media for all six versions', async ({
  page
}) => {
  await page.goto('/solutions/vfx/v3/')
  const section = page.locator('[data-vfx-demo="relight"]')
  await waitForShowcase(section)
  const output = section.locator('.vfx-main-node')
  await expect(
    output.locator('.wf-node-heading .ppformula-text-center')
  ).toHaveText('Golden hour')
  for (const [label, suffix] of [
    ['Golden hour', 'golden'],
    ['Night', 'night'],
    ['Blue hour', 'blue'],
    ['Rain', 'rain'],
    ['Snow', 'snow'],
    ['Daylight', 'day']
  ]) {
    await section.getByRole('button', { name: label, exact: true }).click()
    await expect(
      output.locator('.wf-node-heading .ppformula-text-center')
    ).toHaveText(label)
    await expect(output.locator('video')).toHaveAttribute(
      'src',
      `https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/relight_${suffix}.mp4`
    )
    await expect(output.locator('video')).toHaveAttribute(
      'poster',
      `https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/relight_${suffix}.jpg`
    )
    await expect(output.getByRole('slider')).toHaveCount(0)
  }
})

for (const mobile of [false, true]) {
  test(`hero comparison stays synchronized through loops and version changes${mobile ? ' @mobile' : ''}`, async ({
    page
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 })
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
    .getByRole('button', { name: '← BACK TO EXAMPLES', exact: true })
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
  await expect(
    page.locator('astro-island').filter({ has: hero })
  ).not.toHaveAttribute('ssr')
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
  await expect(
    page.getByRole('button', { name: /^(Pause|Play)$/ })
  ).toHaveCount(0)
})
for (const reduced of [false, true]) {
  test(`sample hero keeps comparison controls without workflow actions${reduced ? ' with reduced motion' : ''}`, async ({
    page
  }) => {
    if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/solutions/vfx/v3/?utm_source=linkedin')
    const hero = page.locator('[data-vfx-demo="hero"]')
    await expect(
      page.locator('astro-island').filter({ has: hero })
    ).not.toHaveAttribute('ssr')
    const snow = hero.getByRole('button', { name: 'Snow', exact: true })
    await snow.click()
    await expect(snow).toHaveAttribute('aria-pressed', 'true')
    await expect(hero.getByRole('slider')).toBeVisible()
    const preview = hero.getByTestId('video-compare-surface')
    await expect
      .poll(async () => (await preview.boundingBox())?.width ?? 0)
      .toBeGreaterThan(900)
    await expect(
      page.getByRole('button', { name: /^(Pause|Play)$/ })
    ).toHaveCount(0)
    await expect(
      hero.getByRole('button', { name: /use workflow/i })
    ).toHaveCount(0)
    await expect(hero).not.toContainText('Existing sample outputs.')
    await expect(page).toHaveURL(/\?utm_source=linkedin$/)
    if (reduced) {
      await expect
        .poll(() =>
          hero
            .locator('video')
            .evaluateAll((videos) =>
              videos.every((video) => (video as HTMLVideoElement).paused)
            )
        )
        .toBe(true)
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  })
}

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
    back: '← BACK TO EXAMPLES',
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
    back: '← 返回示例',
    settings: '设置',
    workflow: '工作流',
    shot: '描述镜头',
    mobile: true
  }
]) {
  test(`${path} ${demo} Studio preserves independent samples and editable settings${mobile ? ' @mobile' : ''}`, async ({
    page
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 })
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
    await expect(studio.locator('button[disabled]')).toHaveCount(3)
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
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  })
}

test('verified workflow links stay external and unresolved workflows cannot navigate', async ({
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
  for (const demo of ['swap', 'reframe'])
    await expect(
      page.locator(`[data-vfx-demo="${demo}"] [data-try-workflow]`)
    ).toBeDisabled()
})

for (const mobile of [false, true]) {
  test(`capability sections alternate desktop columns with copy first on mobile${mobile ? ' @mobile' : ''}`, async ({
    page
  }) => {
    await page.setViewportSize({ width: mobile ? 390 : 1440, height: 1000 })
    await page.goto('/solutions/vfx/v3/')
    for (const [demo, reversed] of [
      ['relight', false],
      ['swap', true],
      ['reframe', false],
      ['sequence', true]
    ] as const) {
      const section = page.locator(`[data-vfx-demo="${demo}"]`)
      const copy = await section.locator('.vfx-section-top').boundingBox()
      const visual = await section.locator('.vfx-canvas-window').boundingBox()
      expect(copy).not.toBeNull()
      expect(visual).not.toBeNull()
      if (!copy || !visual) continue
      if (mobile) expect(copy.y + copy.height).toBeLessThanOrEqual(visual.y)
      else if (reversed)
        expect(visual.x + visual.width).toBeLessThanOrEqual(copy.x)
      else expect(copy.x + copy.width).toBeLessThanOrEqual(visual.x)
    }
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
  await section.evaluate((node) => {
    node.dispatchEvent(
      new CustomEvent('workflow-time-change', { detail: { time: 1.25 } })
    )
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
    .getByRole('button', { name: '← BACK TO EXAMPLES', exact: true })
    .click()
  await expect
    .poll(() =>
      graphVideo.evaluate((video: HTMLVideoElement) => video.currentTime)
    )
    .toBeCloseTo(1.25, 1)
})

test('workflow wires follow socket centers and examples stay in a single whole-frame panel across resize', async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/solutions/vfx/v3/')
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const demo of ['relight', 'swap', 'reframe', 'sequence']) {
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
      for (const media of await panel
        .locator(
          '.vfx-source-node video, .vfx-source-node img, .vfx-keyframe-node img, .vfx-main-node video, .vfx-main-node img, .vfx-versions img'
        )
        .all())
        await expect(media).toHaveCSS('object-fit', 'contain')
    }
  }
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
    back: '← BACK TO EXAMPLES',
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
    back: '← 返回示例',
    expose: '查看工作流',
    reference: '参考帧',
    mobile: true
  }
]) {
  test(`${path} sequence uses its reference and returns from the shared Studio with its selected shot${mobile ? ' @mobile' : ''}`, async ({
    page
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 })
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
      section.locator('.vfx-keyframe-node .ppformula-text-center')
    ).toHaveText(reference)
    await section.getByRole('button', { name: push, exact: true }).click()
    await expect(section.locator('.vfx-main-node video')).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27/seedance_push.mp4'
    )
    await expect(
      section.locator('.vfx-main-node .ppformula-text-center')
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
    await expect(studio.locator('button[disabled]')).toHaveCount(2)
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
      section.locator('.vfx-main-node .ppformula-text-center')
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
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  })
}
