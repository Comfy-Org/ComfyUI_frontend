import { describe, expect, it } from 'vitest'

import {
  CURATED_TEMPLATE_IDS,
  FALLBACK_TEMPLATE_IDS
} from '../gettingStarted/tutorialCards'
import { MEDIA_KIND_BY_SINK_TYPE, TOUR_ROLE_PINS } from './tourRolePins'

/**
 * These pins are maintained by hand against templates that move underneath
 * them, so the failure mode is a table that has drifted out of agreement with
 * itself. Asserting the individual ids back would only restate the table; what
 * is worth holding are the invariants that a hand edit can silently break.
 */
describe('TOUR_ROLE_PINS', () => {
  const entries = Object.entries(TOUR_ROLE_PINS)

  it('pins every id the Getting Started grid can offer', () => {
    const offered = [...CURATED_TEMPLATE_IDS, ...FALLBACK_TEMPLATE_IDS]
    const unpinned = offered.filter((id) => !(id in TOUR_ROLE_PINS))

    expect(
      unpinned,
      'an offered card with no pins resolves no roles, so its tour has nothing to spotlight'
    ).toEqual([])
  })

  it.for(entries)(
    '%s declares a mediaKind its sink type actually produces',
    ([, pins]) => {
      expect(
        MEDIA_KIND_BY_SINK_TYPE[pins.sink.type],
        `${pins.sink.type} is not in MEDIA_KIND_BY_SINK_TYPE, so the drift guard cannot tell what it emits`
      ).toBeDefined()

      expect(
        pins.mediaKind,
        `${pins.sink.type} emits ${MEDIA_KIND_BY_SINK_TYPE[pins.sink.type]}, so claiming ${pins.mediaKind} sends the result card looking for the wrong element`
      ).toBe(MEDIA_KIND_BY_SINK_TYPE[pins.sink.type])
    }
  )

  it.for(entries)('%s pins each role to a distinct node', ([, pins]) => {
    const ids = [pins.source?.id, pins.prompt?.id, pins.sink.id].filter(
      (id): id is number => id !== undefined
    )

    expect(
      new Set(ids).size,
      'two roles on one node means one of them is spotlighting the wrong thing'
    ).toBe(ids.length)
  })
})
