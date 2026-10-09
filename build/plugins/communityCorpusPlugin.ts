import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

export function communityCorpusPlugin(
  directory: string | undefined,
  backend: string
): Plugin {
  async function serve(request: IncomingMessage, response: ServerResponse) {
    const path = new URL(request.url ?? '/', 'http://qa.invalid').pathname
    const match =
      /^\/api\/community-corpus\/(index\.json|[a-f0-9]{64}\/(?:detail|workflow(?:\.cloud)?)\.json)$/.exec(
        path
      )
    if (!match) {
      response.writeHead(404).end()
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end()
      return
    }
    if (!request.headers.authorization && !request.headers.cookie) {
      response.writeHead(401).end()
      return
    }
    const headers = new Headers()
    for (const [name, value] of Object.entries(request.headers)) {
      if (value && !['host', 'connection', 'content-length'].includes(name))
        headers.set(name, Array.isArray(value) ? value.join(', ') : value)
    }
    try {
      const authorized = await fetch(
        new URL('/api/test-workflow-library/collections', backend),
        {
          headers,
          redirect: 'manual',
          signal: AbortSignal.timeout(10_000)
        }
      )
      await authorized.body?.cancel()
      if (!authorized.ok) {
        response
          .writeHead(
            authorized.status === 401 || authorized.status === 403
              ? authorized.status
              : 503
          )
          .end()
        return
      }
      if (!directory) {
        response.writeHead(404).end()
        return
      }
      const body = await readFile(resolve(directory, match[1]))
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      })
      response.end(request.method === 'HEAD' ? undefined : body)
    } catch {
      response.writeHead(503).end()
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
