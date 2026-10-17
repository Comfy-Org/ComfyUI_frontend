import { truncate, writeFile } from 'node:fs/promises'

import { expect } from '@playwright/test'

import type { UploadImageResponse } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { formatSize } from '@/utils/formatUtil'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const PINNED_UPLOAD_LIMIT_BYTES = 1024 * 1024

const VIDEO = 'plain_video.mp4'
const AUDIO = 'silence.wav'
const CSV = 'agent-attach-sample.csv'

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

      await expect(agentPanel.fileInput).toHaveAttribute(
        'accept',
        /(^|,)\.mp4(,|$)/
      )
      await expect(agentPanel.fileInput).toHaveAttribute(
        'accept',
        /(^|,)\.wav(,|$)/
      )

      await agentPanel.fileInput.setInputFiles([
        assetPath(VIDEO),
        assetPath(AUDIO)
      ])
      await expect(agentPanel.attachmentChip(VIDEO)).toBeVisible()
      await expect(agentPanel.attachmentChip(AUDIO)).toBeVisible()
      await expect(
        agentPanel.composerAssetSection.getByRole('status', {
          name: enMessages.agent.uploading
        })
      ).toHaveCount(0)

      await agentPanel.removeAllAttachments()

      await agentPanel.dropFile(comfyPage.dragDrop, VIDEO)
      await expect(agentPanel.attachmentChip(VIDEO)).toBeVisible()
      await agentPanel.dropFile(comfyPage.dragDrop, AUDIO)
      await expect(agentPanel.attachmentChip(AUDIO)).toBeVisible()

      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
    })

    test('refuses an oversized file the same way whichever route it arrives by', async ({
      agentPanel,
      comfyPage
    }, testInfo) => {
      await agentPanel.open()

      await comfyPage.featureFlags.setServerFlagsPersistent({
        max_upload_size: PINNED_UPLOAD_LIMIT_BYTES
      })

      const oversized = {
        name: 'oversized.mp4',
        byteLength: PINNED_UPLOAD_LIMIT_BYTES + 1
      }
      const warning = comfyPage.toast.withText(
        enMessages.agent.attachmentTooLarge
          .replace('{name}', oversized.name)
          .replace('{limit}', formatSize(PINNED_UPLOAD_LIMIT_BYTES))
      )

      const path = testInfo.outputPath(oversized.name)
      await writeFile(path, '')
      await truncate(path, oversized.byteLength)
      await agentPanel.fileInput.setInputFiles(path)
      await expect(warning).toBeVisible()
      await expect(agentPanel.attachmentChip(oversized.name)).toHaveCount(0)

      await comfyPage.toast.closeToasts()

      await agentPanel.dropGeneratedFile(comfyPage.dragDrop, {
        ...oversized,
        type: 'video/mp4'
      })
      await expect(warning).toBeVisible()
      await expect(agentPanel.attachmentChip(oversized.name)).toHaveCount(0)
    })

    test('gives the same answer for a .csv whether it is picked or dropped', async ({
      agentPanel,
      comfyPage
    }) => {
      await agentPanel.open()

      const picked = await agentPanel.handOverAttachment(CSV, () =>
        agentPanel.fileInput.setInputFiles(assetPath(CSV))
      )
      await agentPanel.removeAllAttachments()
      const dropped = await agentPanel.handOverAttachment(CSV, () =>
        agentPanel.dropFile(comfyPage.dragDrop, CSV)
      )

      expect(dropped).not.toBe('ignored')
      expect(
        dropped,
        `the file browser answered "${picked}"; a drop of the same file must answer the same`
      ).toBe(picked)
    })
  }
)
