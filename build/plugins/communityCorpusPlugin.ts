import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { open } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import {
  zTestWorkflowCollection,
  zTestWorkflowCollections,
  zTestWorkflowPage,
  zTestWorkflowSummary
} from '@comfyorg/ingest-types/test-workflows/zod'
import type { Plugin } from 'vite'
import { z } from 'zod/v3'

const maxJSONBytes = 8 * 1024 * 1024
const pageLimit = 50
const digest = /^[a-f0-9]{64}$/
const indexSchema = z.object({
  entries: z.array(zTestWorkflowSummary).min(1).max(10_000)
})

type CorpusBinding = {
  collection: string | undefined
  indexSha256: string | undefined
}

class CorpusFailure extends Error {
  constructor(readonly status: number) {
    super('Community corpus unavailable')
  }
}

async function readBoundedFile(path: string) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const stat = await file.stat()
    if (!stat.isFile() || stat.size > maxJSONBytes) throw new CorpusFailure(503)
    const body = Buffer.alloc(stat.size + 1)
    let size = 0
    while (size < body.length) {
      const { bytesRead } = await file.read(body, size, body.length - size)
      if (!bytesRead) break
      size += bytesRead
    }
    if (size !== stat.size) throw new CorpusFailure(503)
    return body.subarray(0, size)
  } finally {
    await file.close()
  }
}

async function readBackendJSON(
  url: URL,
  headers: Headers,
  signal: AbortSignal
): Promise<unknown> {
  const response = await fetch(url, { headers, redirect: 'manual', signal })
  if (response.status !== 200) {
    await response.body?.cancel()
    throw new CorpusFailure(
      response.status === 401 || response.status === 403 ? response.status : 503
    )
  }
  const reader = response.body?.getReader()
  if (!reader) throw new CorpusFailure(503)
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxJSONBytes) throw new CorpusFailure(503)
      chunks.push(value)
    }
  } finally {
    await reader.cancel()
    reader.releaseLock()
  }
  return JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
  )
}

export function createCommunityCorpusHandler(
  directory: string | undefined,
  backend: string,
  binding?: CorpusBinding
) {
  return async (request: Request): Promise<Response> => {
    const match =
      /^\/api\/community-corpus\/(index\.json|([a-f0-9]{64})\/(?:detail|workflow(?:\.cloud)?)\.json)$/.exec(
        new URL(request.url).pathname
      )
    const unavailable = (status: number) =>
      new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })
    if (!directory || !match) return unavailable(404)
    if (!['GET', 'HEAD'].includes(request.method)) return unavailable(405)
    const headers = new Headers()
    for (const name of ['authorization', 'cookie', 'comfy-user', 'x-api-key']) {
      const value = request.headers.get(name)
      if (value) headers.set(name, value)
    }
    if (
      !headers.has('authorization') &&
      !headers.has('cookie') &&
      !headers.has('x-api-key')
    )
      return unavailable(401)
    const collection = zTestWorkflowCollection.safeParse(binding?.collection)
    if (
      !collection.success ||
      !binding?.indexSha256 ||
      !digest.test(binding.indexSha256)
    )
      return unavailable(503)
    try {
      const signal = AbortSignal.timeout(10_000)
      const collections = zTestWorkflowCollections.parse(
        await readBackendJSON(
          new URL('/api/test-workflow-library/collections', backend),
          headers,
          signal
        )
      )
      const selected = collections.collections.filter(
        ({ id }) => id === collection.data
      )
      if (selected.length !== 1) return unavailable(403)
      const indexBytes = await readBoundedFile(resolve(directory, 'index.json'))
      if (
        createHash('sha256').update(indexBytes).digest('hex') !==
        binding.indexSha256
      )
        return unavailable(503)
      const index = indexSchema.parse(
        JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(indexBytes))
      )
      const expected = new Set(
        index.entries.map(({ workflow_sha256 }) => workflow_sha256)
      )
      if (
        expected.size !== index.entries.length ||
        [...expected].some((id) => !digest.test(id)) ||
        selected[0].count !== expected.size
      )
        return unavailable(503)
      const seen = new Set<string>()
      const cursors = new Set<string>()
      let cursor = ''
      do {
        const url = new URL(
          `/api/test-workflow-library/collections/${collection.data}/entries`,
          backend
        )
        url.searchParams.set('limit', String(pageLimit))
        if (cursor) url.searchParams.set('cursor', cursor)
        const page = zTestWorkflowPage.parse(
          await readBackendJSON(url, headers, signal)
        )
        if (
          page.total !== expected.size ||
          !page.entries.length ||
          page.entries.length > pageLimit
        )
          return unavailable(503)
        for (const entry of page.entries) {
          if (
            !expected.has(entry.workflow_sha256) ||
            seen.has(entry.workflow_sha256)
          )
            return unavailable(503)
          seen.add(entry.workflow_sha256)
        }
        cursor = page.next_cursor
        if (
          cursor &&
          (cursor.length > 4096 ||
            cursors.has(cursor) ||
            seen.size >= expected.size)
        )
          return unavailable(503)
        cursors.add(cursor)
      } while (cursor)
      if (seen.size !== expected.size) return unavailable(503)
      if (match[2] && !expected.has(match[2])) return unavailable(404)
      const body =
        match[1] === 'index.json'
          ? indexBytes
          : await readBoundedFile(resolve(directory, match[1]))
      return new Response(
        request.method === 'HEAD' ? null : new Uint8Array(body),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
          }
        }
      )
    } catch (error) {
      return unavailable(error instanceof CorpusFailure ? error.status : 503)
    }
  }
}

export function communityCorpusPlugin(
  directory: string | undefined,
  backend: string,
  binding?: CorpusBinding
): Plugin {
  const handle = createCommunityCorpusHandler(directory, backend, binding)
  async function serve(request: IncomingMessage, response: ServerResponse) {
    try {
      const headers = new Headers()
      for (const [name, value] of Object.entries(request.headers)) {
        if (value)
          headers.set(name, Array.isArray(value) ? value.join(', ') : value)
      }
      const result = await handle(
        new Request(new URL(request.url ?? '/', 'http://qa.invalid'), {
          method: request.method,
          headers
        })
      )
      response.writeHead(result.status, Object.fromEntries(result.headers))
      response.end(Buffer.from(await result.arrayBuffer()))
    } catch {
      response.writeHead(503, { 'Cache-Control': 'no-store' }).end()
    }
  }
  return {
    name: 'community-qa-corpus',
    configureServer(server) {
      if (!directory) return
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith('/api/community-corpus/')) return next()
        void serve(request, response)
      })
    },
    configurePreviewServer(server) {
      if (!directory) return
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith('/api/community-corpus/')) return next()
        void serve(request, response)
      })
    }
  }
}
