import { expect } from '@playwright/test'

import type { UploadImageResponse } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import {
  AGENT_ATTACH_ACCEPT,
  agentAttachCapability
} from '@/workbench/extensions/agent/utils/attachableFiles'
import type { AgentAttachCapability } from '@/workbench/extensions/agent/utils/attachableFiles'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const ACCEPTED: ReadonlyArray<{
  tier: AgentAttachCapability
  file: string
}> = [
  { tier: 'view', file: 'photo.png' },
  { tier: 'probe', file: 'clip.mp4' },
  { tier: 'read', file: 'notes.md' },
  { tier: 'reference', file: 'mesh.glb' },
  { tier: 'retain', file: 'photo.avif' }
]

const REJECTED = [
  'page.html',
  'bundle.js',
  'style.css',
  'doc.pdf',
  'clip.wmv',
  'clip.flv',
  'scene.usdz',
  'env.hdr',
  'track.aac',
  'track.aiff',
  'track.wma',
  'plate.exr'
] as const

const VIDEO_HEADERS: Partial<Record<string, Buffer>> = {
  mp4: Buffer.from('\0\0\0\x18ftypisom', 'latin1')
}

function syntheticFile(name: string) {
  const extension = name.slice(name.lastIndexOf('.') + 1)
  return {
    name,
    mimeType: 'application/octet-stream',
    buffer: VIDEO_HEADERS[extension] ?? Buffer.from(name)
  }
}

function unsupportedTypeMessage(name: string): string {
  return enMessages.agent.attachmentUnsupportedType.replace('{name}', name)
}

