import { request } from 'node:http'
import type { Server } from 'node:http'

import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { pointConfig } from './core/config'
import { textToImageNodes } from './core/fakePointHost'
import recordedStream from './core/fixtures/openrouterThinkingStream.recorded.txt?raw'
import { buildChatBody } from './core/modelPrompt'
import { PREVIEW_ORIGIN } from './modelProxy'
import { startModelProxy } from './modelProxyServer'

const config = { apiKey: 'sk-or-test', model: 'anthropic/claude-sonnet-5.5' }

async function listening(server: Server): Promise<number> {
  onTestFinished(() => {
    server.close()
  })
  await new Promise((resolve) => server.once('listening', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('The proxy has no port')
  return address.port
}

function postChat(port: number, body: string) {
  return new Promise<{ status: number; type: string; text: string }>(
    (resolve, reject) => {
      const call = request(
        {
          host: '127.0.0.1',
          port,
          path: '/chat',
          method: 'POST',
          headers: {
            origin: PREVIEW_ORIGIN,
            'content-type': 'application/json'
          }
        },
        (answer) => {
          const chunks: Buffer[] = []
          answer.on('data', (chunk: Buffer) => chunks.push(chunk))
          answer.on('end', () =>
            resolve({
              status: answer.statusCode ?? 0,
              type: String(answer.headers['content-type']),
              text: Buffer.concat(chunks).toString('utf8')
            })
          )
        }
      )
      call.on('error', reject)
      call.end(body)
    }
  )
}

describe('startModelProxy', () => {
  it('L-12: listens on the loopback interface only', async () => {
    const server = startModelProxy({ apiKey: '', model: '' }, 0)
    await listening(server)

    expect(server.address()).toMatchObject({ address: '127.0.0.1' })
  })

  it('L-01: streams the provider’s answer through to the preview unchanged', async () => {
    vi.useRealTimers()
    const encoder = new TextEncoder()
    const middle = Math.floor(recordedStream.length / 2)
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(recordedStream.slice(0, middle)))
            controller.enqueue(encoder.encode(recordedStream.slice(middle)))
            controller.close()
          }
        }),
        { headers: { 'content-type': 'text/event-stream' } }
      )
    )
    const port = await listening(startModelProxy(config, 0, upstream))
    const chat = buildChatBody(
      { kind: 'batch', requestId: 'request-1', annotations: [], history: [] },
      textToImageNodes(),
      pointConfig.model
    )

    const answer = await postChat(port, JSON.stringify(chat))

    expect(answer.status).toBe(200)
    expect(answer.type).toBe('text/event-stream')
    expect(answer.text).toBe(recordedStream)
  })
})
