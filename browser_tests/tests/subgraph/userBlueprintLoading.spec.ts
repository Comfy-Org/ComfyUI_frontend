import { expect } from '@playwright/test'

import type { UserDataFullInfo } from '@comfyorg/api-client/types'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

const test = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    const userBlueprints = [
      { path: 'Image Edit.json/move/subgraphs/my subgraph.json', content: '' },
      { path: 'corrupt.json', content: '{' }
    ]
    await page.route(
      (url) =>
        url.pathname === '/api/userdata' &&
        url.searchParams.get('dir') === 'subgraphs',
      (route) =>
        route.fulfill({
          json: userBlueprints.map(({ path, content }) => ({
            path,
            size: content.length,
            modified: Date.now()
          })) satisfies UserDataFullInfo[]
        })
    )
    for (const { path, content } of userBlueprints) {
      await page.route(
        (url) =>
          url.pathname ===
          `/api/userdata/${encodeURIComponent(`subgraphs/${path}`)}`,
        (route) => route.fulfill({ body: content })
      )
    }
    await use(page)
  }
})

test.describe('User blueprint loading', { tag: '@subgraph' }, () => {
  test('reports a corrupt user blueprint but not an empty one', async ({
    comfyPage
  }) => {
    const loadFailure = comfyPage.toast.withText(
      'Failed to load subgraph blueprints'
    )
    await expect(loadFailure).toContainText(
      'Workflow content is not valid JSON'
    )
    await expect(loadFailure).not.toContainText(
      'Workflow content is missing or empty'
    )
  })
})
