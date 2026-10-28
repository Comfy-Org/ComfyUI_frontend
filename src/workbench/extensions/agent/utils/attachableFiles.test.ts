import { describe, expect, it, vi } from 'vitest'

import {
  AGENT_ATTACH_ACCEPT,
  agentAttachCapability,
  agentAttachRefVerdict,
  agentAttachVerdict,
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
    'picture.webp',
    'music.flac'
  ])('accepts %s regardless of MIME type', (name) => {
    expect(isAgentAttachable(fileNamed(name))).toBe(true)
  })

  it.for([
    'notes.md',
    'readme.markdown',
    'prompt.txt',
    'workflow.json',
    'table.csv',
    'config.yaml',
    'config.yml',
    'feed.xml',
    'server.log',
    'mesh.glb',
    'mesh.obj',
    'mesh.fbx',
    'mesh.gltf',
    'mesh.stl',
    'cloud.ply',
    'cloud.spz',
    'cloud.splat',
    'cloud.ksplat',
    'plate.exr'
  ])('accepts %s', (name) => {
    expect(isAgentAttachable(fileNamed(name))).toBe(true)
  })

  it.for([
    'page.html',
    'bundle.js',
    'style.css',
    'doc.pdf',
    'clip.wmv',
    'clip.flv',
    'scene.usdz',
    'env.hdr',
    'track.aac',
    'track.aiff',
    'track.wma'
  ])('rejects %s', (name) => {
    expect(isAgentAttachable(fileNamed(name))).toBe(false)
  })

  it('rejects a file with no extension to judge', () => {
    expect(isAgentAttachable(fileNamed('noextension'))).toBe(false)
  })

  it('judges the extension case-insensitively', () => {
    expect(isAgentAttachable(fileNamed('SHOUTY.PNG'))).toBe(true)
    expect(isAgentAttachable(fileNamed('NOTES.MD'))).toBe(true)
  })
})

describe('agentAttachCapability', () => {
  it.for([
    ['photo.png', 'view'],
    ['photo.jpg', 'view'],
    ['photo.jpeg', 'view'],
    ['photo.gif', 'view'],
    ['photo.webp', 'view'],
    ['photo.bmp', 'view'],
    ['photo.tif', 'view'],
    ['photo.tiff', 'view'],
    ['photo.heic', 'view'],
    ['photo.heif', 'view'],
    ['clip.mp4', 'probe'],
    ['clip.webm', 'probe'],
    ['clip.mov', 'probe'],
    ['clip.m4v', 'probe'],
    ['clip.avi', 'probe'],
    ['clip.mkv', 'probe'],
    ['song.mp3', 'probe'],
    ['song.wav', 'probe'],
    ['song.ogg', 'probe'],
    ['song.opus', 'probe'],
    ['song.flac', 'probe'],
    ['song.m4a', 'probe'],
    ['notes.md', 'read'],
    ['notes.markdown', 'read'],
    ['notes.txt', 'read'],
    ['workflow.json', 'read'],
    ['data.csv', 'read'],
    ['conf.yaml', 'read'],
    ['conf.yml', 'read'],
    ['feed.xml', 'read'],
    ['server.log', 'read'],
    ['logo.svg', 'read'],
    ['mesh.glb', 'reference'],
    ['mesh.obj', 'reference'],
    ['mesh.fbx', 'reference'],
    ['mesh.gltf', 'reference'],
    ['mesh.stl', 'reference'],
    ['cloud.ply', 'reference'],
    ['cloud.spz', 'reference'],
    ['cloud.splat', 'reference'],
    ['cloud.ksplat', 'reference'],
    ['plate.exr', 'reference'],
    ['photo.avif', 'retain']
  ] as const)('reports %s as %s', ([name, capability]) => {
    expect(agentAttachCapability(name)).toBe(capability)
  })

  it('reports nothing for a type outside the accepted list', () => {
    expect(agentAttachCapability('doc.pdf')).toBeUndefined()
  })
})

describe('agentAttachVerdict', () => {
  it.for([
    ['photo.png', 'accepted'],
    ['notes.md', 'accepted'],
    ['scene.usdz', 'rejected'],
    ['doc.pdf', 'rejected'],
    ['blake3:abcdef0123456789', 'unknown'],
    ['abcdef0123456789', 'unknown'],
    ['My renamed asset', 'unknown'],
    ['render v1.2', 'unknown'],
    ['Empty Ace Step 1.0', 'unknown']
  ] as const)('reports %s as %s', ([filename, verdict]) => {
    expect(agentAttachVerdict(filename)).toBe(verdict)
  })
})

describe('agentAttachRefVerdict', () => {
  it.for([
    ['stored.png', 'accepted'],
    ['a1b2c3.md', 'accepted'],
    ['stored.v2', 'rejected'],
    ['stored.123', 'rejected'],
    ['stored.verylongextension', 'rejected'],
    ['stored_scene.usdz', 'rejected'],
    ['blake3:abcdef0123456789', 'unknown'],
    ['abcdef0123456789', 'unknown'],
    ['my.folder/image', 'unknown'],
    ['my.folder\\image', 'unknown']
  ] as const)('reports authoritative ref %s as %s', ([ref, verdict]) => {
    expect(agentAttachRefVerdict(ref)).toBe(verdict)
  })
})

describe('AGENT_ATTACH_ACCEPT', () => {
  it('carries no MIME wildcard', () => {
    expect(AGENT_ATTACH_ACCEPT).not.toContain('/*')
  })

  it('offers exactly what the composer will accept', () => {
    const offered = AGENT_ATTACH_ACCEPT.split(',')
    expect(offered).toContain('.json')
    expect(offered).toContain('.md')
    expect(offered).toContain('.glb')
    expect(offered).not.toContain('.usdz')
    expect(
      offered.filter(
        (extension) => !isAgentAttachable(fileNamed(`sample${extension}`))
      )
    ).toEqual([])
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
