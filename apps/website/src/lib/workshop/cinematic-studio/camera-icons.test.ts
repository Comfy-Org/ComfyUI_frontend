import { describe, expect, it } from 'vitest'

import { cameraIcon } from './camera-icons'
import { cameraGroups } from './catalog'

describe('cameraIcon', () => {
  it.for(cameraGroups)(
    'draws a distinct icon for every $part option',
    (group) => {
      const drawings = group.options.map((option) =>
        JSON.stringify(cameraIcon(group.part, option.id))
      )

      expect(drawings.every((drawing) => drawing.includes('"d"'))).toBe(true)
      expect(new Set(drawings).size).toBe(group.options.length)
    }
  )

  it('widens the field of view as the focal length shortens', () => {
    const spread = (id: string) => {
      const view = cameraIcon('focal', id)?.find(
        (shape) => shape.tone === 'fov'
      )
      const [, top, bottom] = /L2 ([\d.]+)V([\d.]+)Z/.exec(view?.d ?? '') ?? []
      return Number(bottom) - Number(top)
    }

    expect(spread('14')).toBeGreaterThan(spread('50'))
    expect(spread('50')).toBeGreaterThan(spread('135'))
  })

  it('draws nothing for look parts', () => {
    expect(cameraIcon('shot', 'medium')).toBeUndefined()
  })
})
