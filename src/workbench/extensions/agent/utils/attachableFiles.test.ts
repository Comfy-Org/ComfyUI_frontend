import { describe, expect, it } from 'vitest'

import { AGENT_ATTACH_ACCEPT, isAgentAttachable } from './attachableFiles'

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
    for (const extension of [
      '.mp4',
      '.m4a',
      '.mov',
      '.mp3',
      '.wav',
      '.glb',
      '.md',
      '.txt'
    ]) {
      expect(AGENT_ATTACH_ACCEPT).toContain(extension)
    }
  })
})
