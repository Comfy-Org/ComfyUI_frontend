import type { AgentSkillListResponse } from '@comfyorg/ingest-types'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

export const SKILL_NAME = 'retry-recovered-skill'
const SKILLS: AgentSkillListResponse = {
  skills: [
    {
      id: 'retry-recovered-skill-id',
      name: SKILL_NAME,
      description: 'A skill returned after retrying a failed catalog request.',
      body: 'Reply briefly; do not run workflows.',
      body_hash: 'c'.repeat(64),
      created_at: '2026-11-22T00:00:00Z',
      updated_at: '2026-11-22T00:00:00Z'
    }
  ]
}

type SkillRetryFixtures = {
  skillRequests: string[]
}

export const agentSkillMenuRetryTest = agentTest.extend<SkillRetryFixtures>({
  skillRequests: async ({ browserName: _browserName }, use) => {
    await use([])
  },
  page: async ({ page, skillRequests }, use) => {
    await page.route('**/api/agent/skills', (route) => {
      skillRequests.push(route.request().url())
      return skillRequests.length === 1
        ? route.fulfill({ status: 404, json: { error: 'Not found' } })
        : route.fulfill(jsonRoute(SKILLS))
    })
    await use(page)
  }
})
