import { describe, expect, it, vi } from 'vitest'

import {
  AGENT_ATTACH_ACCEPT,
  attachableClipboardFiles,
  isAgentAttachable,
  isValidAgentAttachment
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

describe('attachableClipboardFiles', () => {
  /* Chromium hands a pasted screenshot over as image.png; the name, not the
     MIME type, is what the attachable check reads. */
  it('takes the screenshot a clipboard carries', () => {
    const screenshot = new File(['x'], 'image.png', { type: 'image/png' })
    expect(attachableClipboardFiles(clipboardOf(screenshot))).toEqual([
      screenshot
    ])
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

describe('isValidAgentAttachment', () => {
  it.for([
    { name: 'clip.mp4', bytes: [0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70] },
    { name: 'clip.m4v', bytes: [0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70] },
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

  it.for(['moov', 'mdat', 'wide', 'free', 'skip', 'pnot'])(
    'accepts a classic MOV beginning with %s without ftyp',
    async (atom) => {
      await expect(
        isValidAgentAttachment(new File(['\0\0\0\x08', atom], 'classic.mov'))
      ).resolves.toBe(true)
    }
  )

  it.for([
    { name: 'legacy.mp4', atom: 'moov' },
    { name: 'legacy.mp4', atom: 'mdat' },
    { name: 'legacy.m4v', atom: 'moov' },
    { name: 'legacy.m4v', atom: 'mdat' }
  ])(
    'accepts $name beginning with $atom without ftyp',
    async ({ name, atom }) => {
      await expect(
        isValidAgentAttachment(new File(['\0\0\0\x08', atom], name))
      ).resolves.toBe(true)
    }
  )

  it.for([
    { name: 'renamed.mp4', contents: 'not a video' },
    { name: 'renamed.m4v', contents: 'not a video' },
    { name: 'renamed.mov', contents: 'not a video' },
    { name: 'IMG_0001.MOV', contents: 'not a video' },
    { name: 'renamed.webm', contents: 'not a video' },
    { name: 'renamed.mkv', contents: 'not a video' },
    { name: 'sound.avi', contents: 'RIFF\0\0\0\0WAVE' },
    { name: 'truncated.mp4', contents: '\0\0\0\x18fty' },
    { name: 'empty.mov', contents: '' }
  ])(
    'rejects $name without its container signature',
    async ({ name, contents }) => {
      await expect(
        isValidAgentAttachment(new File([contents], name))
      ).resolves.toBe(false)
    }
  )

  it('rejects an unreadable video without propagating the read failure', async () => {
    vi.spyOn(Blob.prototype, 'arrayBuffer').mockRejectedValue(
      new DOMException('File became unreadable', 'NotReadableError')
    )

    await expect(
      isValidAgentAttachment(new File(['\0\0\0\x18ftyp'], 'clip.mp4'))
    ).resolves.toBe(false)
  })

  it.for(['notes.txt', 'clip.mp4.txt', 'clip.constructor'])(
    'does not inspect non-video attachment %s',
    (name) => {
      expect(isValidAgentAttachment(new File(['plain text'], name))).toBe(true)
    }
  )
})
