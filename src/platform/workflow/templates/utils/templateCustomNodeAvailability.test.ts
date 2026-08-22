import { describe, expect, it } from 'vitest'

import type {
  ResolvedTemplateCustomNodeAvailability as Availability,
  TemplateCustomNodeAvailabilitySnapshot as Snapshot
} from './templateCustomNodeAvailability'
import {
  applyTemplateCustomNodeLiveState,
  resolveTemplateCustomNodeAvailability
} from './templateCustomNodeAvailability'

function readySnapshot(
  ids: readonly string[],
  overrides: Partial<Snapshot> = {}
): Snapshot {
  return {
    managerCapability: 'ready',
    installedInventory: { isComplete: true, entries: [] },
    inProgressIds: [],
    registry: {
      isComplete: true,
      eligibilityById: Object.fromEntries(
        ids.map((id) => [id, { status: 'eligible', pack: { id } }])
      )
    },
    ...overrides
  }
}

describe('resolveTemplateCustomNodeAvailability', () => {
  it('preserves exact IDs and gives active local state precedence', () => {
    const ids = ['Installing.ID', 'installed-id', 'disabled_id', 'mixed-id']

    expect(
      resolveTemplateCustomNodeAvailability(
        ids,
        readySnapshot(ids, {
          inProgressIds: ['Installing.ID'],
          installedInventory: {
            isComplete: true,
            entries: [
              { id: 'Installing.ID', enabled: true },
              { id: 'installed-id', enabled: true },
              { id: 'disabled_id', enabled: false },
              { id: 'mixed-id', enabled: false },
              { id: 'mixed-id', enabled: true }
            ]
          }
        })
      )
    ).toEqual([
      { id: 'Installing.ID', status: 'in-progress' },
      { id: 'installed-id', status: 'installed' },
      { id: 'disabled_id', status: 'disabled' },
      { id: 'mixed-id', status: 'installed' }
    ])
  })

  it('never infers missing from incomplete inventories', () => {
    expect(
      resolveTemplateCustomNodeAvailability(
        ['package-id'],
        readySnapshot([], {
          installedInventory: { isComplete: false, entries: [] }
        })
      )
    ).toEqual([{ id: 'package-id', status: 'unknown' }])

    expect(
      resolveTemplateCustomNodeAvailability(
        ['package-id'],
        readySnapshot([], {
          registry: { isComplete: false, eligibilityById: {} }
        })
      )
    ).toEqual([{ id: 'package-id', status: 'unknown' }])
  })

  it('only marks a proven eligible Registry pack missing', () => {
    const eligiblePack = { id: 'eligible-id', latest_version: { version: '1' } }

    expect(
      resolveTemplateCustomNodeAvailability(
        [
          'not-registered',
          'unsafe-id',
          'incompatible-id',
          'invalid-id',
          'eligibility-unknown',
          'eligible-id'
        ],
        readySnapshot([], {
          registry: {
            isComplete: true,
            eligibilityById: {
              'unsafe-id': { status: 'unavailable', reason: 'unsafe' },
              'incompatible-id': {
                status: 'unavailable',
                reason: 'incompatible'
              },
              'invalid-id': {
                status: 'unavailable',
                reason: 'invalid-payload'
              },
              'eligibility-unknown': { status: 'unknown' },
              'eligible-id': { status: 'eligible', pack: eligiblePack }
            }
          }
        })
      )
    ).toEqual([
      {
        id: 'not-registered',
        status: 'unavailable',
        reason: 'not-in-registry'
      },
      { id: 'unsafe-id', status: 'unavailable', reason: 'unsafe' },
      {
        id: 'incompatible-id',
        status: 'unavailable',
        reason: 'incompatible'
      },
      { id: 'invalid-id', status: 'unavailable', reason: 'invalid-payload' },
      { id: 'eligibility-unknown', status: 'unknown' },
      { id: 'eligible-id', status: 'missing', pack: eligiblePack }
    ])
  })

  it('uses live Manager state without making unavailable rows installable', () => {
    const unavailable: Availability = {
      id: 'package-id',
      status: 'unavailable',
      reason: 'unsafe'
    }

    expect(
      applyTemplateCustomNodeLiveState(unavailable, {
        isInstalling: true,
        isInstalled: false,
        isEnabled: false
      })
    ).toEqual({ id: 'package-id', status: 'in-progress' })
    expect(
      applyTemplateCustomNodeLiveState(unavailable, {
        isInstalling: false,
        isInstalled: true,
        isEnabled: false
      })
    ).toEqual({ id: 'package-id', status: 'disabled' })
    expect(
      applyTemplateCustomNodeLiveState(unavailable, {
        isInstalling: false,
        isInstalled: false,
        isEnabled: false
      })
    ).toEqual(unavailable)
  })
})
