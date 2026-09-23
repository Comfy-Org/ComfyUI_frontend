import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { TestIds } from '@e2e/fixtures/selectors'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe('Linear Agent UX scenarios', { tag: '@cloud' }, () => {
  test('shows fewer suggestions below the compact panel breakpoint', async ({
    agentPanel
  }) => {
    await agentPanel.open()
    const suggestions = agentPanel.suggestedPrompts

    await test.step('Resize below the breakpoint', async () => {
      await agentPanel.resizeTo(459)
      await expect.soft(suggestions[0]).toBeVisible()
      await expect.soft(suggestions[1]).toBeVisible()
      await expect.soft(suggestions[2]).toBeVisible()
      await expect.soft(suggestions[3]).toBeHidden()
      await expect.soft(suggestions[4]).toBeHidden()
    })

    await test.step('Resize to the expanded breakpoint', async () => {
      await agentPanel.resizeTo(460)
      await expect.soft(suggestions[0]).toBeVisible()
      await expect.soft(suggestions[1]).toBeVisible()
      await expect.soft(suggestions[2]).toBeVisible()
      await expect.soft(suggestions[3]).toBeVisible()
      await expect.soft(suggestions[4]).toBeVisible()
    })
  })

  for (const width of [480, 640]) {
    test(`X-01 / PM-672 keeps controls usable at ${width}px panel width`, async ({
      comfyPage,
      agentPanel
    }) => {
      const page = comfyPage.page
      await agentPanel.open()
      const panel = page.locator('#agent-panel-root')

      await agentPanel.resizeTo(width)

      const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
      const send = panel.getByRole('button', { name: 'Send' })
      await composer.fill('Keep controls usable')

      await expect(composer).toBeInViewport()
      await expect(send).toBeInViewport()
      await expect(send).toBeEnabled()
    })
  }
})

test.describe('Agent panel neighbor layout', { tag: ['@cloud', '@ui'] }, () => {
  for (const {
    sidebarLocation,
    propertiesSide,
    background,
    borderWidth,
    gutterWidth
  } of [
    {
      sidebarLocation: 'left',
      propertiesSide: 'right',
      background: 'rgb(23, 23, 24)',
      borderWidth: '1px',
      gutterWidth: '8px'
    },
    {
      sidebarLocation: 'right',
      propertiesSide: 'left',
      background: 'rgba(0, 0, 0, 0)',
      borderWidth: '0px',
      gutterWidth: '0px'
    }
  ]) {
    test.describe(`properties on the ${propertiesSide}`, () => {
      test.use({
        initialSettings: {
          'Comfy.ColorPalette': 'dark',
          'Comfy.Sidebar.Location': sidebarLocation,
          'Comfy.RightSidePanel.IsOpen': false
        }
      })

      test('uses an opaque Agent surface and graph gutter only for adjacent properties', async ({
        comfyPage,
        agentPanel
      }) => {
        const shell = comfyPage.page.getByTestId('docked-agent-panel-shell')
        const gutter = comfyPage.page.getByTestId('graph-canvas-gutter')
        const properties = comfyPage.page.getByTestId(
          TestIds.propertiesPanel.root
        )

        await agentPanel.open()
        await expect(properties).toBeHidden()
        await expect(shell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
        await expect(shell).toHaveCSS('border-left-width', '0px')
        await expect(gutter).toHaveCSS('margin-right', '0px')

        await comfyPage.actionbar.propertiesButton.click()
        await expect(properties).toBeVisible()
        await expect(shell).toHaveCSS('background-color', background)
        await expect(shell).toHaveCSS('border-left-width', borderWidth)
        await expect(gutter).toHaveCSS('margin-right', gutterWidth)

        await properties
          .getByRole('button', { name: enMessages.rightSidePanel.togglePanel })
          .click()
        await expect(properties).toBeHidden()
        await expect(shell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
        await expect(shell).toHaveCSS('border-left-width', '0px')
        await expect(gutter).toHaveCSS('margin-right', '0px')
      })
    })
  }

  test.describe('sidebar on the right', () => {
    test.use({
      initialSettings: {
        'Comfy.ColorPalette': 'dark',
        'Comfy.Sidebar.Location': 'right',
        'Comfy.NodeLibrary.NewDesign': false,
        'Comfy.RightSidePanel.IsOpen': false
      }
    })

    test('restores the opaque Agent surface and graph gutter while the sidebar is open', async ({
      comfyPage,
      agentPanel
    }) => {
      const shell = comfyPage.page.getByTestId('docked-agent-panel-shell')
      const gutter = comfyPage.page.getByTestId('graph-canvas-gutter')

      await agentPanel.open()
      await expect(shell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(shell).toHaveCSS('border-left-width', '0px')
      await expect(gutter).toHaveCSS('margin-right', '0px')

      await comfyPage.menu.nodeLibraryTab.open()
      await expect(shell).toHaveCSS('background-color', 'rgb(23, 23, 24)')
      await expect(shell).toHaveCSS('border-left-width', '1px')
      await expect(gutter).toHaveCSS('margin-right', '8px')

      await comfyPage.menu.nodeLibraryTab.close()
      await expect(shell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(shell).toHaveCSS('border-left-width', '0px')
      await expect(gutter).toHaveCSS('margin-right', '0px')
    })
  })
})
