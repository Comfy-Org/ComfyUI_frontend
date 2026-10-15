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

  it('recreates inert animation frames without changing their security or layout', () => {
    const body = swapInFromInertDocument(`
      <div><iframe
        src="/assets/platform/serverless/json-api-gpu-animation.html?layout=compact"
        title="Comfy animation"
        sandbox="allow-scripts"
        loading="eager"
        tabindex="-1"
        class="absolute inset-0 size-full border-0"
      ></iframe></div>
    `)
    const parsedFrame = body.querySelector('iframe')!

    reifyMediaElements(body)

    const frame = body.querySelector('iframe')!
    expect(frame).not.toBe(parsedFrame)
    expect(frame.outerHTML).toBe(parsedFrame.outerHTML)
    expect(frame.ownerDocument).toBe(document)
    expect(frame.parentElement?.tagName).toBe('DIV')
  })
})

it('preserves Vue-owned CCC catalogue media while retaining legacy and iframe reification', () => {
  const root = document.createElement('div')
  root.innerHTML =
    '<astro-island data-astro-transition-persist="ccc-hub-catalogue-en"><video src="ccc.mp4"></video><audio src="ccc.mp3"></audio><iframe src="/animation.html"></iframe></astro-island><astro-island data-astro-transition-persist="hub-catalogue"><video src="legacy.mp4"></video></astro-island><video src="other.mp4"></video>'
  const owned = root.querySelector('astro-island')
  if (!owned) throw new Error('Missing catalogue fixture')
  const video = owned.querySelector('video')
  const audio = owned.querySelector('audio')
  const frame = owned.querySelector('iframe')
  const legacy = root.querySelector(
    '[data-astro-transition-persist="hub-catalogue"] video'
  )
  const other = root.lastElementChild
  reifyMediaElements(root)
  expect(owned.querySelector('video')).toBe(video)
  expect(owned.querySelector('audio')).toBe(audio)
  expect(owned.querySelector('iframe')).not.toBe(frame)
  expect(
    root.querySelector('[data-astro-transition-persist="hub-catalogue"] video')
  ).not.toBe(legacy)
  expect(root.lastElementChild).not.toBe(other)
})
