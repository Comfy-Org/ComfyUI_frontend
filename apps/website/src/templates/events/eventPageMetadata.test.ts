import { describe, expect, it } from 'vitest'

import type { ComfyEvent } from '../../data/events'
import { eventPageThumbnail, eventVideoJsonLd } from './eventPageMetadata'

const alt = { en: 'A', 'zh-CN': 'A' }

const baseEvent: ComfyEvent = {
  id: 'test-event',
  category: 'livestream',
  title: { en: 'Test Event', 'zh-CN': '测试活动' },
  description: { en: 'A livestream.', 'zh-CN': '直播。' },
  startDateTime: '2026-08-05T13:00:00-07:00',
  recordingVideoId: 'abc123',
  media: {
    type: 'image',
    src: 'https://media.comfy.org/a.jpg',
    alt
  }
}

const input = {
  isPast: true,
  siteUrl: 'https://comfy.org',
  url: 'https://comfy.org/events/test-event/',
  title: 'Test Event',
  description: 'A livestream.',
  locale: 'en' as const
}

describe('eventPageThumbnail', () => {
  it('uses the src of image media', () => {
    expect(eventPageThumbnail(baseEvent)).toBe('https://media.comfy.org/a.jpg')
  })

  it('uses the poster of video media, never the video src', () => {
    const event: ComfyEvent = {
      ...baseEvent,
      media: {
        type: 'video',
        src: 'https://media.comfy.org/a.mp4',
        alt,
        poster: 'https://media.comfy.org/a.jpg'
      }
    }

    expect(eventPageThumbnail(event)).toBe('https://media.comfy.org/a.jpg')
  })

  it('has no thumbnail for video media without a poster', () => {
    const event: ComfyEvent = {
      ...baseEvent,
      media: { type: 'video', src: 'https://media.comfy.org/a.mp4', alt }
    }

    expect(eventPageThumbnail(event)).toBeUndefined()
  })
})

describe('eventVideoJsonLd', () => {
  it('builds a VideoObject for a past event with a recording', () => {
    expect(eventVideoJsonLd({ ...input, event: baseEvent })).toMatchObject({
      '@id': 'https://comfy.org/events/test-event/#video',
      thumbnailUrl: 'https://media.comfy.org/a.jpg',
      contentUrl: 'https://www.youtube.com/watch?v=abc123',
      embedUrl: 'https://www.youtube-nocookie.com/embed/abc123',
      uploadDate: '2026-08-05T13:00:00-07:00'
    })
  })

  it('thumbnails video media with its poster', () => {
    const event: ComfyEvent = {
      ...baseEvent,
      media: {
        type: 'video',
        src: 'https://media.comfy.org/a.mp4',
        alt,
        poster: 'https://media.comfy.org/a.jpg'
      }
    }

    expect(eventVideoJsonLd({ ...input, event })).toMatchObject({
      thumbnailUrl: 'https://media.comfy.org/a.jpg'
    })
  })

  it('drops the node for video media without a poster', () => {
    const event: ComfyEvent = {
      ...baseEvent,
      media: { type: 'video', src: 'https://media.comfy.org/a.mp4', alt }
    }

    expect(eventVideoJsonLd({ ...input, event })).toBeUndefined()
  })

  it('drops the node for upcoming events', () => {
    expect(
      eventVideoJsonLd({ ...input, event: baseEvent, isPast: false })
    ).toBeUndefined()
  })

  it('drops the node until a recording is published', () => {
    const event: ComfyEvent = {
      ...baseEvent,
      recordingVideoId: undefined,
      liveVideoId: 'live123'
    }

    expect(eventVideoJsonLd({ ...input, event })).toBeUndefined()
  })

  it('drops the node when the event carries no media', () => {
    const event: ComfyEvent = { ...baseEvent, media: undefined }

    expect(eventVideoJsonLd({ ...input, event })).toBeUndefined()
  })
})
