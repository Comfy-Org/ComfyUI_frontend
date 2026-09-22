import { expect } from '@playwright/test'

import { minimaxAutogrowTest as test } from '@e2e/fixtures/minimaxAutogrowFixture'
import { wireAndReopen } from '@e2e/fixtures/utils/minimaxAutogrowReload'

test.describe(
  'MiniMax-style autogrow reload',
  { tag: ['@agent', '@cloud', '@vue-nodes'] },
  () => {
    test('keeps widget links after a reference input grows', async ({
      referenceAgent,
      page
    }) => {
      await test.step('Materialize the reference node and its sources', async () => {
        await referenceAgent.materialize()
      })

      await test.step('Connect and reopen without changing named wire targets', async () => {
        const wiring = await wireAndReopen(page)
        expect(wiring).toEqual({
          hasNextReference: true,
          referenceLinked: true,
          seedLinkBefore: expect.any(Number),
          seedLinkAfter: wiring.seedLinkBefore
        })
      })
    })
  }
)
