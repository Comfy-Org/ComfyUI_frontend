import { expect } from '@playwright/test'

import type { ComfyPage } from '../../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

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
  await comfyPage.page.keyboard.press('Escape')
  await comfyPage.nextFrame()

  await subgraphNode.click('title')
  await comfyPage.command.executeCommand('Comfy.PublishSubgraph', {
    name: blueprintName
  })

  await expect(comfyPage.visibleToasts).toHaveCount(1, { timeout: 5_000 })
  await comfyPage.toast.closeToasts(1)
}

async function searchAndExpectResult(
  comfyPage: ComfyPage,
  searchTerm: string,
  expectedResult: string
) {
  await comfyPage.command.executeCommand('Workspace.SearchBox.Toggle')
  await expect(comfyPage.searchBox.input).toHaveCount(1)
  await comfyPage.searchBox.input.fill(searchTerm)
  await expect(comfyPage.searchBox.findResult(expectedResult)).toBeVisible({
    timeout: 10_000
  })
}

test.describe('Subgraph Search Aliases', { tag: ['@subgraph'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.NodeSearchBoxImpl',
      'v1 (legacy)'
    )
  })

  test('Can set description on subgraph', async ({ comfyPage }) => {
    await createSubgraphAndNavigateInto(comfyPage)

    await comfyPage.command.executeCommand('Comfy.Subgraph.SetDescription', {
      description: 'This is a test description'
    })

    const description = await comfyPage.page.evaluate(() => {
      const subgraph = window.app!.canvas.subgraph
      return (subgraph?.extra as Record<string, unknown>)?.BlueprintDescription
    })

    expect(description).toBe('This is a test description')
  })

  test('Published search aliases remain searchable after reload', async ({
    comfyPage
  }) => {
    const subgraphNode = await createSubgraphAndNavigateInto(comfyPage)

    await comfyPage.command.executeCommand('Comfy.Subgraph.SetSearchAliases', {
      aliases: 'dragon, fire breather'
    })

    const blueprintName = `test-persist-${Date.now()}`
    await exitSubgraphAndPublish(comfyPage, subgraphNode, blueprintName)

    await comfyPage.page.reload()
    await comfyPage.page.waitForFunction(
      () => window.app && window.app.extensionManager
    )
    await comfyPage.nextFrame()

    await searchAndExpectResult(comfyPage, 'dragon', blueprintName)
  })
})
