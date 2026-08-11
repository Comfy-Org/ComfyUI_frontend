/**
 * FE-1425: a Load Image node populated from the assets sidebar's Generated tab
 * holds an `[output]`-annotated widget value. The preview must resolve it to
 * the output directory instead of asking for the annotation as part of the
 * filename under `type=input`, which 404s and renders "Image failed to load".
 */
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Load Image annotated widget value', () => {
  test('requests an [output] widget value from the output directory', async ({
    comfyPage
  }) => {
    const viewRequests: URL[] = []
    await comfyPage.page.route('**/api/view?*', async (route) => {
      viewRequests.push(new URL(route.request().url()))
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64'
        )
      })
    })

    await comfyPage.workflow.loadWorkflow(
      'widgets/load_image_widget_output_annotated'
    )

    await expect(() => expect(viewRequests.length).toBeGreaterThan(0)).toPass({
      timeout: 15_000
    })

    const params = viewRequests[0].searchParams
    expect(params.get('type')).toBe('output')
    expect(params.get('filename')).toBe('generated.png')
    expect(params.get('subfolder')).toBe('runs/2026')
  })
})
