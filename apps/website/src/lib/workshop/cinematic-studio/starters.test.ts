import { describe, expect, it } from 'vitest'

import {
  cameraGroups,
  directionOption,
  gradeGroup,
  lookGroups
} from './catalog'
import { STARTER_SHOTS } from './starters'

const parts = [...cameraGroups, ...lookGroups, gradeGroup].map(
  (group) => group.part
)

describe('STARTER_SHOTS', () => {
  it.for(STARTER_SHOTS)('$id picks only options the studio offers', (shot) => {
    for (const part of parts)
      expect(directionOption(part, shot.direction).id).toBe(
        shot.direction[part]
      )
  })
})
