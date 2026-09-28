import { gunzipSync } from 'node:zlib'

import type { BrowserContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { z } from 'zod'

import { test } from './fixtures/blockExternalMedia'

test.use({
  launchOptions: { args: ['--disable-blink-features=AutomationControlled'] }
})

const analyticsSchema = z.array(
  z.object({
    event: z.string(),
    properties: z.object({
      question: z.string().optional(),
      video: z.string().optional()
    })
  })
)

async function captureAnalytics(context: BrowserContext) {
  const events: z.infer<typeof analyticsSchema> = []
  await context.route(
    (url) => url.hostname === 't.comfy.org' && url.pathname.endsWith('/e/'),
    async (route) => {
      const body = route.request().postDataBuffer()
      if (!body) throw new Error('Missing analytics request body')
      const base64 = new URLSearchParams(body.toString()).get('data')
      const decoded =
        body[0] === 0x1f && body[1] === 0x8b
          ? gunzipSync(body).toString()
          : base64
            ? Buffer.from(base64, 'base64').toString()
            : body.toString()
      const payload: unknown = JSON.parse(decoded)
      events.push(
        ...analyticsSchema.parse(Array.isArray(payload) ? payload : [payload])
      )
      await route.fulfill({ json: { status: 1 } })
    }
  )
  return events
}

function eventProperties(
  events: z.infer<typeof analyticsSchema>,
  name: string,
  property: 'question' | 'video'
) {
  return events
    .filter((event) => event.event === name)
    .map((event) => event.properties[property])
}

async function assertVisitAnalytics(page: Page, phase: string) {
  await test.step(`FAQ: ${phase}`, async () => {
    const faq = page.locator('[data-faq]').nth(1)
    await faq.locator('summary').click()
    await expect(faq).toHaveAttribute('open', '')
    await faq.locator('summary').click()
    await expect(faq).not.toHaveAttribute('open', '')
  })

  await test.step(`Video: ${phase}`, async () => {
    const video = page.locator('#usecase-videos video').first()
    await video.scrollIntoViewIfNeeded()
    await expect(
      page.locator('#usecase-videos astro-island').first()
    ).not.toHaveAttribute('ssr')
    await expect(video).toBeVisible()
    await expect(video).toHaveJSProperty('paused', true)
    await video.evaluate(async (element) => {
      if (element instanceof HTMLVideoElement) await element.play()
    })
  })
}

test('agent analytics survive two Astro return visits without duplicates', async ({
  context,
  page
}) => {
  const events = await captureAnalytics(context)
  const browserSession = await context.newCDPSession(page)
  await browserSession.send('Emulation.setUserAgentOverride', {
    userAgent: await page.evaluate(() => navigator.userAgent)
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/agent')
  const timeOrigin = await page.evaluate(() => performance.timeOrigin)
  for (const visit of [0, 1, 2]) {
    const phase = visit === 0 ? 'initial visit' : `repeat visit ${visit}`
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin)
    await assertVisitAnalytics(page, phase)
    await test.step(`Breadcrumb: ${phase}`, async () => {
      await page
        .getByRole('navigation', { name: 'Breadcrumb' })
        .getByRole('link', { name: 'Home' })
        .click()
      await expect(page).toHaveURL('/')
      if (visit === 2) return
      await page
        .getByRole('contentinfo')
        .getByRole('link', { name: 'Comfy Agent' })
        .click()
      await expect(page).toHaveURL(/\/agent\/?$/)
    })
  }
  await expect
    .poll(
      () => eventProperties(events, 'website:agent_faq_expanded', 'question'),
      {
        timeout: 15_000
      }
    )
    .toEqual([
      'What model powers it?',
      'What model powers it?',
      'What model powers it?'
    ])
  await expect
    .poll(
      () =>
        eventProperties(events, 'website:agent_usecase_video_played', 'video'),
      {
        timeout: 15_000
      }
    )
    .toEqual([
      'Animation, from story to screen — by 852話 | Andidea',
      'Animation, from story to screen — by 852話 | Andidea',
      'Animation, from story to screen — by 852話 | Andidea'
    ])
})

test('mobile hides the hero workflow while keeping the page usable @mobile', async ({
  page
}) => {
  await page.goto('/agent')
  await expect(page.locator('.wf-showcase')).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Try Comfy Agent', exact: true }).first()
  ).toBeVisible()
})

test.describe('agent workflow motion', () => {
  test('reduced motion shows a static workflow without loading videos', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/agent')
    const workflow = page.locator('workflow-examples')
    await workflow.scrollIntoViewIfNeeded()
    await expect(workflow.locator('.wf-scene')).toBeVisible()
    await expect(workflow.locator('video')).toHaveCount(2)
    expect(
      await workflow
        .locator('video')
        .evaluateAll((videos: HTMLVideoElement[]) =>
          videos.every((video) => video.paused && !video.hasAttribute('src'))
        )
    ).toBe(true)
    expect(
      await workflow
        .locator('video')
        .evaluateAll((videos) =>
          videos.map((video) => video.getAttribute('poster'))
        )
    ).toEqual([
      'https://media.comfy.org/website/comfy-agent/conditioner/motion-reference-poster.webp',
      'https://media.comfy.org/website/comfy-agent/conditioner/keyframe-purple.webp'
    ])
    await expect
      .poll(() =>
        workflow
          .locator('.wf-scene')
          .evaluate((scene) => scene.getAnimations({ subtree: true }).length)
      )
      .toBe(0)
  })

  test('offscreen playback resumes in place, but reduced motion restores the poster until the next cue', async ({
    page
  }) => {
    await page.goto('/agent')
    const workflow = page.locator('workflow-examples')
    const video = workflow.locator('video').first()
    await workflow.scrollIntoViewIfNeeded()
    await expect(video).toHaveAttribute('src', /motion-reference\.mp4$/, {
      timeout: 15_000
    })
    await expect(video).toHaveJSProperty('paused', false)
    await expect
      .poll(() =>
        video.evaluate((element: HTMLVideoElement) => element.currentTime)
      )
      .toBeGreaterThan(0)
    await page.locator('footer').scrollIntoViewIfNeeded()
    await expect(video).toHaveJSProperty('paused', true)
    const pausedAt = await video.evaluate(
      (element: HTMLVideoElement) => element.currentTime
    )
    expect(pausedAt).toBeGreaterThan(0)
    await workflow.scrollIntoViewIfNeeded()
    await expect(video).toHaveJSProperty('paused', false)
    expect(
      await video.evaluate((element: HTMLVideoElement) => element.currentTime)
    ).toBeGreaterThanOrEqual(pausedAt)

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(video).not.toHaveAttribute('src')
    await expect(video).toHaveJSProperty('paused', true)
    await expect(video).toHaveJSProperty('currentTime', 0)
    await expect(video).toHaveAttribute('poster', /\.webp$/)
    await expect
      .poll(() =>
        workflow.evaluate(
          (element) => element.getAnimations({ subtree: true }).length
        )
      )
      .toBe(0)

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(video).not.toHaveAttribute('src')
    await expect(video).toHaveJSProperty('paused', true)
    await expect(video).toHaveAttribute('src', /motion-reference\.mp4$/, {
      timeout: 15_000
    })
    await expect(video).toHaveJSProperty('paused', false)
  })
})
