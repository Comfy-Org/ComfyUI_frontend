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

/**
 * Every format in the agreed list (PM-1855), driven through the real picker.
 *
 * Synthetic buffers rather than fixture files, deliberately: the gate under test
 * judges the EXTENSION and never opens the bytes, so a file named `mesh.fbx`
 * exercises it exactly as a real mesh would. That is what makes covering all 52
 * formats possible — `browser_tests/assets` holds a real asset for only four of
 * them. Content-parsing behaviour is not tested here because the composer does
 * none; the backend does, and its tests own it.
 *
 * Grouped by tier rather than one test per format: a per-format test would mean
 * 52 browser sessions for a check that shares all of its setup. Each format is
 * still named in an assertion message, so a failure says which one broke.
 */
const CAPABILITY_COPY: Record<AgentAttachCapability, string> = {
  view: enMessages.agent.attachmentCapabilityView,
  probe: enMessages.agent.attachmentCapabilityProbe,
  read: enMessages.agent.attachmentCapabilityRead,
  reference: enMessages.agent.attachmentCapabilityReference,
  retain: enMessages.agent.attachmentCapabilityRetain
}

const ACCEPTED: ReadonlyArray<{
  tier: AgentAttachCapability
  files: readonly string[]
}> = [
  {
    tier: 'view',
    files: [
      'photo.png',
      'photo.jpg',
      'photo.jpeg',
      'photo.gif',
      'photo.webp',
      'photo.bmp',
      'photo.tif',
      'photo.tiff'
    ]
  },
  {
    tier: 'probe',
    files: [
      'clip.mp4',
      'clip.webm',
      'clip.mov',
      'clip.m4v',
      'clip.avi',
      'clip.mkv',
      'track.mp3',
      'track.wav',
      'track.ogg',
      'track.opus',
      'track.flac',
      'track.m4a'
    ]
  },
  {
    tier: 'read',
    files: [
      'notes.md',
      'notes.markdown',
      'notes.txt',
      'data.json',
      'data.csv',
      'conf.yaml',
      'conf.yml',
      'feed.xml',
      'server.log',
      'logo.svg'
    ]
  },
  {
    tier: 'reference',
    files: [
      'mesh.glb',
      'mesh.obj',
      'mesh.fbx',
      'mesh.gltf',
      'mesh.stl',
      'cloud.ply',
      'cloud.spz',
      'cloud.splat',
      'cloud.ksplat'
    ]
  },
  { tier: 'retain', files: ['photo.avif'] }
]

/** Every type PM-1855 requires be refused. */
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

function syntheticFile(name: string) {
  return {
    name,
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(name)
  }
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
      // The wildcards this replaced are what let .hdr, .exr, .wmv and .wma
      // reach a paperclip that did no checking of its own (PM-1854).
      expect(AGENT_ATTACH_ACCEPT).not.toContain('/*')
      for (const rejected of REJECTED) {
        expect(
          AGENT_ATTACH_ACCEPT.split(','),
          `${rejected} must not be offered by the picker`
        ).not.toContain(rejected.slice(rejected.lastIndexOf('.')))
      }
    })

    for (const { tier, files } of ACCEPTED) {
      test(`attaches every ${tier}-tier format and labels it as ${tier}`, async ({
        agentPanel
      }) => {
        await agentPanel.open()
        const { fileInput, composerAssetSection: assetSection } = agentPanel

        for (const file of files) {
          expect(
            agentAttachCapability(file),
            `${file} must sit on the ${tier} tier`
          ).toBe(tier)

          await fileInput.setInputFiles(syntheticFile(file))
          await expect(assetSection, `${file} must attach`).toContainText(file)

          const chip = assetSection
            .getByTestId('agent-attachment-chip')
            .filter({ hasText: file })
          await expect(
            chip,
            `${file} must state its capability`
          ).toHaveAttribute('title', CAPABILITY_COPY[tier])
          await expect(
            assetSection.locator(`[aria-label="${enMessages.agent.uploading}"]`)
          ).toHaveCount(0)

          await chip
            .getByRole('button', { name: enMessages.agent.remove, exact: true })
            .click()
          await expect(chip).toHaveCount(0)
        }
      })
    }

    test('refuses every rejected format and says which file it refused', async ({
      agentPanel,
      comfyPage
    }) => {
      await agentPanel.open()

      for (const file of REJECTED) {
        expect(
          agentAttachCapability(file),
          `${file} must not be on any tier`
        ).toBeUndefined()

        await agentPanel.fileInput.setInputFiles(syntheticFile(file))

        // PM-1856: the refusal names the file rather than failing silently.
        await expect(
          comfyPage.page.getByText(file, { exact: false }),
          `${file} must be reported as refused`
        ).toBeVisible()
        await expect(
          agentPanel.composerAssetSection,
          `${file} must not stage a chip`
        ).toHaveCount(0)
      }
    })

    test('attaches a .json dropped on the panel instead of opening it as a workflow', async ({
      agentPanel,
      comfyPage
    }) => {
      await agentPanel.open()
      const { root: panel, composerAssetSection: assetSection } = agentPanel
      await expect(assetSection).toHaveCount(0)

      const panelBox = await panel.boundingBox()
      if (!panelBox) throw new Error('Agent panel is not visible')
      await comfyPage.dragDrop.dragAndDropFile('default.json', {
        preserveNativePropagation: true,
        dropPosition: {
          x: panelBox.x + panelBox.width / 2,
          y: panelBox.y + panelBox.height / 2
        }
      })

      // Dropping onto the composer means "attach this to the chat" (PM-1855).
      // The canvas still opens a workflow, through its own drop handler.
      await expect(assetSection).toContainText('default.json')
      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
    })

    test('attaches the real fixtures that exist on disk through the picker', async ({
      agentPanel
    }) => {
      // The synthetic-buffer cases above prove the gate; these prove the picker
      // path works against genuine bytes for the formats that have an asset.
      await agentPanel.open()
      const { fileInput, composerAssetSection: assetSection } = agentPanel

      for (const file of [
        'default.json',
        'animated_triangle.glb',
        'cube.obj'
      ]) {
        await fileInput.setInputFiles(assetPath(file))
        await expect(assetSection, `${file} must attach`).toContainText(file)
        await assetSection
          .getByTestId('agent-attachment-chip')
          .filter({ hasText: file })
          .getByRole('button', { name: enMessages.agent.remove, exact: true })
          .click()
      }
    })
  }
)
