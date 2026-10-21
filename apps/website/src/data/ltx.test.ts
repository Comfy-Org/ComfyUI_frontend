import { describe, expect, it } from 'vitest'

import { ltxPage } from './ltx'

describe('ltx 2.5 workflow links', () => {
  it('sends the secondary hero CTA to the Hub list searched for LTX, not the unfiltered list', () => {
    expect(ltxPage.hero.secondaryCta?.href).toBe('/hub/workflows/?q=ltx')
  })
})
