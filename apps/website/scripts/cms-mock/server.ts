import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'

import type { MockReply, SeedEntry } from '@/lib/cms/mock-ingest'
import { createMockIngest } from '@/lib/cms/mock-ingest'

async function readBody(req: IncomingMessage) {
  let raw = ''
  for await (const chunk of req) raw += chunk
  return raw
}

function send(res: ServerResponse, [status, body]: MockReply) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(body === undefined ? '' : JSON.stringify(body))
}

export function startMockIngest(seedPath: string, port: number) {
  const seed: SeedEntry[] = JSON.parse(readFileSync(seedPath, 'utf8'))
  const route = createMockIngest(seed)
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    send(
      res,
      route(req.method, url, req.headers.authorization, await readBody(req))
    )
  }).listen(port)
}
