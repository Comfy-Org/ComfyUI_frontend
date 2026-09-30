import { describe, expect, it } from 'vitest'

import {
  AGENT_ATTACH_ACCEPT,
  agentAttachCapability,
  agentAttachVerdict,
  isAgentAttachable,
  partitionAttachableFiles
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

  /* The formats PM-1855 adds. Text and 3D were the families that could not be
     attached at all, which is the gap the agreed list closes. */
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
    'cloud.ksplat'
  ])('accepts %s', (name) => {
    expect(isAgentAttachable(fileNamed(name))).toBe(true)
  })

  /* The formats PM-1855 rejects. Several of these used to slip through the
     paperclip because the accept attribute carried image/*, video/* and
     audio/* wildcards while the picker path ran no check of its own. */
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
    'track.wma',
    'plate.exr'
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
  /* The tier decides what the composer may promise the user: only `view` means
     the model reads the content. A file the agent can merely name must never be
     presented the same way. */
  it.for([
    ['photo.png', 'view'],
    ['photo.jpeg', 'view'],
    ['clip.mp4', 'probe'],
    ['song.mp3', 'probe'],
    ['mesh.glb', 'reference'],
    ['notes.md', 'retain'],
    ['workflow.json', 'retain'],
    ['logo.svg', 'retain'],
    ['photo.avif', 'retain']
  ] as const)('reports %s as %s', ([name, capability]) => {
    expect(agentAttachCapability(name)).toBe(capability)
  })

  it('reports nothing for a type outside the accepted list', () => {
    expect(agentAttachCapability('doc.pdf')).toBeUndefined()
  })
})

describe('agentAttachVerdict', () => {
  /* A caller weighing several strings of unequal authority needs "refused" and
     "nothing to judge" kept apart: collapsing them is what made the asset-card
     gate both too strict (a renamed but valid file refused) and too loose (a
     rejected type admitted because the other operand said nothing). */
  it.for([
    ['photo.png', 'accepted'],
    ['notes.md', 'accepted'],
    ['scene.usdz', 'rejected'],
    ['doc.pdf', 'rejected'],
    ['blake3:abcdef0123456789', 'unknown'],
    ['abcdef0123456789', 'unknown'],
    ['My renamed asset', 'unknown']
  ] as const)('reports %s as %s', ([filename, verdict]) => {
    expect(agentAttachVerdict(filename)).toBe(verdict)
  })
})

describe('AGENT_ATTACH_ACCEPT', () => {
  /* The wildcards are what let the OS picker offer .hdr, .exr, .wmv and .wma in
     the first place (PM-1854); the accept list must name extensions only. */
  it('carries no MIME wildcard', () => {
    expect(AGENT_ATTACH_ACCEPT).not.toContain('/*')
  })

  it('offers exactly what the composer will accept', () => {
    const offered = AGENT_ATTACH_ACCEPT.split(',')
    expect(offered).toContain('.json')
    expect(offered).toContain('.md')
    expect(offered).toContain('.glb')
    expect(offered).not.toContain('.usdz')
    for (const extension of offered) {
      expect(isAgentAttachable(fileNamed(`sample${extension}`))).toBe(true)
    }
  })
})

describe('partitionAttachableFiles', () => {
  it('splits a mixed batch, preserving order within each side', () => {
    const png = fileNamed('a.png')
    const pdf = fileNamed('b.pdf')
    const md = fileNamed('c.md')
    const zip = fileNamed('d.zip')

    expect(partitionAttachableFiles([png, pdf, md, zip])).toEqual({
      attachable: [png, md],
      rejected: [pdf, zip]
    })
  })

  it('is empty on both sides for an empty batch', () => {
    expect(partitionAttachableFiles([])).toEqual({
      attachable: [],
      rejected: []
    })
  })
})
