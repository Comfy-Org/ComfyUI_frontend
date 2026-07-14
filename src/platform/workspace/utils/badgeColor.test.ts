import { describe, expect, it } from 'vitest'

import { userBadgeColor } from './badgeColor'

describe('userBadgeColor', () => {
  it('returns a stable CSS color for the same user', () => {
    const color = userBadgeColor('user@example.com')

    expect(userBadgeColor('user@example.com')).toBe(color)
    expect(color).toMatch(/^#[\da-f]{6}$/)
  })

  it('distributes users across multiple colors', () => {
    const colors = new Set(
      ['a@example.com', 'b@example.com', 'c@example.com'].map(userBadgeColor)
    )

    expect(colors.size).toBeGreaterThan(1)
  })
})
