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
      videoSrc: 'https://media.comfy.org/quiet.webm'
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
    { name: 'no flag', flag: undefined },
    { name: 'a null answer', flag: null },
    { name: 'a boolean answer', flag: true },
    { name: 'the control key', flag: 'control' },
    { name: 'an unknown key', flag: 'missing' },
    { name: 'an inherited object key', flag: 'toString' },
    { name: 'an empty key', flag: '' }
  ])('falls back to the control card for $name', ({ flag }) => {
    expect(resolveFeaturedMedia(control, flag)).toEqual(controlMedia)
  })

  it('falls back to control when the card defines no variants', () => {
    const { variants: _variants, ...plain } = control
    expect(resolveFeaturedMedia(plain, 'bold')).toEqual(controlMedia)
  })

  it('swaps in a configured variant and inherits only the alt text', () => {
    expect(resolveFeaturedMedia(control, 'bold')).toEqual({
      variant: 'bold',
      imageSrc: 'https://media.comfy.org/bold.webp',
      videoSrc: undefined,
      imageAlt: 'Bold alt'
    })
    expect(resolveFeaturedMedia(control, 'quiet')).toEqual({
      variant: 'quiet',
      imageSrc: 'https://media.comfy.org/quiet.webp',
      videoSrc: 'https://media.comfy.org/quiet.webm',
      imageAlt: 'Control alt'
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
        variant: 'bold',
        locale: 'zh-CN'
      })
    ).toEqual({
      placement: 'gemini-omni',
      dropdown: 'products',
      href: '/gemini-omni/',
      variant: 'bold',
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
