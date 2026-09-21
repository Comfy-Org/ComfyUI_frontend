import { describe, expect, it } from 'vitest'

import {
  AGENT_ATTACH_ACCEPT,
  attachableClipboardFiles,
  isAgentAttachable
} from './attachableFiles'

/* Dragged files often carry no MIME (glb, md) or a generic one, so the
   predicate must hold with an empty type. */
function fileNamed(name: string): File {
  return new File(['x'], name, { type: '' })
}

function clipboardOf(...files: File[]): DataTransfer {
  const clipboard = new DataTransfer()
  for (const file of files) clipboard.items.add(file)
  return clipboard
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

  it('rejects .json despite it being in the picker accept list, so a dropped workflow file still falls through to the graph loader', () => {
    expect(isAgentAttachable(fileNamed('workflow.json'))).toBe(false)
  })

  it.for([
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
  ])('includes %s in the picker accept list', (format) => {
    expect(AGENT_ATTACH_ACCEPT.split(',')).toContain(format)
  })
})

describe('attachableClipboardFiles', () => {
  it('keeps the original file when the clipboard names it', () => {
    const photo = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    expect(attachableClipboardFiles(clipboardOf(photo))).toEqual([photo])
  })

  it.for([
    ['image/png', 'pasted-image.png'],
    ['image/jpeg', 'pasted-image.jpeg'],
    ['image/webp', 'pasted-image.webp']
  ] as const)('names an unnamed %s screenshot %s', async ([type, expected]) => {
    const [named] = attachableClipboardFiles(
      clipboardOf(new File(['x'], '', { type }))
    )
    expect(named).toMatchObject({ name: expected, type })
    expect(await named.text()).toBe('x')
  })

  it('drops clipboard files the composer cannot attach', () => {
    expect(
      attachableClipboardFiles(
        clipboardOf(
          new File(['x'], 'archive.zip', { type: 'application/zip' }),
          new File(['x'], 'workflow.json', { type: 'application/json' })
        )
      )
    ).toEqual([])
  })

  it('is empty for a text-only clipboard, leaving the paste to the editor', () => {
    expect(attachableClipboardFiles(clipboardOf())).toEqual([])
  })
})
