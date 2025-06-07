import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

/**
 * This file contains End-to-End (E2E) tests for the About Panel.
 *
 * It tests the real integration between the frontend and the live backend API.
 *
 * Pre-requisites for running these tests:
 * 1. The ComfyUI backend server must be running.
 * 2. The custom API endpoint '/templates_version' must be active on the backend
 *    (e.g., via `custom_nodes/templates_version.py`).
 */
test.describe('About Panel - E2E', () => {
  test('should display templates_version version from the real API', async ({
    comfyPage
  }) => {
    // 1. Fetch the expected version directly from the REAL API endpoint.
    // This makes the test adaptable to changes in the backend's response.
    const response = await comfyPage.request.get(
      `${comfyPage.url}/templates_version`
    )
    expect(
      response.ok(),
      'The real /templates_version API endpoint must be available and return a 200 OK status.'
    ).toBeTruthy()

    const { version: expectedVersion } = await response.json()
    expect(
      expectedVersion,
      'The real /templates_version API response should contain a "version" field.'
    ).toBeDefined()

    // 2. Open the Settings dialog and navigate to the About tab.
    await comfyPage.page.getByRole('button', { name: '⚙' }).click()
    await comfyPage.page.getByLabel('About').click()

    // 3. Find the link element that contains the core text "Workflows_Templates".
    const linkLocator = comfyPage.page.getByRole('link', {
      name: /Workflows_Templates/
    })

    // 4. Assert that the base link element is visible.
    // We give it a slightly longer timeout to account for real network latency.
    await expect(linkLocator).toBeVisible({ timeout: 10000 })

    // 5. Assert that the element's text contains the version fetched from the real API.
    await expect(linkLocator).toHaveText(new RegExp(expectedVersion))
  })
})
