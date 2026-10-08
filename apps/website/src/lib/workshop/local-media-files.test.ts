import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { findMissingLocalWorkshopMedia } from './local-media-files'

const dirs: string[] = []

function fixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'workshop-media-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('local Workshop media', () => {
  it('accepts existing thumbnail, sample and poster files', () => {
    const publicDir = fixtureDir()
    mkdirSync(join(publicDir, 'videos'))
    writeFileSync(join(publicDir, 'videos', 'clip.mp4'), 'video')
    writeFileSync(join(publicDir, 'videos', 'cover.jpg'), 'poster')
    writeFileSync(join(publicDir, 'videos', 'sample.png'), 'sample')

    expect(
      findMissingLocalWorkshopMedia(
        [
          {
            id: 'apps/example',
            media: {
              thumbnail: {
                url: '/videos/clip.mp4',
                poster: '/videos/cover.jpg'
              },
              samples: [{ url: '/videos/sample.png' }]
            }
          }
        ],
        publicDir
      )
    ).toEqual([])
  })

  it('reports missing thumbnail posters rather than silently accepting them', () => {
    const publicDir = fixtureDir()
    writeFileSync(join(publicDir, 'clip.mp4'), 'video')
    expect(
      findMissingLocalWorkshopMedia(
        [
          {
            id: 'apps/reshoot',
            media: {
              thumbnail: { url: '/clip.mp4', poster: '/deleted-poster.jpg' }
            }
          }
        ],
        publicDir
      )
    ).toEqual([
      'apps/reshoot media.thumbnail.poster: missing public/ file /deleted-poster.jpg'
    ])
  })

  it('identifies missing samples and their poster fields by index', () => {
    const publicDir = fixtureDir()
    expect(
      findMissingLocalWorkshopMedia(
        [
          {
            id: 'apps/example',
            media: {
              samples: [
                {
                  url: '/sample.mp4',
                  poster: '/sample-poster.png'
                }
              ]
            }
          }
        ],
        publicDir
      )
    ).toEqual([
      'apps/example media.samples[0].url: missing public/ file /sample.mp4',
      'apps/example media.samples[0].poster: missing public/ file /sample-poster.png'
    ])
  })

  it('ignores external media whose reachability must be checked separately', () => {
    expect(
      findMissingLocalWorkshopMedia(
        [
          {
            id: 'bfl/example',
            media: {
              thumbnail: {
                url: 'https://media.comfy.org/video.mp4',
                poster: 'https://cdn.jsdelivr.net/poster.jpg'
              }
            }
          }
        ],
        fixtureDir()
      )
    ).toEqual([])
  })

  it('resolves encoded filenames and ignores URL query and fragment', () => {
    const publicDir = fixtureDir()
    writeFileSync(join(publicDir, 'cover photo.jpg'), 'poster')
    expect(
      findMissingLocalWorkshopMedia(
        [
          {
            id: 'apps/example',
            media: {
              thumbnail: {
                url: 'https://media.comfy.org/clip.mp4',
                poster: '/cover%20photo.jpg?v=2#frame'
              }
            }
          }
        ],
        publicDir
      )
    ).toEqual([])
  })

  it.for([
    { url: '/../../outside.jpg', problem: 'escapes public/' },
    { url: '/%2e%2e/%2e%2e/outside.jpg', problem: 'escapes public/' },
    { url: '/dir\\outside.jpg', problem: 'unsafe local media path' },
    { url: '/%ZZ.jpg', problem: 'invalid URL encoding' }
  ])('rejects unsafe or malformed path $url', ({ url, problem }) => {
    const result = findMissingLocalWorkshopMedia(
      [{ id: 'apps/example', media: { thumbnail: { url } } }],
      fixtureDir()
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toContain(problem)
  })

  it('does not accept a directory as a media file', () => {
    const publicDir = fixtureDir()
    mkdirSync(join(publicDir, 'cover.png'))
    expect(
      findMissingLocalWorkshopMedia(
        [{ id: 'apps/example', media: { thumbnail: { url: '/cover.png' } } }],
        publicDir
      )
    ).toEqual(['apps/example media.thumbnail.url: missing public/ file /cover.png'])
  })
})