test.describe(
  'Agent composer accepted file types',
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

    test('advertises extensions only, so the OS picker cannot offer a rejected type', async ({
      agentPanel
    }) => {
      await agentPanel.open()

      await expect(agentPanel.fileInput).toHaveAttribute(
        'accept',
        AGENT_ATTACH_ACCEPT
      )
      expect(AGENT_ATTACH_ACCEPT).not.toContain('/*')
      for (const rejected of REJECTED) {
        expect(
          AGENT_ATTACH_ACCEPT.split(','),
          `${rejected} must not be offered by the picker`
        ).not.toContain(rejected.slice(rejected.lastIndexOf('.')))
      }
    })

    for (const { tier, file } of ACCEPTED) {
      test(`uploads a ${tier}-tier file (${file}) and leaves no status on its chip`, async ({
        agentPanel,
        comfyPage
      }) => {
        await agentPanel.open()
        const upload = comfyPage.page.waitForRequest(
          (request) =>
            request.method() === 'POST' &&
            request.url().endsWith('/api/upload/image')
        )

        await agentPanel.fileInput.setInputFiles(syntheticFile(file))

        const chip = agentPanel.attachmentChip(file)
        await expect(chip).toBeVisible()
        await expect(
          chip.getByRole('status'),
          `${file} must finish uploading with no validation status`
        ).toHaveCount(0)
        expect((await upload).postDataBuffer()?.toString('latin1')).toContain(
          `filename="${file}"`
        )
      })
    }

    test('stages every rejected format as an invalid chip that is never uploaded', async ({
      agentPanel,
      comfyPage
    }) => {
      const uploads: string[] = []
      comfyPage.page.on('request', (request) => {
        if (request.url().includes('/api/upload/image'))
          uploads.push(request.url())
      })
      await agentPanel.open()

      for (const file of REJECTED) {
        expect(
          agentAttachCapability(file),
          `${file} must not be on any tier`
        ).toBeUndefined()

        await agentPanel.fileInput.setInputFiles(syntheticFile(file))

        const chip = agentPanel.attachmentChip(file)
        await expect(
          chip.getByRole('status', { name: unsupportedTypeMessage(file) }),
          `${file} must be staged as an invalid chip`
        ).toBeVisible()
        await expect(comfyPage.toast.withText(file)).toHaveCount(0)
        await chip.hover()
        await chip
          .getByRole('button', {
            name: enMessages.agent.removeAsset.replace('{name}', file),
            exact: true
          })
          .click()
        await expect(chip).toHaveCount(0)
      }
      expect(uploads).toEqual([])
    })

    test('blocks Send for refused files from any path until they are removed', async ({
      agentPanel,
      comfyPage
    }) => {
      const page = comfyPage.page
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.composer.fill('Describe these files')
      await expect(agentPanel.sendButton).toBeEnabled()

      const dataTransfer = await page.evaluateHandle(() => {
        const transfer = new DataTransfer()
        transfer.items.add(
          new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })
        )
        return transfer
      })
      try {
        await agentPanel.root.dispatchEvent('drop', { dataTransfer })
      } finally {
        await dataTransfer.dispose()
      }
      await expect(
        agentPanel
          .attachmentChip('doc.pdf')
          .getByRole('status', { name: unsupportedTypeMessage('doc.pdf') })
      ).toBeVisible()
      await agentPanel.sendButton.hover()
      await expect(
        page.getByRole('tooltip', {
          name: enMessages.agent.sendBlockedByUnsupportedType.replace(
            '{name}',
            'doc.pdf'
          ),
          exact: true
        })
      ).toBeVisible()

      await agentPanel.fileInput.setInputFiles({
        name: 'renamed.mp4',
        mimeType: 'video/mp4',
        buffer: Buffer.from('plain text')
      })
      await expect(
        agentPanel.attachmentChip('renamed.mp4').getByRole('status')
      ).toBeVisible()
      await page.mouse.move(0, 0)
      await agentPanel.sendButton.hover()
      await expect(
        page.getByRole('tooltip', {
          name: enMessages.agent.sendBlockedByInvalidAttachments.replace(
            '{count}',
            '2'
          ),
          exact: true
        })
      ).toBeVisible()
      await agentPanel.composer.press('Enter')
      await expect(agentPanel.composer).toHaveText('Describe these files')

      await agentPanel.close()
      await agentPanel.open()
      await expect(agentPanel.attachmentChip('doc.pdf')).toBeVisible()
      await expect(agentPanel.composer).toHaveText('Describe these files')
      await expect(agentPanel.sendButton).toBeDisabled()
      await expect(comfyPage.toast.withText('doc.pdf')).toHaveCount(0)

      await agentPanel.removeAllAttachments()
      await expect(agentPanel.sendButton).toBeEnabled()
    })

    test('attaches a .json dropped on the panel instead of opening it as a workflow', async ({
      agentPanel,
      comfyPage
    }) => {
      await agentPanel.open()
      await expect(agentPanel.composerAssetSection).toHaveCount(0)

      await agentPanel.dropFile(comfyPage.dragDrop, 'default.json')

      await expect(agentPanel.attachmentChip('default.json')).toBeVisible()
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
    })

    test('still opens a .json dropped on the CANVAS as a workflow', async ({
      agentPanel,
      comfyPage
    }) => {
      await agentPanel.open()
      await expect(agentPanel.composerAssetSection).toHaveCount(0)

      await comfyPage.dragDrop.dragAndDropFile('default.json', {
        preserveNativePropagation: true
      })

      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(7)
      expect(
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      ).toHaveLength(1)
      await expect(
        agentPanel.composerAssetSection,
        'a canvas drop must not attach to the chat'
      ).toHaveCount(0)
    })

    test('attaches the real fixtures that exist on disk through the picker', async ({
      agentPanel
    }) => {
      await agentPanel.open()

      for (const file of [
        'default.json',
        'animated_triangle.glb',
        'cube.obj'
      ]) {
        await agentPanel.fileInput.setInputFiles(assetPath(file))
        const chip = agentPanel.attachmentChip(file)
        await expect(chip, `${file} must attach`).toBeVisible()
        await expect(
          chip.getByRole('status', { name: enMessages.agent.uploading })
        ).toHaveCount(0)
        await chip.hover()
        await chip
          .getByRole('button', {
            name: enMessages.agent.removeAsset.replace('{name}', file),
            exact: true
          })
          .click()
        await expect(chip).toHaveCount(0)
      }
    })
  }
)
