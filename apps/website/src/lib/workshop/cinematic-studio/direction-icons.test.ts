import { describe, expect, it } from 'vitest'

import { cameraGroups, gradeGroup, lookGroups } from './catalog'
import { directionIcon } from './direction-icons'

describe('directionIcon', () => {
  it.for(lookGroups)('draws every $part option', (group) => {
    const drawings = group.options.map((option) =>
      directionIcon(group.part, option.id)
    )

    expect(drawings).not.toContain(undefined)
    expect(
      new Set(drawings.map((drawing) => JSON.stringify(drawing))).size
    ).toBe(group.options.length)
  })

  it.for([...cameraGroups, gradeGroup])(
    'leaves $part options to their own previews',
    (group) => {
      expect(directionIcon(group.part, group.options[1].id)).toBeUndefined()
    }
  )
})
