import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { stubWorkshopFlags } from './fixtures/workshopFlags'

test('Workflows opens by modality and task over the full catalogue, with its collections under the toolbar', async ({
  page,
  context
}) => {
  await stubWorkshopFlags(context, {
    'workshop-enabled': true,
    'workshop-workflows-enabled': true
  })
  await page.goto('/hub/workflows/')

  const catalogue = page.getByTestId('workflow-catalogue')
  await expect(catalogue.getByRole('tab', { name: /^Image/ })).toBeVisible()
  await expect(catalogue.getByRole('tab', { name: /^Video/ })).toBeVisible()
  const collections = catalogue.getByTestId('workflow-collections')
  await expect(
    collections.getByRole('button', { name: /^Characters/ })
  ).toBeVisible()

  const toolbar = await catalogue.getByTestId('workshop-toolbar').boundingBox()
  const chips = await collections.boundingBox()
  expect(
    toolbar && chips && chips.y - (toolbar.y + toolbar.height),
    'the collections sit right under the search and filters'
  ).toBeLessThanOrEqual(8)
})
