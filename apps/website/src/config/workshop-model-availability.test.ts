import { describe, expect, it } from 'vitest'

import {
  isWorkshopModelDisabled,
  workshopModelAvailability,
  workshopModelFlag
} from './workshop-model-availability'
import { workshopModelAvailabilitySchema } from './workshop-model-availability-schema'
import { appModels } from './workshop-app-content'

describe('workshop model availability', () => {
  it('keeps a flagged app built and names the flag that shows it', () => {
    expect(isWorkshopModelDisabled('apps/reshoot')).toBe(false)
    expect(workshopModelFlag('apps/reshoot')).toBe(
      'workshop-reshoot-app-enabled'
    )
    expect(workshopModelFlag('apps/cinematic-studio')).toBeUndefined()
  })

  it('resolves the flag on the server, onto the built app pages', () => {
    expect(appModels.find((app) => app.slug === 'apps/reshoot')?.flag).toBe(
      'workshop-reshoot-app-enabled'
    )
    expect(
      appModels.find((app) => app.slug === 'apps/cinematic-studio')?.flag
    ).toBeUndefined()
  })

  it('uses flags only on apps, whose pages are the ones gated at runtime', () => {
    const flagged = [...workshopModelAvailability]
      .filter(([, entry]) => entry.flag !== undefined)
      .map(([slug]) => slug)
    expect(flagged.every((slug) => slug.startsWith('apps/'))).toBe(true)
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
