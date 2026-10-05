import { expect } from '@playwright/test'

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import {
  BARE_DIGEST,
  dropLibraryAsset,
  openAgentPanel,
  PLAIN_FILENAME,
  reopenAfterReload,
  resolvedImageRefs,
  sendTurn,
  serveHistory
} from '@e2e/fixtures/helpers/agentAttachmentRehydration'
import { assetPath } from '@e2e/fixtures/utils/paths'

/** PM-1643 / PM-717 item 3: persisted attachment presentation after reload. */
test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test(
  'previews a refreshed attachment whose only surviving name is an extensionless ref',
  { tag: ['@cloud', '@ui'] },
  async ({ page, promptHistory, workflowSelection }, testInfo) => {
    await page.route(`**/view?filename=${BARE_DIGEST}&type=input`, (route) =>
      route.fulfill({ path: assetPath('image64x64.webp') })
    )
    await serveHistory(page, promptHistory.requests, resolvedImageRefs)

    const panel = await openAgentPanel(page, workflowSelection)
    await dropLibraryAsset(page, panel, {
      displayName: 'Beach photo.png',
      ref: BARE_DIGEST,
      kind: 'image'
    })
    await sendTurn(panel, 'upscale this')
    await expect.poll(() => promptHistory.requests.length).toBe(1)
    expect(promptHistory.requests[0].attachments).toEqual([BARE_DIGEST])
    await expect(panel.getByTestId('reply-image-preview')).toHaveCount(1)
    // The live label proves the drag/drop name is shown before persistence is
    // involved; the PM-1705 case below covers the rehydrated contract.
    await expect(
      panel.getByRole('img', { name: 'Beach photo.png', exact: true })
    ).toBeVisible()

    const reopened = await reopenAfterReload(panel, page)

    const preview = reopened.getByTestId('reply-image-preview')
    await expect(preview).toHaveCount(1, { timeout: 10_000 })
    await expect(preview).toHaveJSProperty('naturalWidth', 64)
    // figcaption is the compact grey tile the grid falls back to, and nothing
    // else in the panel renders one.
    await expect(reopened.locator('figcaption')).toHaveCount(0)
    await testInfo.attach('extensionless-ref-after-reload.png', {
      body: await reopened.screenshot(),
      contentType: 'image/png'
    })
  }
)

test(
  'drops a blank attachment name the API let through onto a refreshed turn',
  { tag: ['@cloud', '@ui'] },
  async ({ page, promptHistory, workflowSelection }) => {
    await page.route(`**/view?filename=${PLAIN_FILENAME}&type=input`, (route) =>
      route.fulfill({ path: assetPath('image64x64.webp') })
    )
    // The persisted row contains a blank attachment name.
    await serveHistory(page, promptHistory.requests, (posted) => ({
      text: posted.content,
      attachments: ['', ...(posted.attachments ?? [])]
    }))

    const panel = await openAgentPanel(page, workflowSelection)
    await dropLibraryAsset(page, panel, {
      displayName: PLAIN_FILENAME,
      ref: PLAIN_FILENAME,
      kind: 'image'
    })
    await sendTurn(panel, 'describe this')
    await expect.poll(() => promptHistory.requests.length).toBe(1)

    const reopened = await reopenAfterReload(panel, page)

    await expect(reopened.getByTestId('reply-image-preview')).toHaveCount(1, {
      timeout: 10_000
    })
    await expect(reopened.locator('figcaption')).toHaveCount(0)
  }
)

/** PM-1705 / cloud #10854: expected display name beside its storage ref. */
test(
  'labels a refreshed attachment with the filename the user attached',
  { tag: ['@cloud', '@ui'] },
  async ({ page, promptHistory, workflowSelection }) => {
    await page.route(`**/view?filename=${BARE_DIGEST}&type=input`, (route) =>
      route.fulfill({ path: assetPath('image64x64.webp') })
    )
    await serveHistory(page, promptHistory.requests, (posted) => ({
      ...resolvedImageRefs(posted),
      attachment_refs: [
        {
          name: BARE_DIGEST,
          display_name: 'Beach photo.png',
          id: 'asset-rehydrated',
          kind: 'image'
        }
      ]
    }))

    const panel = await openAgentPanel(page, workflowSelection)
    await dropLibraryAsset(page, panel, {
      displayName: 'Beach photo.png',
      ref: BARE_DIGEST,
      kind: 'image'
    })
    await sendTurn(panel, 'upscale this')
    await expect.poll(() => promptHistory.requests.length).toBe(1)

    const reopened = await reopenAfterReload(panel, page)

    await expect(
      reopened.getByRole('img', { name: 'Beach photo.png', exact: true })
    ).toBeVisible({ timeout: 10_000 })
  }
)
