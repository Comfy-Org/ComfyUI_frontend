import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { AGENT_COMPOSER_PLACEHOLDER_TEXT } from '@e2e/fixtures/utils/agentComposerLabel'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

// PM-1233: the composer placeholder used to carry the primary instruction and
// every secondary affordance on one line ("Describe ideas, / use skills, @ add
// references, drag in assets"). The placeholder now states the primary action
// only, and the secondary affordances are controls in the toolbar: the add
// menu, and a persistent `@` Reference button that opens the node/workflow
// reference picker. These are the user-visible halves of that split, so a
// future copy edit that puts the instructions back on the prose line, or drops
// the Reference control, fails here rather than silently shipping.
test.describe('Agent composer primary placeholder (PM-1233)', () => {
  test('states one primary action and offers references as a control', async ({
    agentPanel
  }) => {
    await agentPanel.open()
    await agentPanel.selectWorkflow()
    const panel = agentPanel.root

    await expect(panel.getByText(AGENT_COMPOSER_PLACEHOLDER_TEXT)).toBeVisible()
    await expect(agentPanel.composer).toHaveText('')

    // The placeholder is the primary instruction and nothing else. Asserting
    // the absence of the secondary fragments is what makes this a regression
    // guard: an exact-copy assertion alone would also pass if a later edit
    // re-crammed the line, because it would simply be updated to match.
    const placeholderCopy = enMessages.agent.placeholder
    expect(placeholderCopy).not.toMatch(/use skills/i)
    expect(placeholderCopy).not.toMatch(/add references/i)
    expect(placeholderCopy).not.toMatch(/drag in/i)

    const reference = panel.getByRole('button', {
      name: enMessages.agent.reference,
      exact: true
    })
    await expect(reference).toBeVisible()

    await reference.click()
    await expect(
      panel.getByRole('menuitem', { name: enMessages.agent.nodes })
    ).toBeVisible()
    await expect(
      panel.getByRole('menuitem', { name: enMessages.agent.workflows })
    ).toBeVisible()
  })
})
