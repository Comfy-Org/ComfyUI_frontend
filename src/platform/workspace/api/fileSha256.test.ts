import { describe, expect, it } from 'vitest'

import { fileSha256 } from './fileSha256'

async function webCryptoSha256(
  bytes: Uint8Array<ArrayBuffer>
): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

describe('fileSha256', () => {
  it.for([
    {
      text: '',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    },
    {
      text: 'abc',
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    },
    {
      text: 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      sha256: '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    }
  ])('hashes "$text" like the published vector', async (vector) => {
    await expect(fileSha256(new Blob([vector.text]))).resolves.toBe(
      vector.sha256
    )
  })

  it('reads a file larger than one read in pieces and hashes it whole', async () => {
    const bytes = new Uint8Array(4 * 1024 * 1024 + 1000)
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + 7) % 251

    await expect(fileSha256(new Blob([bytes]))).resolves.toBe(
      await webCryptoSha256(bytes)
    )
  })

  it('stops reading once the upload is canceled', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      fileSha256(new Blob(['model bytes']), controller.signal)
    ).resolves.toBeUndefined()
  })
})
