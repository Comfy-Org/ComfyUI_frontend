import { gunzipSync } from 'node:zlib'

import { expect } from '@playwright/test'
import { z } from 'zod'

import availability from '../src/data/workshop-model-availability.json' with { type: 'json' }
import { workshopModelAvailabilitySchema } from '../src/config/workshop-model-availability-schema'
import { test } from './fixtures/modelsAccount'

test.use({
  launchOptions: { args: ['--disable-blink-features=AutomationControlled'] }
})

const slug = 'byteplus--seed-audio-1.0--audio'
const disabled =
  workshopModelAvailabilitySchema.parse(availability)[slug]?.disabled
const eventSchema = z.object({
  event: z.string(),
  properties: z.record(z.string(), z.unknown())
})

test(
  disabled
    ? 'audio delivery target is intentionally withheld'
    : 'untouched audio never times out, but stalled playback does',
  async ({ context, page, modelsAccount }) => {
    if (disabled) {
      expect((await page.goto(`/models/${slug}/`))?.status()).toBe(404)
      return
    }
    const captured: z.infer<typeof eventSchema>[] = []
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
        const events: unknown = JSON.parse(decoded)
        captured.push(
          ...z
            .array(eventSchema)
            .parse(Array.isArray(events) ? events : [events])
        )
        await route.fulfill({ json: { status: 1 } })
      }
    )
    const requestId = 'f0b55482-d90f-4c9f-8fda-351ece95aaee'
    const audioUrl = 'https://output.example/generated.wav'
    await context.route(
      'https://media.comfy.org/website/workshop/byteplus/seed-audio-1.0/*.mp3',
      (route) => route.fulfill({ contentType: 'audio/mpeg', body: '' })
    )
    await context.route(
      '**/v2/models/byteplus/seed-audio-1.0/requests**',
      (route) =>
        route.fulfill(
          route.request().method() === 'POST'
            ? {
                status: 201,
                json: { request_id: requestId, status: 'IN_QUEUE' }
              }
            : { json: { url: audioUrl } }
        )
    )
    const release = Promise.withResolvers<void>()
    await context.route(audioUrl, async (route) => {
      await release.promise
      await route.abort()
    })
    try {
      const browserSession = await context.newCDPSession(page)
      await browserSession.send('Emulation.setUserAgentOverride', {
        userAgent: await page.evaluate(() => navigator.userAgent)
      })
      await page.clock.install()
      await page.goto('/login/')
      await page.getByRole('button', { name: 'Use email instead' }).click()
      await page.getByLabel('Email').fill(modelsAccount.email)
      await page
        .getByLabel('Password', { exact: true })
        .fill(modelsAccount.password)
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await expect(page).toHaveURL('/')
      await page.goto(`/models/${slug}/`)
      await expect(page.getByTestId('run-button')).toBeEnabled()
      await page.getByTestId('run-button').click()
      await expect(page.getByTestId('playground-output')).toHaveAttribute(
        'data-state',
        'succeeded'
      )
      const audio = page.getByTestId('output-audio')
      await expect(audio).toHaveAttribute('src', audioUrl)
      await page.clock.fastForward(120_000)
      await page.clock.runFor(5_000)
      await expect
        .poll(() => captured)
        .toContainEqual(
          expect.objectContaining({
            event: 'website:workshop_run_finished',
            properties: expect.objectContaining({
              status: 'succeeded',
              request_id: requestId
            })
          })
        )
      expect(
        captured.filter(
          ({ event }) => event === 'website:workshop_delivery_finished'
        )
      ).toEqual([])

      await page.getByRole('button', { name: 'Play', exact: true }).click()
      await expect(audio).toHaveJSProperty('paused', false)
      await expect(audio).toHaveJSProperty('readyState', 0)
      await page.clock.fastForward(120_000)
      await page.clock.runFor(5_000)
      const deliveries = () =>
        captured.filter(
          ({ event }) => event === 'website:workshop_delivery_finished'
        )
      await expect.poll(deliveries).toHaveLength(1)
      expect(deliveries()[0].properties).toMatchObject({
        request_id: requestId,
        output_kind: 'audio',
        status: 'failed',
        reason: 'media_timeout'
      })
      expect(deliveries()[0].properties.duration_ms).toBeGreaterThanOrEqual(
        120_000
      )
      expect(deliveries()[0].properties.duration_ms).toBeLessThan(125_000)
    } finally {
      release.resolve()
    }
  }
)
