import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import {
  addNodeWithDisplayName,
  routeObjectInfoFromSetupApi
} from '@e2e/fixtures/utils/objectInfo'

const INJECTED_NODE_TYPE = 'HtmlEscapingProbeNode'
const SEARCH_TERM = 'HtmlEscapingProbe'
const XSS_FLAG = '__nodeSearchXss'
const HTML_PAYLOAD = `${SEARCH_TERM} <img src=x onerror="window.${XSS_FLAG} = true">`

test('Is not vulnerable to xss', async ({ comfyPage }) => {
  await test.step('in subgraph type', async () => {
    await comfyPage.workflow.loadWorkflow('xss/xss-e1-subgraph-type')
    const node = await comfyPage.nodeOps.getNodeRefById(10)
    await node.click('title', { button: 'right' })
    await comfyPage.contextMenu.clickLitegraphMenuItem('Properties Panel')
    await comfyPage.nextFrame()
    await expect(comfyPage.page.getByText('XSS E1')).toBeHidden()
  })

  await test.step('in property key', async () => {
    await comfyPage.workflow.loadWorkflow('xss/xss-e2-property-key')
    const node = await comfyPage.nodeOps.getNodeRefById(1)
    await node.click('title', { button: 'right' })
    await comfyPage.contextMenu.menuItems
      .getByText('Properties', { exact: true })
      .click()
    await comfyPage.contextMenu.clickLitegraphMenuItem('anything')
    await comfyPage.nextFrame()
    await expect(comfyPage.page.getByText('XSS E2')).toBeHidden()
  })
})

/**
 * QA test plan "cloud 1.50 → 1.51", Node Search Highlights (#14789): search
 * results must render HTML characters literally rather than as markup.
 *
 * The plan phrases this as "type a query containing HTML characters", but the
 * query never reaches the DOM — `highlightQuery()` only ever emits slices of
 * the node's display name, so the display name is the real injection point.
 *
 * `NodeSearchListItem.test.ts` already pins the escaping at the component
 * level with the same payload shape, so this does not add coverage of the
 * component itself. The slice it adds is narrow and specific: that nothing
 * between the `object_info` response and that component — node-def store,
 * search service, dialog — writes the display name as `innerHTML` on the way
 * through.
 */
test(
  'Does not render HTML in node search results',
  { tag: ['@node'] },
  async ({ comfyPage }) => {
    const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
      comfyPage.page,
      (objectInfo) =>
        addNodeWithDisplayName(objectInfo, INJECTED_NODE_TYPE, HTML_PAYLOAD)
    )

    try {
      await comfyPage.searchBoxV2.ensureV2Search()
      // Reload so the node definition store boots from the patched object_info.
      await comfyPage.workflow.reloadAndWaitForApp()

      await comfyPage.searchBoxV2.open()
      await comfyPage.searchBoxV2.input.fill(SEARCH_TERM)

      const result = comfyPage.searchBoxV2.results
        .filter({ hasText: SEARCH_TERM })
        .first()
      await expect(result).toBeVisible()

      // `toContainText` compares rendered text, so anything parsed as markup
      // would have been stripped out of it.
      await expect(result).toContainText(HTML_PAYLOAD)
      await expect(result.locator('img')).toHaveCount(0)

      // Catches the payload executing anywhere on the page, not just inside
      // the result row.
      expect(
        await comfyPage.page.evaluate((flag) => flag in window, XSS_FLAG)
      ).toBe(false)
    } finally {
      await unrouteObjectInfo()
    }
  }
)
