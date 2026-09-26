import { truncate, writeFile } from 'node:fs/promises'

import { expect } from '@playwright/test'

import type { UploadImageResponse } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { formatSize } from '@/utils/formatUtil'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'
import type { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

// `MAX_ATTACHMENT_BYTES` from `useAttachment.ts`, restated rather than
// imported: that module pulls in `@/i18n`, whose `import.meta.glob` the
// Playwright loader cannot evaluate. The assertion below names the formatted
// limit the user is shown, so a change to either one fails here loudly.
const ATTACHMENT_LIMIT_BYTES = 20 * 1024 * 1024

const VIDEO = 'plain_video.mp4'
const AUDIO = 'agent-attach-sample.wav'
const CSV = 'agent-attach-sample.csv'

// Dropping onto the middle of the open panel: the same target a user hits when
// they drag a file out of Finder and onto the conversation.
async function dropOnPanel(
  comfyPage: ComfyPage,
  agentPanel: AgentPanel,
  fileName: string
): Promise<void> {
  const box = await agentPanel.root.boundingBox()
  if (!box) throw new Error('Agent panel is not visible')
  await comfyPage.dragDrop.dragAndDropFile(fileName, {
    // Without this the helper stubs out `preventDefault`, so the graph loader
    // would also claim a drop the panel already claimed.
    preserveNativePropagation: true,
    dropPosition: { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  })
}

/**
 * Matrix rank 86 / slack-44 + notion-15 — "File types I need cannot be
 * attached, and the limits are inconsistent". The `.json` leg is on `main`
 * (`agentAttachJsonFile.spec.ts`, #16985). `qspec-3` returned video / audio /
 * CSV and picker-vs-drop parity with no blocker named; `cover-1` re-opened it
 * (`reports/design/2026-09-26-matrix-coverage-audit.md`).
 *
 * The user's complaint has two halves and this file has one test per half:
 * which types are taken at all, and whether the two ways of handing a file over
 * agree about it.
 */
test.describe(
  'Agent panel attachment types and picker/drop parity',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.route('**/api/upload/image', (route) => {
        const response: UploadImageResponse = {
          name: 'uploaded',
          subfolder: '',
          type: 'input'
        }
        return route.fulfill(jsonRoute(response))
      })
      await comfyPage.nodeOps.clearGraph()
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
    })

    test('accepts a video and an audio file by both the file browser and a drop', async ({
      agentPanel,
      comfyPage
    }) => {
      await agentPanel.open()

      // The OS picker filters on this attribute; `video/*` and `audio/*` are
      // what make a .mp4 or a .wav visible in it at all.
      await expect(agentPanel.fileInput).toHaveAttribute(
        'accept',
        /(^|,)video\/\*(,|$)/
      )
      await expect(agentPanel.fileInput).toHaveAttribute(
        'accept',
        /(^|,)audio\/\*(,|$)/
      )

      await agentPanel.fileInput.setInputFiles([
        assetPath(VIDEO),
        assetPath(AUDIO)
      ])
      await expect(agentPanel.attachmentChip(VIDEO)).toBeVisible()
      await expect(agentPanel.attachmentChip(AUDIO)).toBeVisible()
      await expect(
        agentPanel.composerAssetSection.locator(
          `[aria-label="${enMessages.agent.uploading}"]`
        )
      ).toHaveCount(0)

      // Same two files, handed over by dragging instead of browsing.
      for (const chip of [VIDEO, AUDIO]) {
        await agentPanel.attachmentChip(chip).hover()
        await agentPanel.composerAssetSection
          .getByRole('button', { name: enMessages.agent.remove, exact: true })
          .first()
          .click()
      }
      await expect(agentPanel.attachmentChips).toHaveCount(0)

      await dropOnPanel(comfyPage, agentPanel, VIDEO)
      await expect(agentPanel.attachmentChip(VIDEO)).toBeVisible()
      await dropOnPanel(comfyPage, agentPanel, AUDIO)
      await expect(agentPanel.attachmentChip(AUDIO)).toBeVisible()

      // A claimed media drop belongs to the composer, not the graph loader.
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
    })

    test('refuses an oversized file the same way whichever route it arrives by', async ({
      agentPanel,
      comfyPage
    }, testInfo) => {
      await agentPanel.open()
      const oversized = {
        name: 'oversized.mp4',
        byteLength: ATTACHMENT_LIMIT_BYTES + 1
      }
      // The whole sentence the user reads, limit included.
      const warning = comfyPage.page.getByText(
        enMessages.agent.attachmentTooLarge
          .replace('{name}', oversized.name)
          .replace('{limit}', formatSize(ATTACHMENT_LIMIT_BYTES)),
        { exact: true }
      )

      // Route 1: the file browser. Written sparse — only `File.size` is read
      // before the limit refuses it.
      const path = testInfo.outputPath(oversized.name)
      await writeFile(path, '')
      await truncate(path, oversized.byteLength)
      await agentPanel.fileInput.setInputFiles(path)
      await expect(warning).toBeVisible()
      await expect(agentPanel.attachmentChip(oversized.name)).toHaveCount(0)

      await warning.waitFor({ state: 'hidden', timeout: 15_000 })

      // Route 2: a drop of the same file. The bytes are generated in the page;
      // shipping 20 MB through `page.evaluate` as a number array is not viable.
      const box = await agentPanel.root.boundingBox()
      if (!box) throw new Error('Agent panel is not visible')
      await comfyPage.dragDrop.dragAndDropGeneratedFile(
        { ...oversized, type: 'video/mp4' },
        {
          preserveNativePropagation: true,
          dropPosition: { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        }
      )
      await expect(warning).toBeVisible()
      await expect(agentPanel.attachmentChip(oversized.name)).toHaveCount(0)
    })

    // LIVE-DEFECT PIN — expected to fail on `main`.
    //
    // The two routes disagree about which types they take, and only one of them
    // says so. `onFilesPicked` (`AgentPanelRoot.vue`) hands every picked file
    // straight to `attachment.addFiles`, so a .csv chosen through the browser
    // attaches — the `accept` attribute is an OS-picker hint, and a user who
    // switches the picker to "All Files" is past it. `onPanelDrop` filters the
    // same drop through `isAgentAttachable`, which has no `csv` entry, so the
    // file is left unclaimed, the graph loader cannot read it either, and the
    // user gets no feedback at all.
    //
    // The pin is on the two routes AGREEING, not on csv specifically: it is
    // satisfied either by teaching `isAgentAttachable` about csv or by refusing
    // it visibly in both places. Which of those is right is a product call
    // (`AGENT_ATTACH_EXTENSIONS` is an approved list, Jo / FE-1323); the user's
    // complaint that the two routes behave differently is not.
    test.fail(
      'gives the same answer for a .csv whether it is picked or dropped',
      async ({ agentPanel, comfyPage }) => {
        await agentPanel.open()

        await agentPanel.fileInput.setInputFiles(assetPath(CSV))
        const pickedChip = await agentPanel
          .attachmentChip(CSV)
          .count()
          .then((count) => count > 0)
        expect(
          pickedChip,
          'the file browser attaches a .csv, so the drop must not silently discard one'
        ).toBe(true)

        await agentPanel.composerAssetSection
          .getByRole('button', { name: enMessages.agent.remove, exact: true })
          .first()
          .click()
        await expect(agentPanel.attachmentChips).toHaveCount(0)

        await dropOnPanel(comfyPage, agentPanel, CSV)

        // Either the drop attaches it too, or the panel says why it will not.
        await expect(agentPanel.attachmentChip(CSV)).toBeVisible()
      }
    )
  }
)
