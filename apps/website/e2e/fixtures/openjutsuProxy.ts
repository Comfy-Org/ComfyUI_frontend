import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Page, Request, Route } from '@playwright/test'
import { expect } from '@playwright/test'

import { websiteRoot } from '@website/paths'

type Answer = Parameters<Route['fulfill']>[0]

const QUOTE = {
  free_runs_remaining: 0,
  resets_at: null,
  price_credits: 0,
  price_per_second: {
    tier_input: 'resolution',
    tier_match: 'exact',
    credits: { '480': 8, '768': 16 }
  },
  next_run: 'paid'
}

const SWAP_JOB = {
  id: 'e2e-openjutsu-swap',
  status: 'succeeded',
  outputs: [{ id: 'out', filename: 'openjutsu/result_00001_.mp4' }]
}

export async function mockOpenjutsuProxy(page: Page, workspaceToken: string) {
  const calls: string[] = []
  const result = readFileSync(
    join(websiteRoot, 'e2e/assets/validation-16s.mp4')
  )
  let uploads = 0
  const answers = new Map<string, (request: Request) => Answer>(
    Object.entries({
      'GET /quote': () => ({ json: QUOTE }),
      'POST /assets': () => ({
        json: { file_path: `openjutsu-e2e-${++uploads}` }
      }),
      'POST /jobs': (request: Request) => {
        const sent = request.postData() ?? ''
        expect(sent).toContain('H3CharacterSwapPrepareVideo')
        expect(sent).toContain('"resolution":768')
        expect(sent).toContain('"use_anchor":false')
        return { json: SWAP_JOB }
      },
      [`GET /jobs/${SWAP_JOB.id}`]: () => ({ json: SWAP_JOB }),
      [`GET /jobs/${SWAP_JOB.id}/outputs/out/content`]: () => ({
        contentType: 'video/mp4',
        body: result
      })
    })
  )
  await page.route(/\/v2\/models\/openai\/gpt-image-2\.5-sunburst/, (route) =>
    route.fulfill({ status: 503, json: { error_type: 'unavailable' } })
  )
  await page.route(/\/app-proxy\/[^/]+\//, async (route: Route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace(
      /^.*\/app-proxy\/[^/]+/,
      ''
    )
    const call = `${request.method()} ${path}`
    calls.push(call)
    expect(request.headers()['authorization']).toBe(`Bearer ${workspaceToken}`)
    const answer = answers.get(call)
    return route.fulfill(
      answer
        ? answer(request)
        : { status: 404, json: { error_type: 'not_found' } }
    )
  })
  return calls
}
