import { describe, expect, it } from 'vitest'
import { vfxMediaRoot, vfxRedSkyMedia, vfxVariantMedia } from './vfxMedia'

describe('VFX variant media', () => {
  it('replaces only Blue hour with the approved red-sky video and poster', () => {
    expect(vfxVariantMedia('relight_blue', 'mp4')).toBe(vfxRedSkyMedia.video)
    expect(vfxVariantMedia('relight_blue', 'jpg')).toBe(vfxRedSkyMedia.poster)
  })
  it.for([
    'diner',
    'relight_golden',
    'relight_night',
    'relight_rain',
    'relight_snow',
    'relight_day',
    'swap_jp',
    'swap_uk',
    'swap_it',
    'reframe_wide',
    'reframe_vertical',
    'seedance_multishot_rain',
    'seedance_push',
    'seedance_orbit'
  ])('preserves existing video and image paths for %s', (id) => {
    expect(vfxVariantMedia(id, 'mp4')).toBe(`${vfxMediaRoot}/${id}.mp4`)
    expect(vfxVariantMedia(id, 'jpg')).toBe(`${vfxMediaRoot}/${id}.jpg`)
  })
})
