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

// The attachment limit is the server's, not the client's: `useAttachment`
// reads `max_upload_size` off the `feature_flags` handshake and only falls
// back to its own `MAX_ATTACHMENT_BYTES` when the server advertises nothing.
// The oversized-file test below pins the flag rather than restating that
// fallback, so it asserts the limit the app actually enforces in whichever
// deployment it runs against. Small enough that the generated drop payload
// stays cheap to build in the page.
const PINNED_UPLOAD_LIMIT_BYTES = 1024 * 1024

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
 * What the panel did with a file it was handed. `ignored` is the interesting
 * one: the file neither arrived nor was refused, so the user has no way to
 * tell the click from a misfire.
 */
type HandOverOutcome = 'attached' | 'refused' | 'ignored'

// How long to wait for either answer before calling the hand-over ignored.
const HAND_OVER_TIMEOUT = 5_000

/**
 * Hands `fileName` over by `route` and reports which of the three answers the
 * panel gave. Both routes are measured the same way, which is what lets the
 * parity test compare them instead of asserting one and assuming the other.
 */
async function handOver(
  agentPanel: AgentPanel,
  route: () => Promise<void>
): Promise<HandOverOutcome> {
  await route()
  const page = agentPanel.root.page()
  // `ignored` is the ABSENCE of both answers, so it is the case where both
  // waits time out — which is why this races two `waitFor`s rather than
  // polling through `expect`, whose timeout would throw on exactly the
  // outcome this needs to report. Whichever answer settles first wins, so a
  // slow arrival is never misread as silence.
  return await Promise.any([
    agentPanel.attachmentChips
      .first()
      .waitFor({ state: 'visible', timeout: HAND_OVER_TIMEOUT })
      .then(() => 'attached' as const),
    page
      .locator('.p-toast-message:visible')
      .first()
      .waitFor({ state: 'visible', timeout: HAND_OVER_TIMEOUT })
      .then(() => 'refused' as const)
  ]).catch(() => 'ignored' as const)
}

/** Removes every staged attachment, so the next hand-over starts clean. */
async function clearComposer(agentPanel: AgentPanel): Promise<void> {
  const remove = agentPanel.composerAssetSection.getByRole('button', {
    name: enMessages.agent.remove,
    exact: true
  })
  while ((await remove.count()) > 0) await remove.first().click()
  await expect(agentPanel.attachmentChips).toHaveCount(0)
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

      // Pin the limit so both routes are measured against a known one. The
      // cloud backend advertises a `max_upload_size` well above the client's
      // 20 MB fallback, so a file sized off that fallback is simply not
      // oversized there and nothing refuses it — which is what this test hit.
      // `Persistent` because the server re-sends `feature_flags` on every
      // socket open and a plain merge is dropped by the next handshake.
      await comfyPage.featureFlags.setServerFlagsPersistent({
        max_upload_size: PINNED_UPLOAD_LIMIT_BYTES
      })

      const oversized = {
        name: 'oversized.mp4',
        byteLength: PINNED_UPLOAD_LIMIT_BYTES + 1
      }
      // The whole sentence the user reads, limit included.
      const warning = comfyPage.page.getByText(
        enMessages.agent.attachmentTooLarge
          .replace('{name}', oversized.name)
          .replace('{limit}', formatSize(PINNED_UPLOAD_LIMIT_BYTES)),
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
    // The same file is an attachment by one route and a failed workflow-open by
    // the other.
    //
    // `onFilesPicked` (`AgentPanelRoot.vue`) hands every picked file straight to
    // `attachment.addFiles`, so a .csv chosen through the browser attaches — the
    // `accept` attribute is an OS-picker hint, and a user who switches the
    // picker to "All Files" is past it. `onPanelDrop` filters the same file
    // through `isAgentAttachable`, which has no `csv` entry, so the drop is left
    // unclaimed and falls through to the graph loader, which answers
    // "Unable to find workflow in <name>". The user is not ignored; they are
    // told about the wrong thing entirely, having never asked to open a
    // workflow.
    //
    // The pin is on the two routes AGREEING, not on csv specifically: it is
    // satisfied by teaching `isAgentAttachable` about csv, or by refusing it in
    // the composer's own words on both routes. Which is right is a product call
    // (`AGENT_ATTACH_EXTENSIONS` is an approved list, Jo / FE-1323); that the
    // two routes answer differently is not.
    //
    // Both outcomes are measured rather than one asserted and the other assumed,
    // so a fix that brings the routes into agreement the OTHER way — the picker
    // refusing too — also turns this green instead of leaving a stale pin.
    test.fail(
      'gives the same answer for a .csv whether it is picked or dropped',
      async ({ agentPanel, comfyPage }) => {
        await agentPanel.open()

        const picked = await handOver(agentPanel, () =>
          agentPanel.fileInput.setInputFiles(assetPath(CSV))
        )
        await clearComposer(agentPanel)
        const dropped = await handOver(agentPanel, () =>
          dropOnPanel(comfyPage, agentPanel, CSV)
        )

        // The claim is parity, so BOTH outcomes are read and compared. Asserting
        // only the drop would let a future fix that made the picker refuse
        // visibly satisfy the contract while this test still recorded a
        // failure — the two routes would agree and the pin would not notice.
        expect(
          dropped,
          `the file browser answered "${picked}"; a drop of the same file must answer the same`
        ).toBe(picked)

        // Silence is never one of the acceptable answers, whichever way the
        // two routes are brought into agreement.
        expect(dropped).not.toBe('ignored')
      }
    )
  }
)
