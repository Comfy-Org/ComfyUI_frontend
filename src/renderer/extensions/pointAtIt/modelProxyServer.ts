import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { pathToFileURL } from 'node:url'

import { MODEL_PROXY_PORT } from './core/modelWire'
import { handleProxyRequest, parseConfig } from './modelProxy'
import type { ProxyConfig, ProxyReply } from './modelProxy'

const LOOPBACK = '127.0.0.1'

async function readBody(incoming: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of incoming) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

async function writeReply(
  outgoing: ServerResponse,
  reply: ProxyReply
): Promise<void> {
  outgoing.writeHead(reply.status, reply.headers)
  if (typeof reply.body === 'string') {
    outgoing.end(reply.body)
    return
  }
  const reader = reply.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    outgoing.write(value)
  }
  outgoing.end()
}

async function answer(
  config: ProxyConfig,
  upstream: typeof fetch,
  incoming: IncomingMessage,
  outgoing: ServerResponse
): Promise<void> {
  const startedAt = Date.now()
  const call = new AbortController()
  outgoing.on('close', () => call.abort())
  const reply = await handleProxyRequest(
    {
      method: incoming.method ?? 'GET',
      path: incoming.url ?? '/',
      origin: incoming.headers.origin,
      body: await readBody(incoming)
    },
    { config, fetch: upstream, signal: call.signal }
  )
  await writeReply(outgoing, reply)
  process.stdout.write(
    `${incoming.method} ${incoming.url} -> ${reply.status} after ${Date.now() - startedAt} ms\n`
  )
}

/** Starts the proxy on the loopback interface only. */
export function startModelProxy(
  config: ProxyConfig,
  port = MODEL_PROXY_PORT,
  upstream: typeof fetch = fetch
): Server {
  const server = createServer((incoming, outgoing) => {
    answer(config, upstream, incoming, outgoing).catch(() => outgoing.destroy())
  })
  server.listen(port, LOOPBACK)
  return server
}

function main(configPath: string | undefined): void {
  if (!configPath) {
    process.stderr.write('Pass the path of the config file.\n')
    process.exitCode = 1
    return
  }
  const config = parseConfig(readFileSync(configPath, 'utf8'))
  startModelProxy(config)
  process.stdout.write(
    [
      `Point-at-it model proxy on http://${LOOPBACK}:${MODEL_PROXY_PORT}`,
      `  model: ${config.model || 'EMPTY (fill OPENROUTER_MODEL in the config file)'}`,
      `  key: ${config.apiKey ? 'set' : 'EMPTY (fill OPENROUTER_API_KEY in the config file)'}`,
      'Restart after changing the config file. Close this window to stop it.',
      ''
    ].join('\n')
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main(process.argv[2])
