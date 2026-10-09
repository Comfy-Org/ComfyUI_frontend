import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'

import type { SeedEntry } from '@/lib/cms/mock-ingest'
import { createMockIngest } from '@/lib/cms/mock-ingest'

export function startMockIngest(seedPath: string, port: number) {
  const seed: SeedEntry[] = JSON.parse(readFileSync(seedPath, 'utf8'))
  const route = createMockIngest(seed)
  return createServer(async (req, res) => {
    let raw = ''
    for await (const chunk of req) raw += chunk
    const [status, body] = route(
      req.method ?? 'GET',
      new URL(req.url ?? '/', 'http://localhost'),
      req.headers.authorization ?? null,
      raw
    )
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(body === undefined ? '' : JSON.stringify(body))
  }).listen(port)
}
