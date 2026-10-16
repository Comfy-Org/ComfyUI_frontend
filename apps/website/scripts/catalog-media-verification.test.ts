// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { fileMetadata, get } from './catalog-media-verification'
import { readFile } from 'node:fs/promises'
import { probeFile } from './catalog-media-probe'
vi.mock(import('./catalog-media-probe'))
const probe = vi.mocked(probeFile)
vi.mock(import('node:fs/promises'), () => ({ readFile: vi.fn() }))

it('reads only safe local graph paths and revalidates every remote redirect', async () => {
  vi.mocked(readFile).mockResolvedValue(Buffer.from('{}'))
  expect(await get('/workflow-graphs/a.json')).toEqual(Buffer.from('{}'))
  expect(fetch).not.toHaveBeenCalled()
  vi.mocked(fetch).mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: { Location: 'http://127.0.0.1/private' }
    })
  )
  await expect(get('https://media.comfy.org/a.png')).rejects.toThrow(
    'unsupported-source'
  )
  expect(fetch).toHaveBeenCalledTimes(1)
})
it.for([
  'https://evil.test/a',
  'http://media.comfy.org/a',
  'https://user:pass@media.comfy.org/a',
  'https://media.comfy.org/a#x'
])('refuses disallowed source %s', async (url) => {
  await expect(get(url)).rejects.toThrow('unsupported-source')
  expect(fetch).not.toHaveBeenCalled()
})
it('bounds redirects and response size, and preserves HTTP failures', async () => {
  vi.mocked(fetch).mockImplementation(
    async () =>
      new Response(null, { status: 302, headers: { Location: '/again' } })
  )
  await expect(get('https://media.comfy.org/a')).rejects.toThrow(
    'redirect-limit'
  )
  expect(fetch).toHaveBeenCalledTimes(4)
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }))
  await expect(get('https://media.comfy.org/a')).rejects.toThrow('HTTP-404')
  vi.mocked(fetch).mockResolvedValue(
    new Response('small', { headers: { 'Content-Length': String(65 << 20) } })
  )
  await expect(get('https://media.comfy.org/a')).rejects.toThrow('oversized')
  vi.mocked(fetch).mockResolvedValue(new Response('{}'))
  expect(await get('https://media.comfy.org/a')).toEqual(Buffer.from('{}'))
})
it('requires JSON objects without launching a media process', async () => {
  expect(await fileMetadata('a.json', Buffer.from('{}'), '/unused')).toEqual({
    mime: 'application/json',
    width: 0,
    height: 0,
    duration: 0
  })
  for (const value of ['[]', 'null', '1', 'bad'])
    await expect(
      fileMetadata('a.json', Buffer.from(value), '/unused')
    ).rejects.toThrow()
  expect(probe).not.toHaveBeenCalled()
})
function animated() {
  const payload = Buffer.alloc(30)
  payload.write('RIFF', 0)
  payload.writeUInt32LE(22, 4)
  payload.write('WEBPVP8X', 8)
  payload.writeUInt32LE(10, 16)
  payload[20] = 2
  payload.writeUIntLE(959, 24, 3)
  payload.writeUIntLE(539, 27, 3)
  return payload
}
it('verifies animated WebP length and dimensions without ffprobe', async () => {
  const payload = animated()
  expect(await fileMetadata('a.webp', payload, '/unused')).toEqual({
    mime: 'image/webp',
    width: 960,
    height: 540,
    duration: 0
  })
  payload.writeUInt32LE(21, 4)
  await expect(fileMetadata('a.webp', payload, '/unused')).rejects.toThrow(
    'invalid-animated-webp'
  )
  payload.writeUInt32LE(22, 4)
  payload.writeUIntLE(16384, 24, 3)
  await expect(fileMetadata('a.webp', payload, '/unused')).rejects.toThrow(
    'invalid-dimensions'
  )
  expect(probe).not.toHaveBeenCalled()
})
it('checks probed codecs, containers, dimensions and duration', async () => {
  const stream = {
    codec_type: 'video',
    codec_name: 'png',
    width: 960,
    height: 540
  }
  probe.mockResolvedValue({
    stdout: JSON.stringify({
      streams: [stream],
      format: { format_name: 'png_pipe', duration: '8' }
    })
  })
  expect(await fileMetadata('a.png', Buffer.alloc(0), '/fixture')).toEqual({
    mime: 'image/png',
    width: 960,
    height: 540,
    duration: 0
  })
  await expect(
    fileMetadata('a.mp4', Buffer.alloc(0), '/fixture')
  ).rejects.toThrow('invalid-mp4')
  await expect(
    fileMetadata('a.mp3', Buffer.alloc(0), '/fixture')
  ).rejects.toThrow('invalid-mp3')
  await expect(
    fileMetadata('a.gif', Buffer.alloc(0), '/fixture')
  ).rejects.toThrow('unsupported-format')
  probe.mockResolvedValue({
    stdout: JSON.stringify({
      streams: [{ ...stream, codec_name: 'h264' }],
      format: { format_name: 'mov,mp4', duration: '8' }
    })
  })
  expect(await fileMetadata('a.mp4', Buffer.alloc(0), '/fixture')).toEqual({
    mime: 'video/mp4',
    width: 960,
    height: 540,
    duration: 8
  })
  await expect(
    fileMetadata('a.png', Buffer.alloc(0), '/fixture')
  ).rejects.toThrow('image-codec-mismatch')
  probe.mockResolvedValue({
    stdout: JSON.stringify({ streams: [{ ...stream, width: 0 }] })
  })
  await expect(
    fileMetadata('a.png', Buffer.alloc(0), '/fixture')
  ).rejects.toThrow('invalid-dimensions')
})
