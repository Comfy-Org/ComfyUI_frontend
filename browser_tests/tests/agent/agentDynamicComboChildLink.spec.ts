import { expect } from '@playwright/test'

import {
  CHILD,
  dynamicComboChildLinkTest as test
} from '@e2e/fixtures/agentDynamicComboChildLinkFixture'

test.describe(
  'A human link into a dynamic-combo child input the document lacks',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('reaches the document the agent reads, and so does its removal', async ({
      dynamicComboChildLink
    }) => {
      await test.step("the agent selects 'match size', growing the child on the canvas only", async () => {
        dynamicComboChildLink.selectMatchSize()
        await expect(dynamicComboChildLink.childLabel).toBeVisible()
        expect(dynamicComboChildLink.projectedChild()).toBeUndefined()
      })

      const childIndex = await dynamicComboChildLink.childIndex()
      expect(childIndex).toBeGreaterThanOrEqual(0)

      let linkId = 0

      await test.step('the user wires the source into the child', async () => {
        linkId = await dynamicComboChildLink.connectChild(childIndex)
      })

      await expect
        .poll(() => dynamicComboChildLink.projectedChild())
        .toEqual(expect.objectContaining({ name: CHILD, link: linkId }))
      expect(dynamicComboChildLink.projectedLinkIds()).toEqual([linkId])

      await test.step('the user deletes the link', async () => {
        await dynamicComboChildLink.removeLink(linkId)
      })

      await expect
        .poll(() => dynamicComboChildLink.projectedChild())
        .toEqual(expect.objectContaining({ name: CHILD, link: null }))
      expect(dynamicComboChildLink.projectedLinkIds()).toEqual([])
      expect(dynamicComboChildLink.humanOpFailures()).toEqual([])
    })
  }
)
