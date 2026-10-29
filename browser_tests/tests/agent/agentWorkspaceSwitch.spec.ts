import { expect } from '@playwright/test'
import {
  PERSONAL_WORKSPACE_NAME,
  TEAM_WORKSPACE_NAME
} from '@e2e/fixtures/data/workspaceSwitcher'
import { agentWorkspaceSwitcherTest as test } from '@e2e/tests/agent/agentWorkspaceSwitchFixture'

test.describe('Agent workspace switching', { tag: '@ui' }, () => {
  test('retires the old socket and recovers the panel under the new workspace identity', async ({
    agentIdentityReads,
    agentPanel,
    getAgentSocket,
    nextAgentSocket,
    page
  }) => {
    await agentPanel.open()
    await expect(agentPanel.composer).toBeVisible()
    const originalSocket = await getAgentSocket()
    expect(new URL(originalSocket.url()).searchParams.get('token')).toBe(
      'mock-workspace-token-ws-personal'
    )
    let originalSocketClosed = false
    originalSocket.onClose(() => {
      originalSocketClosed = true
    })
    const replacementSocketOpened = nextAgentSocket()

    await page.getByRole('button', { name: 'Current user' }).click()
    await expect(page.getByTestId('workspace-switcher-trigger')).toContainText(
      PERSONAL_WORKSPACE_NAME
    )
    await page.getByTestId('workspace-switcher-trigger').click()
    await page
      .getByTestId('workspace-switcher-panel')
      .getByText(TEAM_WORKSPACE_NAME, { exact: true })
      .click()

    const replacementSocket = await replacementSocketOpened
    await expect.poll(() => originalSocketClosed).toBe(true)
    expect(new URL(replacementSocket.url()).searchParams.get('token')).toBe(
      'mock-workspace-token-ws-team'
    )
    await expect
      .poll(() => agentIdentityReads)
      .toContainEqual({
        workspaceId: 'ws-team'
      })
    await expect(agentPanel.composer).toBeVisible()
  })
})
