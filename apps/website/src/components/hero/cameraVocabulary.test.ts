import { describe, expect, it } from 'vitest'

import {
  azimuthLabel,
  clampAzimuth,
  clampElevation,
  clampZoom,
  distanceLabel,
  elevationLabel,
  promptString
} from './cameraVocabulary'

describe('azimuthLabel', () => {
  it('maps bucket boundaries to the 8 octant labels', () => {
    expect(azimuthLabel(0)).toBe('front view')
    expect(azimuthLabel(22.4)).toBe('front view')
    expect(azimuthLabel(22.5)).toBe('front-right quarter view')
    expect(azimuthLabel(90)).toBe('right side view')
    expect(azimuthLabel(180)).toBe('back view')
    expect(azimuthLabel(270)).toBe('left side view')
    expect(azimuthLabel(337.4)).toBe('front-left quarter view')
    expect(azimuthLabel(337.5)).toBe('front view')
    expect(azimuthLabel(359)).toBe('front view')
  })

  it('wraps angles beyond 360 and below 0', () => {
    expect(azimuthLabel(360)).toBe('front view')
    expect(azimuthLabel(450)).toBe('right side view')
    expect(azimuthLabel(-45)).toBe('front-left quarter view')
  })
})

describe('elevationLabel', () => {
  it('maps threshold boundaries', () => {
    expect(elevationLabel(-30)).toBe('low-angle shot')
    expect(elevationLabel(-16)).toBe('low-angle shot')
    expect(elevationLabel(-15)).toBe('eye-level shot')
    expect(elevationLabel(14)).toBe('eye-level shot')
    expect(elevationLabel(15)).toBe('elevated shot')
    expect(elevationLabel(44)).toBe('elevated shot')
    expect(elevationLabel(45)).toBe('high-angle shot')
    expect(elevationLabel(60)).toBe('high-angle shot')
  })
})

describe('distanceLabel', () => {
  it('maps zoom buckets', () => {
    expect(distanceLabel(0)).toBe('wide shot')
    expect(distanceLabel(1.9)).toBe('wide shot')
    expect(distanceLabel(2)).toBe('medium shot')
    expect(distanceLabel(5.9)).toBe('medium shot')
    expect(distanceLabel(6)).toBe('close-up')
    expect(distanceLabel(10)).toBe('close-up')
  })
})

describe('promptString', () => {
  it('produces the exact upstream grammar', () => {
    expect(promptString({ azimuth: 0, elevation: 0, zoom: 5 })).toBe(
      '<sks> front view eye-level shot medium shot'
    )
    expect(promptString({ azimuth: 64, elevation: -6, zoom: 0 })).toBe(
      '<sks> front-right quarter view eye-level shot wide shot'
    )
  })
})

describe('clamping', () => {
  it('wraps azimuth into [0, 360)', () => {
    expect(clampAzimuth(360)).toBe(0)
    expect(clampAzimuth(-1)).toBe(359)
    expect(clampAzimuth(725)).toBe(5)
  })

  it('clamps elevation to [-30, 60]', () => {
    expect(clampElevation(-31)).toBe(-30)
    expect(clampElevation(61)).toBe(60)
  })

  it('clamps zoom to [0, 10] at 0.1 precision', () => {
    expect(clampZoom(-0.5)).toBe(0)
    expect(clampZoom(10.4)).toBe(10)
    expect(clampZoom(5.55)).toBe(5.6)
  })
})
