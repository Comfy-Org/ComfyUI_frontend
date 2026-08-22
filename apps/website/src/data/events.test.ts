import { describe, expect, it } from 'vitest'

import type { ComfyEventSource } from './events'
import { eventsForLocale, flattenEvent } from './events'

const source: ComfyEventSource = {
  id: 'sample',
  category: 'community',
  title: { en: 'Sample Event', 'zh-CN': '样例活动' },
  description: { en: 'A sample.', 'zh-CN': '一个样例。' },
  locationMode: 'in-person',
  locationName: { en: 'Los Angeles, CA', 'zh-CN': '美国加州洛杉矶' },
  startDateTime: '2026-08-26T18:00:00-07:00',
  href: '/launches',
  newTab: true,
  ctaLabel: { en: 'Register', 'zh-CN': '报名' },
  media: {
    type: 'image',
    src: 'https://media.comfy.org/a.avif',
    alt: { en: 'Sample art', 'zh-CN': '样例图' }
  },
  featured: {
    order: 1,
    media: {
      type: 'video',
      src: 'https://media.comfy.org/a.mp4',
      alt: { en: 'Sample video', 'zh-CN': '样例视频' },
      poster: 'https://media.comfy.org/a.jpg'
    }
  }
}

describe('flattenEvent', () => {
  it('flattens every localized field to the requested locale', () => {
    expect(flattenEvent(source, 'zh-CN')).toMatchObject({
      id: 'sample',
      title: '样例活动',
      description: '一个样例。',
      locationMode: 'in-person',
      locationName: '美国加州洛杉矶',
      ctaLabel: '报名',
      media: { alt: '样例图' },
      featured: { order: 1, media: { alt: '样例视频' } }
    })
  })

  it('localizes relative hrefs per locale and keeps absolute ones', () => {
    expect(flattenEvent(source, 'en').href).toBe('/launches')
    expect(flattenEvent(source, 'zh-CN').href).toBe('/zh-CN/launches')

    const external: ComfyEventSource = {
      ...source,
      href: 'https://luma.com/nd0u29u8'
    }
    expect(flattenEvent(external, 'zh-CN').href).toBe(
      'https://luma.com/nd0u29u8'
    )
  })

  it('carries online events without a location name', () => {
    const online: ComfyEventSource = {
      ...source,
      locationMode: 'online',
      locationName: undefined
    }

    expect(flattenEvent(online, 'en')).toMatchObject({
      locationMode: 'online'
    })
    expect(flattenEvent(online, 'en').locationName).toBeUndefined()
  })
})

describe('site event data', () => {
  it('has unique event ids', () => {
    const ids = eventsForLocale('en').map((event) => event.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})
