import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { toLoaderValue, uploadMediaFiles } from './superMedia'

vi.mock(import('@/scripts/api'))

function imageFile(name: string): File {
  return new File(['pixels'], name, { type: 'image/png' })
}

function uploadedName(init: RequestInit | undefined): string {
  const file = init?.body instanceof FormData ? init.body.get('image') : null
  return file instanceof File ? file.name : ''
}

function serveUploads(delayFor: (name: string) => number) {
  vi.mocked(api.fetchApi).mockImplementation(async (_route, init) => {
    const name = uploadedName(init)
    await new Promise((resolve) => setTimeout(resolve, delayFor(name)))
    return new Response(
      JSON.stringify({ name, subfolder: 'supercomfy', type: 'input' })
    )
  })
}

describe('uploadMediaFiles', () => {
  it('keeps the drop order even when later files finish first', async () => {
    vi.useFakeTimers()
    serveUploads((name) => (name === 'first.png' ? 30 : 10))

    const upload = uploadMediaFiles(
      [imageFile('first.png'), imageFile('second.png'), imageFile('third.png')],
      'image'
    )
    await vi.runAllTimersAsync()

    expect(await upload).toEqual({
      ok: true,
      items: ['first.png', 'second.png', 'third.png'].map((filename) => ({
        kind: 'file',
        modality: 'image',
        ref: { filename, subfolder: 'supercomfy', type: 'input' },
        mime: 'image/png'
      }))
    })
  })

  it('uploads into the input folder', async () => {
    serveUploads(() => 0)

    await uploadMediaFiles([imageFile('a.png')], 'image')

    const body = vi.mocked(api.fetchApi).mock.lastCall?.[1]?.body
    expect(body instanceof FormData ? body.get('type') : null).toBe('input')
  })

  it('refuses files that do not fit the node', async () => {
    const outcome = await uploadMediaFiles(
      [new File(['notes'], 'notes.txt', { type: 'text/plain' })],
      'image'
    )

    expect(outcome.ok).toBe(false)
    expect(api.fetchApi).not.toHaveBeenCalled()
  })

  it('reports the server reason when an upload fails', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response(null, { status: 413, statusText: 'Payload Too Large' })
    )

    expect(await uploadMediaFiles([imageFile('big.png')], 'image')).toEqual({
      ok: false,
      reason: '413 - Payload Too Large'
    })
  })
})

describe('toLoaderValue', () => {
  it.for([
    {
      name: 'an uploaded input as a plain path',
      ref: { filename: 'x.png', subfolder: 'supercomfy', type: 'input' },
      expected: 'supercomfy/x.png'
    },
    {
      name: 'an app output with its folder annotation',
      ref: { filename: 'y.png', subfolder: 'run', type: 'output' },
      expected: 'run/y.png [output]'
    }
  ] as const)('writes $name', ({ ref, expected }) => {
    expect(toLoaderValue({ kind: 'file', modality: 'image', ref })).toBe(
      expected
    )
  })
})
