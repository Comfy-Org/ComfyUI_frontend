import { gunzipSync } from 'node:zlib'

import type { BrowserContext } from '@playwright/test'
import { z } from 'zod'

const eventSchema = z.object({
  event: z.string(),
  properties: z.record(z.string(), z.unknown())
})

export type PosthogEvent = z.infer<typeof eventSchema>

export async function capturePosthogEvents(
  context: BrowserContext
): Promise<PosthogEvent[]> {
  const captured: PosthogEvent[] = []
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
        ...z.array(eventSchema).parse(Array.isArray(events) ? events : [events])
      )
      await route.fulfill({ json: { status: 1 } })
    }
  )
  return captured
}
