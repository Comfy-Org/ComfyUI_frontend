import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'
const nodeDef = {
  title: 'TestNodeAdvancedDoc'
}

test.describe('Documentation Sidebar', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Floating')
    await comfyPage.loadWorkflow('default')
  })

  test.afterEach(async ({ comfyPage }) => {
    const currentThemeId = await comfyPage.menu.getThemeId()
    if (currentThemeId !== 'dark') {
      await comfyPage.menu.toggleTheme()
    }
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  test('Sidebar registered', async ({ comfyPage }) => {
    await expect(
      comfyPage.page.locator('.documentation-tab-button')
    ).toBeVisible()
  })
  test('Parses help for basic node', async ({ comfyPage }) => {
    await comfyPage.page.locator('.documentation-tab-button').click()
    const docPane = comfyPage.page.locator('.sidebar-content-container')
    //Check that each independently parsed element exists
    await expect(docPane).toContainText('Load Checkpoint')
    await expect(docPane).toContainText('Loads a diffusion model')
    await expect(docPane).toContainText('The name of the checkpoint')
    await expect(docPane).toContainText('The VAE model used')
  })
  test('Responds to hovering over node', async ({ comfyPage }) => {
    await comfyPage.page.locator('.documentation-tab-button').click()
    const docPane = comfyPage.page.locator('.sidebar-content-container')
    await comfyPage.page.mouse.move(321, 593)
    const tooltipTimeout = 500
    await comfyPage.page.waitForTimeout(tooltipTimeout + 16)
    await expect(comfyPage.page.locator('.node-tooltip')).not.toBeVisible()
    await expect(
      comfyPage.page.locator('.sidebar-content-container>div>div:nth-child(4)')
    ).toBeFocused()
  })
  test('Updates when a new node is selected', async ({ comfyPage }) => {
    await comfyPage.page.locator('.documentation-tab-button').click()
    const docPane = comfyPage.page.locator('.sidebar-content-container')
    await comfyPage.page.mouse.click(557, 440)
    await expect(docPane).not.toContainText('Load Checkpoint')
    await expect(docPane).toContainText('CLIP Text Encode (Prompt)')
    await expect(docPane).toContainText('The text to be encoded')
    await expect(docPane).toContainText(
      'A conditioning containing the embedded text'
    )
  })
  test('Responds to a change in theme', async ({ comfyPage }) => {
    await comfyPage.page.locator('.documentation-tab-button').click()
    const docPane = comfyPage.page.locator('.sidebar-content-container')
    await comfyPage.menu.toggleTheme()
    await expect(docPane).toHaveScreenshot(
      'documentation-sidebar-light-theme.png'
    )
  })
})
test.describe('Advanced Description tests', () => {
  test.beforeEach(async ({ comfyPage }) => {
    //register test node and add to graph
    await comfyPage.page.evaluate(async (node) => {
      const app = window['app']
      await app.registerNodeDef(node.name, node)
      app.addNodeOnGraph(node)
    }, advDocNode)
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Floating')
  })
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
  })
  test('Description displays as raw html', async ({ comfyPage }) => {
    await comfyPage.page.locator('.documentation-tab-button').click()
    const docPane = comfyPage.page.locator('.sidebar-content-container>div')
    await expect(docPane).toHaveJSProperty(
      'innerHTML',
      advDocNode.description[1]
    )
  })
  test('selected function', async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      const app = window['app']
      const desc =
        LiteGraph.registered_node_types['Test_AdvancedDescription'].nodeData
          .description
      desc[2].select = (element, name, value) => {
        element.children[0].innerText = name + ' ' + value
      }
    })
    await comfyPage.page.locator('.documentation-tab-button').click()
    const docPane = comfyPage.page.locator('.sidebar-content-container')
    await comfyPage.page.mouse.move(307, 80)
    const tooltipTimeout = 500
    await comfyPage.page.waitForTimeout(tooltipTimeout + 16)
    await expect(docPane).toContainText('int_input 0')
  })
})

const advDocNode = {
  display_name: 'Node With Advanced Description',
  name: 'Test_AdvancedDescription',
  input: {
    required: {
      int_input: [
        'INT',
        { tooltip: "an input tooltip that won't be displayed in sidebar" }
      ]
    }
  },
  output: ['INT'],
  output_name: ['int_output'],
  output_tooltips: ["An output tooltip that won't be displayed in the sidebar"],
  output_is_list: false,
  description: [
    'A node with description in the advanced format',
    `
A long form description that will be displayed in the sidebar.
<div doc_title="INT">Can include arbitrary html</div>
<div doc_title="int_input">or out of order widgets</div>
`,
    {}
  ]
}
