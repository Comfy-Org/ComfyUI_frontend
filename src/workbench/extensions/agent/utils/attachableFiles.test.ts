import { describe, expect, it } from 'vitest'

import {
  AGENT_ATTACH_ACCEPT,
  isAgentAttachable,
  isValidAgentAttachment
} from './attachableFiles'

/* Dragged files often carry no MIME (glb, md) or a generic one, so the
   predicate must hold with an empty type. */
function fileNamed(name: string): File {
  return new File(['x'], name, { type: '' })
}

describe('isAgentAttachable', () => {
  it.for([
    'clip.mp4',
    'voice.m4a',
    'movie.mov',
    'song.mp3',
    'sound.wav',
    'mesh.glb',
    'notes.md',
    'prompt.txt'
  ])('accepts %s regardless of MIME type', (name) => {
    expect(isAgentAttachable(fileNamed(name))).toBe(true)
  })

  it('accepts every image and audio kind, not only the named extensions', () => {
    expect(isAgentAttachable(fileNamed('picture.webp'))).toBe(true)
    expect(isAgentAttachable(fileNamed('music.flac'))).toBe(true)
  })

  it('rejects unsupported formats', () => {
    expect(isAgentAttachable(fileNamed('archive.zip'))).toBe(false)
    expect(isAgentAttachable(fileNamed('binary.exe'))).toBe(false)
    expect(isAgentAttachable(fileNamed('noextension'))).toBe(false)
  })

  it('names every approved extension in the picker accept list', () => {
    const accepted = AGENT_ATTACH_ACCEPT.split(',')

    expect(new Set(accepted)).toEqual(
      new Set([
        'image/*',
        'video/*',
        'audio/*',
        '.mp4',
        '.m4a',
        '.mov',
        '.mp3',
        '.wav',
        '.glb',
        '.md',
        '.txt',
        '.json',
        'application/json'
      ])
    )
    expect(accepted).toHaveLength(13)
  })

  it('rejects .json despite it being in the picker accept list, so a dropped workflow file still falls through to the graph loader', () => {
    expect(isAgentAttachable(fileNamed('workflow.json'))).toBe(false)
  })
})

describe('isValidAgentAttachment', () => {
  it.for([
    { name: 'clip.mp4', bytes: [0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70] },
    { name: 'clip.mov', bytes: [0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70] },
    { name: 'clip.webm', bytes: [0x1a, 0x45, 0xdf, 0xa3] },
    { name: 'clip.mkv', bytes: [0x1a, 0x45, 0xdf, 0xa3] },
    {
      name: 'clip.avi',
      bytes: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]
    }
  ])('accepts a valid $name container signature', async ({ name, bytes }) => {
    await expect(
      isValidAgentAttachment(new File([new Uint8Array(bytes)], name))
    ).resolves.toBe(true)
  })

  it('rejects text renamed to an mp4 file', async () => {
    await expect(
      isValidAgentAttachment(new File(['not a video'], 'renamed.mp4'))
    ).resolves.toBe(false)
  })

  it('does not inspect non-video attachments', async () => {
    await expect(
      isValidAgentAttachment(new File(['plain text'], 'notes.txt'))
    ).resolves.toBe(true)
  })
})
