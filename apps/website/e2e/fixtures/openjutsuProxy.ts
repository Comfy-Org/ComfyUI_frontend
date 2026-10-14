import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Page, Request, Route } from '@playwright/test'
import { expect } from '@playwright/test'

import { websiteRoot } from '@website/paths'

/**
 * comfy-api's app proxy for Openjutsu, answering as a warm deployment: the
 * swap succeeds as soon as it is submitted and its output is a small real
 * video, so the page lands on a result it can play.
 */

type Answer = Parameters<Route['fulfill']>[0]

/** A paid quote as the catalog prices Openjutsu: per frame, one tier. */
const QUOTE = {
  free_runs_remaining: 0,
  resets_at: null,
  price_credits: 0,
  price_per_second: { tier_input: 'seed', credits: { '0': 1.0416666666 } },
  next_run: 'paid'
}

const SWAP_JOB = {
  id: 'e2e-openjutsu-swap',
  status: 'succeeded',
  outputs: [{ id: 'out', filename: 'openjutsu/result_00001_.mp4' }]
}

/**
 * Answers the Openjutsu app proxy on any Router origin and proxy id. Every
 * request must carry the workspace token the signed-in session minted.
 * Returns the `METHOD path` of each call, in order, below the proxy id.
 */
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
        expect(sent).toContain('MiniMaxH3ReferenceToVideo')
        expect(sent).toContain('VideoFrameSample')
        return { json: SWAP_JOB }
      },
      [`GET /jobs/${SWAP_JOB.id}`]: () => ({ json: SWAP_JOB }),
      [`GET /jobs/${SWAP_JOB.id}/outputs/out/content`]: () => ({
        contentType: 'video/mp4',
        body: result
      })
    })
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
