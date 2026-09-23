import { describe, expect, it } from 'vitest'

import { ltxPage } from './ltx'

describe('ltx 2.5 workflow links', () => {
  it('sends the secondary hero CTA to the LTX family page, not the hub root', () => {
    // The family page lists the shipped LTX workflows, matching what
    // /seedance-2.5 and /wan-3.0 already do.
    expect(ltxPage.hero.secondaryCta?.href).toBe(
      'https://comfy.org/workflows/model/ltx/'
    )
  })
})
