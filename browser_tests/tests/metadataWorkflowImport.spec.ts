import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { metadataFixturePath } from '@e2e/fixtures/utils/paths'

type MetadataFixture = {
  fileName: string
  parser: string
}

// Each fixture embeds the same single-KSampler workflow (see
// scripts/generate-embedded-metadata-test-files.py), exercising a different
// parser in src/scripts/metadata/. Dropping the file should import that
// workflow.
const FIXTURES: readonly MetadataFixture[] = [
  { fileName: 'with_metadata.png', parser: 'png' },
  { fileName: 'with_metadata.avif', parser: 'avif' },
  { fileName: 'with_metadata.webp', parser: 'webp' },
  { fileName: 'with_metadata_exif_prefix.webp', parser: 'webp (exif prefix)' },
  { fileName: 'with_metadata.flac', parser: 'flac' },
  { fileName: 'with_metadata.mp3', parser: 'mp3' },
  { fileName: 'with_metadata.opus', parser: 'ogg' },
  { fileName: 'with_metadata.mp4', parser: 'isobmff' },
  { fileName: 'with_metadata.webm', parser: 'ebml (webm)' }
] as const

test.describe(
  'Metadata drop-to-load workflow import',
  { tag: ['@workflow'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
    })

    for (const { fileName, parser } of FIXTURES) {
      test(`loads embedded workflow from ${fileName} (${parser})`, async ({
        comfyPage
      }) => {
        await test.step(`drop ${fileName} on canvas`, async () => {
          await comfyPage.dragDrop.dragAndDropFilePath(
            metadataFixturePath(fileName)
          )
        })

        await test.step('graph contains only the embedded KSampler', async () => {
          await expect
            .poll(() => comfyPage.nodeOps.getGraphNodesCount())
            .toBe(1)

          const ksamplers =
            await comfyPage.nodeOps.getNodeRefsByType('KSampler')
          expect(
            ksamplers,
            'exactly one KSampler should have been loaded from the fixture'
          ).toHaveLength(1)
        })
      })
    }
  }
)
