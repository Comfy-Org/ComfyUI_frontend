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

// NaN-variant fixtures embed only an API-format prompt containing bare
// `NaN`/`Infinity` tokens (Python's `json.dumps` default). The loader must
// tolerate Python generated JSON for these to import successfully.
const NAN_FIXTURES: readonly MetadataFixture[] = [
  { fileName: 'with_nan_metadata.json', parser: 'json' },
  { fileName: 'with_nan_metadata.png', parser: 'png' },
  { fileName: 'with_nan_metadata.avif', parser: 'avif' },
  { fileName: 'with_nan_metadata.webp', parser: 'webp' },
  { fileName: 'with_nan_metadata.flac', parser: 'flac' },
  { fileName: 'with_nan_metadata.mp3', parser: 'mp3' },
  { fileName: 'with_nan_metadata.opus', parser: 'ogg' },
  { fileName: 'with_nan_metadata.mp4', parser: 'isobmff' },
  { fileName: 'with_nan_metadata.webm', parser: 'ebml (webm)' }
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

    for (const { fileName, parser } of NAN_FIXTURES) {
      test(`loads Python JSON prompt with NaN/Infinity from ${fileName} (${parser})`, async ({
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
            'exactly one KSampler should have been loaded from the NaN-laden prompt'
          ).toHaveLength(1)
        })

        await test.step('NaN-coerced widget values are 0', async () => {
          const [ksampler] =
            await comfyPage.nodeOps.getNodeRefsByType('KSampler')
          for (const widgetName of ['cfg', 'denoise']) {
            const widget = await ksampler.getWidgetByName(widgetName)
            expect(
              await widget.getValue(),
              `${widgetName} should be 0 after NaN coercion to null`
            ).toBe(0)
          }
        })
      })
    }
  }
)
