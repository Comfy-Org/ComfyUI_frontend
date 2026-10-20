import { describe, expect, it } from 'vitest'

import type { NavFeatured } from '@/data/mainNavigation'
import {
  buildNavFeaturedCardEventProperties,
  getFeaturedImageFlagKey,
  getFeaturedPlacement,
  resolveFeaturedMedia
} from './navFeaturedCard'

const control: NavFeatured = {
  imageSrc: 'https://media.comfy.org/control.webp',
  videoSrc: 'https://media.comfy.org/control.webm',
  imageAlt: 'Control alt',
  title: 'Title',
  cta: { label: 'Go', href: '/gemini-omni/' },
  variants: {
    bold: {
      imageSrc: 'https://media.comfy.org/bold.webp',
      imageAlt: 'Bold alt'
    },
    quiet: {
      imageSrc: 'https://media.comfy.org/quiet.webp',
      videoSrc: 'https://media.comfy.org/quiet.webm',
      imageAlt: 'Quiet alt'
    },
    control: {
      imageSrc: 'https://media.comfy.org/ignored.webp',
      imageAlt: 'Ignored alt'
    }
  }
}

const controlMedia = {
  variant: 'control',
  imageSrc: control.imageSrc,
  videoSrc: control.videoSrc,
  imageAlt: control.imageAlt
}

describe('resolveFeaturedMedia', () => {
  it.for([
    { read: { state: 'not_loaded' }, source: 'not_loaded' },
    { read: { state: 'unanswered' }, source: 'unanswered' },
    { read: { state: 'no_flag' }, source: 'no_flag' },
    { read: { state: 'answered', key: 'control' }, source: 'control_flag' },
    { read: { state: 'answered', key: 'missing' }, source: 'unknown_variant' },
    { read: { state: 'answered', key: 'toString' }, source: 'unknown_variant' },
    { read: { state: 'answered', key: '' }, source: 'unknown_variant' }
  ] as const)(
    'renders the control card and reports $source for $read',
    ({ read, source }) => {
      expect(resolveFeaturedMedia(control, read)).toEqual({
        ...controlMedia,
        variantSource: source
      })
    }
  )

  it('reports an unknown variant when the card defines no variants', () => {
    const { variants: _variants, ...plain } = control
    expect(
      resolveFeaturedMedia(plain, { state: 'answered', key: 'bold' })
    ).toEqual({ ...controlMedia, variantSource: 'unknown_variant' })
  })

  it('swaps in a configured variant with its own alt text and no control video', () => {
    expect(
      resolveFeaturedMedia(control, { state: 'answered', key: 'bold' })
    ).toEqual({
      variant: 'bold',
      variantSource: 'flag',
      imageSrc: 'https://media.comfy.org/bold.webp',
      videoSrc: undefined,
      imageAlt: 'Bold alt'
    })
    expect(
      resolveFeaturedMedia(control, { state: 'answered', key: 'quiet' })
    ).toEqual({
      variant: 'quiet',
      variantSource: 'flag',
      imageSrc: 'https://media.comfy.org/quiet.webp',
      videoSrc: 'https://media.comfy.org/quiet.webm',
      imageAlt: 'Quiet alt'
    })
  })
})

describe('getFeaturedPlacement', () => {
  it.for([
    {
      name: 'an explicit id',
      analyticsId: 'launch',
      href: '/x/',
      want: 'launch'
    },
    { name: 'the path', href: '/gemini-omni/', want: 'gemini-omni' },
    {
      name: 'a localized path',
      href: '/zh-CN/gemini-omni/',
      want: 'gemini-omni'
    },
    { name: 'a query and hash', href: '/a/b?x=1#top', want: 'a/b' },
    { name: 'the home page', href: '/', want: 'home' }
  ])('uses $name', ({ analyticsId, href, want }) => {
    expect(
      getFeaturedPlacement({
        ...control,
        analyticsId,
        cta: { label: 'Go', href }
      })
    ).toBe(want)
  })
})

describe('buildNavFeaturedCardEventProperties', () => {
  it('builds the payload shared by the viewed and clicked events', () => {
    expect(
      buildNavFeaturedCardEventProperties({
        featured: { ...control, analyticsId: 'gemini-omni' },
        dropdown: 'products',
        media: { variant: 'bold', variantSource: 'flag' },
        locale: 'zh-CN'
      })
    ).toEqual({
      placement: 'gemini-omni',
      dropdown: 'products',
      href: '/gemini-omni/',
      variant: 'bold',
      variant_source: 'flag',
      locale: 'zh-CN'
    })
  })
})

describe('getFeaturedImageFlagKey', () => {
  it('names one flag per placement', () => {
    expect(
      getFeaturedImageFlagKey({ ...control, analyticsId: 'gemini-omni' })
    ).toBe('nav-featured-card-image-gemini-omni')
    expect(
      getFeaturedImageFlagKey({ ...control, analyticsId: 'customer-story' })
    ).toBe('nav-featured-card-image-customer-story')
  })

  it('falls back to the link path when there is no analyticsId', () => {
    expect(getFeaturedImageFlagKey(control)).toBe(
      'nav-featured-card-image-gemini-omni'
    )
  })
})
