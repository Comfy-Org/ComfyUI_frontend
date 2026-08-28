import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import multiNodeFixture from '@e2e/fixtures/agent-responses/multi-node.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent

test.describe('Linear Agent UX scenarios', { tag: '@cloud' }, () => {
  // TODO(qa-ux-1 verify): replay fixtures/agent-responses/multi-node.json through
  // the browser mock once the V1 doc-update harness exposes deterministic geometry.
  test('T-04 / PM-660 / FE-1653 lays out generated nodes without overlap', async ({
    comfyPage
  }) => {
    test.fixme(true, 'Needs deterministic doc-update geometry replay')
    expect(multiNodeFixture.frames[0].data.content.nodes).toHaveLength(2)
    await expect(comfyPage.page.locator('canvas')).toBeVisible()
  })

  // TODO(qa-ux-1 verify): the media library drag source is not available in the
  // current cloud browser fixture; component coverage verifies its transfer data.
  test('T-08 / PM-646 / FE-1314 drags a media-tab asset into chat', async ({
    comfyPage
  }) => {
    test.fixme(true, 'Needs deterministic media-library seed')
    await expect(comfyPage.page.getByRole('textbox')).toBeVisible()
  })

  // TODO(qa-ux-1 verify): onboarding state is server-account scoped and the VM
  // fixture does not currently provide a deterministic fresh-account reset.
  test('T-25 / PM-666 / FE-1318 places the tour popover left of the sidebar', async ({
    comfyPage
  }) => {
    test.fixme(true, 'Needs deterministic fresh-account reset')
    await expect(comfyPage.page.getByRole('dialog')).toBeVisible()
  })

  test('T-29 / PM-650 / FE-1283 uses a megaphone for the Agent entry point', async ({
    comfyPage
  }) => {
    const button = comfyPage.page.getByRole('button', {
      name: OPEN_AGENT_LABEL
    })

    await expect(button).toBeVisible()
    await expect(button.locator('span')).toHaveClass(/lucide--megaphone/)
  })

  for (const width of [320, 640]) {
    test(`X-01 / PM-672 keeps controls usable at ${width}px panel width`, async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
      const panel = page.locator('#agent-panel-root')

      await panel.evaluate((element, panelWidth) => {
        ;(element as HTMLElement).style.width = `${panelWidth}px`
      }, width)

      await expect(panel.getByRole('textbox')).toBeVisible()
      await expect(panel.getByRole('button', { name: 'Send' })).toBeVisible()
      await expect(panel).toHaveCSS('width', `${width}px`)
    })
  }

  // TODO(qa-ux-1 verify): full conversation restoration needs a deterministic
  // history endpoint fixture; historical tool calls are intentionally excluded.
  test('X-02 / PM-679 restores messages, assets, attachments, and workflow context after refresh', async ({
    comfyPage
  }) => {
    test.fixme(true, 'Needs deterministic conversation-history seed')
    await expect(comfyPage.page.locator('#agent-panel-root')).toBeVisible()
  })
})
