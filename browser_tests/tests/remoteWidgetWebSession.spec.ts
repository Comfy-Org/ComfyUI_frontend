import { expect } from '@playwright/test'

import { webSessionTest } from '@e2e/fixtures/webSessionFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const TEAM_WORKSPACE_ID = 'ws-team'
const TEAM_OPTIONS = ['team-checkpoint.safetensors']
const PERSONAL_OPTIONS = ['personal-checkpoint.safetensors']

const test = webSessionTest.extend({
  page: async ({ page }, use) => {
    await page.route('**/api/settings', (route) => route.fulfill(jsonRoute({})))
    await page.route('**/api/userdata**', (route) =>
      route.fulfill(jsonRoute([]))
    )
    await use(page)
  }
})

test.describe(
  'Remote widget web-session routing',
  { tag: ['@cloud', '@widget'] },
  () => {
    test.describe.configure({ timeout: 120_000 })

    test.use({
      initialLocalStorage: {
        'Comfy.Workspace.LastWorkspaceId': TEAM_WORKSPACE_ID
      }
    })

    test('shows options from the selected team workspace', async ({
      comfyPage
    }) => {
      await comfyPage.page.route(
        '**/api/models/checkpoints**',
        async (route) => {
          const workspaceId = await route
            .request()
            .headerValue('x-comfy-workspace-id')
          await route.fulfill(
            jsonRoute(
              workspaceId === TEAM_WORKSPACE_ID
                ? TEAM_OPTIONS
                : PERSONAL_OPTIONS
            )
          )
        }
      )

      await comfyPage.workflow.loadWorkflow('inputs/remote_widget')

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              ({ title }) => title === 'Remote Widget Node'
            )
            return {
              options: node?.widgets?.[0].options.values,
              value: node?.widgets?.[0].value
            }
          })
        )
        .toEqual({ options: TEAM_OPTIONS, value: TEAM_OPTIONS[0] })
    })
  }
)
