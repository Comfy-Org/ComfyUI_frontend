import { describe, expect, it, vi } from 'vitest'

vi.mock('astro:content', () => ({
  defineCollection: (config: unknown) => config
}))
vi.mock('astro/loaders', () => ({
  glob: () => ({})
}))

import { eventsSchema, gallerySchema, tutorialsSchema } from './content.config'

const validEntry = {
  order: 1,
  title: 'Until Our Eye Interlink harajuku',
  userAlias: 'ShaneF Motion Design',
  teamAlias: 'ThinkDiffusion',
  tool: 'ComfyUI',
  video: 'https://media.comfy.org/videos/compressed_512/eye.webm',
  href: 'https://www.thinkdiffusion.com/studio'
}

describe('gallerySchema', () => {
  it('accepts a valid entry', () => {
    const result = gallerySchema.safeParse(validEntry)
    expect(result.success).toBe(true)
  })

  it('rejects an entry missing a required field with a Zod error naming the field', () => {
    const { title: _omit, ...withoutTitle } = validEntry
    const result = gallerySchema.safeParse(withoutTitle)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'))
      expect(paths).toContain('title')
    }
  })

  it('defaults visible to true when omitted', () => {
    const result = gallerySchema.safeParse(validEntry)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.visible).toBe(true)
    }
  })

  it('preserves an explicit visible: false', () => {
    const result = gallerySchema.safeParse({ ...validEntry, visible: false })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.visible).toBe(false)
    }
  })

  it('rejects an invalid URL in image/video/href', () => {
    const result = gallerySchema.safeParse({
      ...validEntry,
      href: 'not a url'
    })
    expect(result.success).toBe(false)
  })
})

const validEvent = {
  order: 1,
  label: 'Live Stream:',
  title: 'Zero to Node: Building Your First Workflow',
  cta: 'Link',
  href: 'https://example.com/event'
}

describe('eventsSchema', () => {
  it('accepts a valid entry', () => {
    const result = eventsSchema.safeParse(validEvent)
    expect(result.success).toBe(true)
  })

  it('rejects an entry missing a required field with a Zod error naming the field', () => {
    const { title: _omit, ...withoutTitle } = validEvent
    const result = eventsSchema.safeParse(withoutTitle)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'))
      expect(paths).toContain('title')
    }
  })

  it('accepts "#" as a placeholder href', () => {
    const result = eventsSchema.safeParse({ ...validEvent, href: '#' })
    expect(result.success).toBe(true)
  })

  it('rejects a truly malformed href that is neither a URL nor "#"', () => {
    const result = eventsSchema.safeParse({ ...validEvent, href: 'not a url' })
    expect(result.success).toBe(false)
  })
})

const validTutorial = {
  order: 1,
  tags: ['Partner Nodes', 'Image To Video'],
  title: 'Cleanplate Walkthrough',
  videoSrc:
    'https://media.comfy.org/website/learning/cleanplate_walkthrough_v03.mp4',
  poster:
    'https://media.comfy.org/website/learning/cleanplate_walkthrough_v03_thumbnail.jpg'
}

describe('tutorialsSchema', () => {
  it('accepts a valid entry', () => {
    const result = tutorialsSchema.safeParse(validTutorial)
    expect(result.success).toBe(true)
  })

  it('rejects an entry missing a required field with a Zod error naming the field', () => {
    const { title: _omit, ...withoutTitle } = validTutorial
    const result = tutorialsSchema.safeParse(withoutTitle)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'))
      expect(paths).toContain('title')
    }
  })

  it('rejects an invalid videoSrc URL', () => {
    const result = tutorialsSchema.safeParse({
      ...validTutorial,
      videoSrc: 'not a url'
    })
    expect(result.success).toBe(false)
  })
})
