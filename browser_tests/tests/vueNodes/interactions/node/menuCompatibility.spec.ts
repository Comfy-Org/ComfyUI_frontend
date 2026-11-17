import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/menuCompatibilityFixture'
import { openContextMenu } from '@e2e/fixtures/utils/contextMenuTestHelpers'

test.describe('Explicit node menu compatibility', { tag: '@vue-nodes' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
  })

  test('uses the final patched core menu and wrapped action', async ({
    comfyPage
  }) => {
    const node = await comfyPage.nodeOps.getNodeRefByTitle('Empty Latent Image')
    const menu = await openContextMenu(comfyPage, 'Empty Latent Image')
    await expect(
      menu.getByRole('menuitem', { name: 'Copy', exact: true })
    ).toHaveCount(0)
    await expect(menu.getByRole('menuitem').first()).toHaveText(
      'Duplicate label'
    )
    await expect(
      menu.getByRole('menuitem', { name: 'Duplicate label', exact: true })
    ).toHaveCount(2)
    await expect(menu.getByRole('menuitem').last()).toHaveText('Returned extra')
    await comfyPage.contextMenu.clickMenuItemExact('Pin')
    await expect.poll(() => node.isPinned()).toBe(true)
    await expect(
      comfyPage.vueNodes.getNodeByTitle('Wrapped pin selected 1')
    ).toBeVisible()
  })

  test('opens recursive declarative extension children only on selection', async ({
    comfyPage
  }) => {
    await openContextMenu(comfyPage, 'Empty Latent Image')
    await comfyPage.contextMenu.menuItem('Go to node').hover()
    await comfyPage.page
      .getByRole('menuitem', { name: 'Latent', exact: true })
      .hover()
    await expect(
      comfyPage.vueNodes.getNodeByTitle('Empty Latent Image')
    ).toBeVisible()
    await comfyPage.page
      .getByRole('menuitem', { name: 'Select latent', exact: true })
      .click()
    await expect(
      comfyPage.vueNodes.getNodeByTitle('Nested action selected')
    ).toBeVisible()
  })

  test.describe('Native callback contract', () => {
    test.use({ menuScenario: 'native' })

    test('defers imperative submenus and supplies real event, menu and receiver', async ({
      comfyPage
    }) => {
      const node =
        await comfyPage.nodeOps.getNodeRefByTitle('Empty Latent Image')
      await node.centerOnNode()
      const fixture =
        await comfyPage.vueNodes.getFixtureByTitle('Empty Latent Image')
      await fixture.header.click({ button: 'right' })
      const nativeSubmenu = comfyPage.page.getByRole('menuitem', {
        name: /^Native layout/
      })
      await expect(nativeSubmenu).toBeVisible()
      await expect(
        comfyPage.vueNodes.getNodeByTitle('Empty Latent Image')
      ).toBeVisible()
      await nativeSubmenu.click()
      await expect(
        comfyPage.vueNodes.getNodeByTitle('Native submenu opened')
      ).toBeVisible()
      await comfyPage.contextMenu.menuItem('Right').click()
      await expect(
        comfyPage.vueNodes.getNodeByTitle('Native right selected')
      ).toBeVisible()
      await expect(comfyPage.page.locator('.litecontextmenu')).toHaveCount(0)
      const renamed = await comfyPage.vueNodes.getFixtureByTitle(
        'Native right selected'
      )
      await comfyPage.contextMenu.openFor(renamed.header)
      await comfyPage.contextMenu.dispatchFor(renamed.header)
      await expect(comfyPage.page.locator('.litecontextmenu')).toHaveCount(1)
      const sampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      await comfyPage.contextMenu.dispatchFor(sampler.header)
      await expect(comfyPage.page.locator('.litecontextmenu')).toHaveCount(0)
    })
  })

  test.describe('Complete replacement', () => {
    test.use({ menuScenario: 'replacement' })

    test('does not regenerate core actions after a method override', async ({
      comfyPage
    }) => {
      const menu = await openContextMenu(comfyPage, 'Empty Latent Image')
      await expect(menu.getByRole('menuitem')).toHaveText(['Replacement only'])
      await comfyPage.contextMenu.clickMenuItemExact('Replacement only')
      await expect(
        comfyPage.vueNodes.getNodeByTitle('Replacement selected')
      ).toBeVisible()
    })
  })
})
