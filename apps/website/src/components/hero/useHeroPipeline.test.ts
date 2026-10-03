import { describe, expect, it } from 'vitest'

import { DEFAULT_POSE } from './cameraVocabulary'
import { useHeroPipeline } from './useHeroPipeline'

describe('useHeroPipeline', () => {
  it('starts from the default pose with a neutral colour grade', () => {
    const { pose, hue, saturation, output, outputFilter } = useHeroPipeline()

    expect(pose).toMatchObject(DEFAULT_POSE)
    expect(hue.value).toBe(0)
    expect(saturation.value).toBe(1)
    expect(output.value.src).toMatch(/^\/hero\/angles\//)
    expect(outputFilter.value).toBeUndefined()
  })

  it('re-resolves the render when the pose moves', () => {
    const { pose, output } = useHeroPipeline()
    const initial = output.value.src

    pose.azimuth = 180
    expect(output.value.src).not.toBe(initial)
  })

  it('builds a CSS filter once the grade departs from neutral', () => {
    const { hue, saturation, outputFilter } = useHeroPipeline()

    hue.value = 120
    saturation.value = 0.8
    expect(outputFilter.value).toBe('hue-rotate(120deg) saturate(0.8)')

    hue.value = 0
    saturation.value = 1
    expect(outputFilter.value).toBeUndefined()
  })

  it('gives each caller an independent pipeline', () => {
    const first = useHeroPipeline()
    const second = useHeroPipeline()

    first.pose.azimuth = 90
    expect(second.pose.azimuth).toBe(DEFAULT_POSE.azimuth)
  })
})
