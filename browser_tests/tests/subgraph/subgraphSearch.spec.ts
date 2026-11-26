import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { publishedBlueprintFixture as test } from '@e2e/fixtures/publishedBlueprintFixture'

async function createSubgraphAndNavigateInto(comfyPage: ComfyPage) {
  const subgraphNode =
    await comfyPage.subgraph.convertDefaultKSamplerToSubgraph()
  await subgraphNode.navigateIntoSubgraph()
  return subgraphNode
}

async function exitSubgraphAndPublish(
  comfyPage: ComfyPage,
  subgraphNode: Awaited<ReturnType<typeof createSubgraphAndNavigateInto>>,
  blueprintName: string
) {
  await comfyPage.keyboard.press('Escape')

  await subgraphNode.click('title')
  await comfyPage.command.executeCommand('Comfy.PublishSubgraph', {
    name: blueprintName
  })

  await expect(comfyPage.toast.visibleToasts).toHaveCount(1)
  await comfyPage.toast.closeToasts(1)
}

test.describe('Subgraph Search Aliases', { tag: ['@subgraph'] }, () => {
  test.use({ initialSettings: { 'Comfy.NodeSearchBoxImpl': 'v1 (legacy)' } })

  test('Can set description on subgraph', async ({ comfyPage }) => {
    await createSubgraphAndNavigateInto(comfyPage)

    await comfyPage.command.executeCommand('Comfy.Subgraph.SetDescription', {
      description: 'This is a test description'
    })
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => {
          const subgraph = window.app!.canvas.subgraph
          if (!subgraph) return undefined
          return (subgraph.extra as Record<string, unknown>)
            .BlueprintDescription
        })
      )
      .toBe('This is a test description')
  })

  test('Published search aliases remain searchable after reload', async ({
    comfyPage,
    publishedBlueprint
  }) => {
    const subgraphNode = await createSubgraphAndNavigateInto(comfyPage)
    await comfyPage.command.executeCommand('Comfy.Subgraph.SetSearchAliases', {
      aliases: 'dragon, fire breather'
    })
    await exitSubgraphAndPublish(
      comfyPage,
      subgraphNode,
      publishedBlueprint.name
    )

    await publishedBlueprint.holdLoads()
    await comfyPage.page.reload()
    await comfyPage.page.waitForFunction(
      () => window.app && window.app.extensionManager
    )
    await comfyPage.nextFrame()
    await publishedBlueprint.loadHeld

    await test.step('search for the alias before the blueprint loads', async () => {
      await comfyPage.command.executeCommand('Workspace.SearchBox.Toggle')
      await comfyPage.searchBox.input.fill('KSampler')
      await expect(
        comfyPage.searchBox.findResult('KSampler').first()
      ).toBeVisible()
      await comfyPage.searchBox.input.fill('dragon')
      await expect(comfyPage.searchBox.resultOptions).toHaveCount(0)
    })

    publishedBlueprint.releaseLoads()

    await expect(
      comfyPage.searchBox.findResult(publishedBlueprint.name)
    ).toBeVisible()
  })
})
