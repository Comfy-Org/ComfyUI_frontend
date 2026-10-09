import { createServer, request } from 'node:http'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { createServer as createViteServer } from 'vite'

import { communityCorpusPlugin } from '../../build/plugins/communityCorpusPlugin'

it('gates the static QA corpus through the existing authenticated backend and denies malformed paths', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'community-qa-'))
  await writeFile(join(directory, 'index.json'), '{"entries":[]}')
  const hash = 'a'.repeat(64)
  await mkdir(join(directory, hash))
  await writeFile(
    join(directory, hash, 'workflow.cloud.json'),
    '{"nodes":[],"links":[]}'
  )
  const authorize = vi.fn().mockResolvedValue(new Response('{}'))
  vi.stubGlobal('fetch', authorize)
  const vite = await createViteServer({
    configFile: false,
    server: { middlewareMode: true },
    plugins: [communityCorpusPlugin(directory, 'http://backend.invalid')]
  })
  const server = createServer(vite.middlewares)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Expected HTTP listener')
  const port = address.port
  function get(path: string, authenticated = false) {
    return new Promise<{ status: number | undefined; body: string }>(
      (resolve, reject) => {
        const outgoing = request(
          {
            hostname: '127.0.0.1',
            port,
            path,
            headers: authenticated
              ? { Authorization: 'Bearer synthetic-test' }
              : {}
          },
          (response) => {
            let body = ''
            response.setEncoding('utf8').on('data', (chunk: string) => {
              body += chunk
            })
            response.on('end', () =>
              resolve({ status: response.statusCode, body })
            )
          }
        )
        outgoing.on('error', reject).end()
      }
    )
  }
  try {
    expect((await get('/api/community-corpus/index.json')).status).toBe(401)
    expect(authorize).not.toHaveBeenCalled()
    expect(await get('/api/community-corpus/index.json', true)).toEqual({
      status: 200,
      body: '{"entries":[]}'
    })
    expect(authorize).toHaveBeenLastCalledWith(
      new URL(
        '/api/test-workflow-library/collections',
        'http://backend.invalid'
      ),
      expect.objectContaining({ redirect: 'manual' })
    )
    expect(
      (await get(`/api/community-corpus/${hash}/workflow.cloud.json`)).status
    ).toBe(401)
    expect(
      await get(`/api/community-corpus/${hash}/workflow.cloud.json`, true)
    ).toEqual({
      status: 200,
      body: '{"nodes":[],"links":[]}'
    })
    authorize.mockResolvedValueOnce(new Response('{}', { status: 403 }))
    expect((await get('/api/community-corpus/index.json', true)).status).toBe(
      403
    )
    expect(
      (await get('/api/community-corpus/%2e%2e/private.json', true)).status
    ).toBe(404)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await vite.close()
    await rm(directory, { recursive: true })
  }
})
