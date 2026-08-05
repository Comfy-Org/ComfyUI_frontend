import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { assetPath } from '@e2e/fixtures/utils/paths'

async function uploadImageToHost(
  comfyPage: ComfyPage,
  nodeId: string,
  filename: string
) {
  const node = comfyPage.vueNodes.getNodeLocator(nodeId)
  const uploadResponse = comfyPage.page.waitForResponse(
    (response) =>
      response.url().includes('/upload/') && response.status() === 200
  )

  await node
    .locator('input[type="file"][aria-label="Upload"]')
    .setInputFiles(assetPath(filename))
  await uploadResponse
}

test.describe(
  'Promoted image widget projection',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.route('**/api/view?*', (route) =>
        route.fulfill({
          contentType: 'image/webp',
          path: assetPath('image64x64.webp')
        })
      )
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-image-widget'
      )
      await uploadImageToHost(comfyPage, '11', 'image64x64.webp')
      await uploadImageToHost(comfyPage, '12', 'image32x32.webp')
    })

    test('shows the entered host value and preview without changing the definition value', async ({
      comfyPage
    }) => {
      const firstHost = comfyPage.vueNodes.getNodeLocator('11')
      const secondHost = comfyPage.vueNodes.getNodeLocator('12')
      await expect(
        firstHost.getByRole('button', {
          name: 'image64x64.webp',
          exact: true
        })
      ).toBeVisible()
      await expect(
        secondHost.getByRole('button', {
          name: 'image32x32.webp',
          exact: true
        })
      ).toBeVisible()

      await comfyPage.vueNodes.enterSubgraph('12')
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      const interiorNode = comfyPage.vueNodes.getNodeLocator('1')
      const projectedValue = interiorNode.getByRole('button', {
        name: 'image32x32.webp',
        exact: true
      })
      const previewImage = interiorNode.locator('.image-preview img')

      await expect(projectedValue).toBeVisible()
      await expect(projectedValue).toBeDisabled()
      await expect(previewImage).toBeVisible()
      await expect(
        interiorNode.getByRole('button', { name: 'Edit or mask image' })
      ).toHaveCount(0)
      await expect
        .poll(async () => {
          const src = await previewImage.getAttribute('src')
          if (!src) return null
          const params = new URL(src, 'http://localhost').searchParams
          return {
            filename: params.get('filename'),
            subfolder: params.get('subfolder'),
            type: params.get('type')
          }
        })
        .toEqual({
          filename: 'image32x32.webp',
          subfolder: '',
          type: 'input'
        })

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.canvas.graph?.nodes.find(
              (candidate) => String(candidate.id) === '1'
            )
            return node?.widgets?.find((widget) => widget.name === 'image')
              ?.value
          })
        )
        .toBe('interior.png')

      const goToParent = interiorNode.getByRole('button', {
        name: 'Go to parent node'
      })
      await expect(goToParent).toBeVisible()
      await goToParent.click()
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
      await expect(secondHost).toBeVisible()
    })

    test('keeps the interior fallback read-only when the shared host is ambiguous', async ({
      comfyPage
    }) => {
      await comfyPage.page.evaluate(() => {
        window.location.hash = '#11111111-2222-4333-8444-555555555555'
      })
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      const interiorNode = comfyPage.vueNodes.getNodeLocator('1')
      const fallbackValue = interiorNode.getByRole('button', {
        name: 'interior.png',
        exact: true
      })

      await expect(fallbackValue).toBeVisible()
      await expect(fallbackValue).toBeDisabled()
      await expect(
        interiorNode.getByRole('button', { name: 'Go to parent node' })
      ).toHaveCount(0)
    })
  }
)

test.describe(
  'Nested promoted image widget projection',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.route('**/api/view?*', (route) =>
        route.fulfill({
          contentType: 'image/webp',
          path: assetPath('image32x32.webp')
        })
      )
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-nested-promoted-image-widget'
      )
      await uploadImageToHost(comfyPage, '12', 'image32x32.webp')
    })

    test('preserves the selected root host through nested entry and return', async ({
      comfyPage
    }) => {
      await comfyPage.vueNodes.enterSubgraph('12')

      const intermediateHost = comfyPage.vueNodes.getNodeLocator('77')
      await expect(
        intermediateHost.getByRole('button', {
          name: 'image32x32.webp',
          exact: true
        })
      ).toBeVisible()
      await expect(intermediateHost.locator('.image-preview img')).toBeVisible()

      await comfyPage.vueNodes.enterSubgraph('77')

      const interiorNode = comfyPage.vueNodes.getNodeLocator('1')
      await expect(
        interiorNode.getByRole('button', {
          name: 'image32x32.webp',
          exact: true
        })
      ).toBeVisible()
      await expect(interiorNode.locator('.image-preview img')).toBeVisible()

      await comfyPage.page.getByTestId('subgraph-breadcrumb-back').click()

      await expect(
        intermediateHost.getByRole('button', {
          name: 'image32x32.webp',
          exact: true
        })
      ).toBeVisible()
      await expect(intermediateHost.locator('.image-preview img')).toBeVisible()

      await comfyPage.vueNodes.enterSubgraph('77')
      await interiorNode
        .getByRole('button', { name: 'Go to parent node' })
        .click()

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
      await expect(
        comfyPage.vueNodes.getNodeLocator('12').getByRole('button', {
          name: 'image32x32.webp',
          exact: true
        })
      ).toBeVisible()
    })
  }
)
