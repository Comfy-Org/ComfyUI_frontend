// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

import { reifyMediaElements } from './reifyMediaElements'

const swapInFromInertDocument = (html: string) => {
  const inertDoc = new DOMParser().parseFromString(html, 'text/html')
  document.body.replaceChildren(...inertDoc.body.children)
  return document.body
}

describe('reifyMediaElements', () => {
  it('replaces swapped-in media elements with live copies keeping attributes and children', () => {
    const body = swapInFromInertDocument(`
      <div>
        <video src="https://cdn.example/clip.mp4" poster="p.jpg" autoplay muted playsinline>
          <track src="captions.vtt" kind="captions" srclang="en" />
        </video>
        <audio preload="metadata">
          <source src="a.ogg" type="audio/ogg" />
        </audio>
      </div>
    `)
    const parsedVideo = body.querySelector('video')!
    const parsedAudio = body.querySelector('audio')!
    parsedVideo.muted = true

    reifyMediaElements(body)

    const video = body.querySelector('video')!
    expect(video).not.toBe(parsedVideo)
    expect(video.getAttribute('src')).toBe('https://cdn.example/clip.mp4')
    expect(video.getAttribute('poster')).toBe('p.jpg')
    expect(video.hasAttribute('autoplay')).toBe(true)
    expect(video.hasAttribute('muted')).toBe(true)
    expect(video.hasAttribute('playsinline')).toBe(true)
    expect(video.muted).toBe(true)
    expect(video.querySelector('track')?.getAttribute('src')).toBe(
      'captions.vtt'
    )

    const audio = body.querySelector('audio')!
    expect(audio).not.toBe(parsedAudio)
    expect(audio.getAttribute('preload')).toBe('metadata')
    expect(audio.querySelector('source')?.getAttribute('src')).toBe('a.ogg')
  })

  it('keeps each media element in its original position', () => {
    const body = swapInFromInertDocument(
      '<p>before</p><video src="v.mp4"></video><p>after</p>'
    )

    reifyMediaElements(body)

    expect(
      [...body.children].map((el) => el.tagName.toLowerCase())
    ).toStrictEqual(['p', 'video', 'p'])
  })
})
