import { deflateSync } from 'node:zlib'

import type { Page, Request, Route } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * comfy-api's app proxy for Re-shoot, answering as a warm deployment: the
 * analyze job succeeds as soon as it is submitted and its output is a small
 * but well-formed `.cvgeo`, so the page reads a real scene end to end.
 */

/** An 8x8 baseline JPEG, the frame image a `.cvgeo` carries per frame. */
const FRAME_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAgAAAQABAAD//gAPTGF2YzYzLjEuMTAxAP/bAEMACBQUFxQXGxsbGxsbIB4gISEhICAgICEhISQkJCoqKiQkJCEhJCQoKCoqLi8uKysqKy8vMjIyPDw5OUZGSFZWZ//EAEwAAQEAAAAAAAAAAAAAAAAAAAAGAQEBAAAAAAAAAAAAAAAAAAAFBhABAAAAAAAAAAAAAAAAAAAAABEBAAAAAAAAAAAAAAAAAAAAAP/AABEIAAgACAMBIgACEQADEQD/2gAMAwEAAhEDEQA/AJsBRAX/2Q==',
  'base64'
)

/** 2.0 as an IEEE half float: the depth, in metres, of every pixel. */
const TWO_METRES_HALF = 0x4000

/**
 * The file CrossViewGeometryExport writes (see reshoot-engine/cvgeo.ts): the
 * magic, a little-endian header length, a JSON header, then the frame JPEGs
 * and the zlib-deflated depth planes with each half's low bytes before its
 * high bytes.
 */
function reshootGeometry({ frames = 2, width = 8, height = 8 } = {}): Buffer {
  const count = frames * width * height
  const planes = Buffer.alloc(2 * count)
  planes.fill(TWO_METRES_HALF & 0xff, 0, count)
  planes.fill(TWO_METRES_HALF >> 8, count)
  const depth = deflateSync(planes)
  const jpegs = Buffer.concat(Array.from({ length: frames }, () => FRAME_JPEG))
  const header = Buffer.from(
    JSON.stringify({
      version: 1,
      frames,
      width,
      height,
      fps: 24,
      source_width: 864,
      source_height: 480,
      fx_norm: null,
      jpegs: Array.from({ length: frames }, (_, i) => ({
        offset: i * FRAME_JPEG.length,
        length: FRAME_JPEG.length
      })),
      depth: {
        offset: jpegs.length,
        length: depth.length,
        dtype: 'float16',
        shape: [frames, height, width],
        encoding: 'shuffle2+zlib'
      }
    })
  )
  const length = Buffer.alloc(4)
  length.writeUInt32LE(header.length)
  return Buffer.concat([
    Buffer.from('CVGEO1\0\0', 'latin1'),
    length,
    header,
    jpegs,
    depth
  ])
}

type Answer = Parameters<Route['fulfill']>[0]

const QUOTE = {
  free_runs_allowance: { runs: 5, period: 'P7D', period_seconds: 604_800 },
  free_runs_remaining: 3,
  resets_at: null,
  price_credits: 40,
  next_run: 'free'
}

const ANALYZE_JOB = {
  id: 'e2e-reshoot-analyze',
  status: 'succeeded',
  outputs: [{ id: 'geo', filename: 'crossview/geometry.cvgeo' }]
}

/**
 * Answers the Re-shoot app proxy on any Router origin and proxy id. Every
 * request must carry the workspace token the signed-in session minted.
 * Returns the `METHOD path` of each call, in order, below the proxy id.
 */
export async function mockReshootProxy(page: Page, workspaceToken: string) {
  const calls: string[] = []
  const geometry = reshootGeometry()
  const answers = new Map<string, (request: Request) => Answer>(
    Object.entries({
      'GET /quote': () => ({ json: QUOTE }),
      'POST /assets': () => ({ json: { file_path: 'crossview-e2e.mp4' } }),
      'POST /jobs': (request: Request) => {
        expect(request.postData()).toContain('CrossViewGeometryExport')
        return { json: ANALYZE_JOB }
      },
      [`GET /jobs/${ANALYZE_JOB.id}`]: () => ({ json: ANALYZE_JOB }),
      [`GET /jobs/${ANALYZE_JOB.id}/outputs/geo/content`]: () => ({
        contentType: 'application/octet-stream',
        body: geometry
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
