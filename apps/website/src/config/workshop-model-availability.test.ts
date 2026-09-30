import { describe, expect, it } from 'vitest'

import {
  isWorkshopModelDisabled,
  workshopModelFlag
} from './workshop-model-availability'
import { workshopModelAvailabilitySchema } from './workshop-model-availability-schema'

describe('workshop model availability', () => {
  it('keeps a flagged app built and names the flag that shows it', () => {
    expect(isWorkshopModelDisabled('apps/reshoot')).toBe(false)
    expect(workshopModelFlag('apps/reshoot')).toBe(
      'workshop-reshoot-app-enabled'
    )
    expect(workshopModelFlag('apps/cinematic-studio')).toBeUndefined()
  })

  it.for([
    { name: 'disabled', entry: { disabled: true, reason: 'why' }, ok: true },
    {
      name: 'flagged',
      entry: { flag: 'workshop-x-enabled', reason: 'why' },
      ok: true
    },
    { name: 'neither', entry: { reason: 'why' }, ok: false },
    {
      name: 'not a flag key',
      entry: { flag: 'Workshop X', reason: 'why' },
      ok: false
    },
    { name: 'no reason', entry: { flag: 'workshop-x-enabled' }, ok: false }
  ])('accepts an entry that is $name: $ok', ({ entry, ok }) => {
    expect(
      workshopModelAvailabilitySchema.safeParse({ slug: entry }).success
    ).toBe(ok)
  })
})
