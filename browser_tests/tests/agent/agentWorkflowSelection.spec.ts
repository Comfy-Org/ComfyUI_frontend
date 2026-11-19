import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Tooltip } from '@e2e/fixtures/components/Tooltip'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'

const test = mergeTests(agentTest, workflowSelectionTest)

test.describe('Agent workflow selection', { tag: ['@cloud', '@ui'] }, () => {
  test.beforeEach(async ({ page, workflowSelection }) => {
    await new AgentPanel(page).open()
    const topbar = new Topbar(page)
    const saving = topbar.saveWorkflowAs('Unsaved Workflow')
    await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
    workflowSelection.finishSave(true)
    await saving
  })

  test('retains a closed-workflow reference across panel reopen, navigation, and removal', async ({
    page,
    workflowSelection
  }, testInfo) => {
    const panel = page.locator('#agent-panel-root')
    const topbar = new Topbar(page)

    await page
      .getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })
      .click()
    const tabs = page.getByTestId('workflow-tab')
    await tabs.first().hover()
    await tabs.first().getByRole('button', { name: enMessages.g.close }).click()
    await expect(tabs).toHaveCount(1)

    const composer = panel.getByRole('textbox', { includeHidden: true })
    await composer.fill('Start in this workflow')
    await composer.press('Enter')
    await expect.poll(() => workflowSelection.postedMessages.length).toBe(1)
    await expect(composer).toHaveText('')
    await expect(panel.getByTestId('user-message-bubble')).toBeVisible()
    await expect(panel.getByTestId('user-message-bubble')).toHaveText([
      'Start in this workflow'
    ])
    await expect(panel.getByTestId('pending-send-error')).toBeVisible()
    await expect(panel.getByTestId('pending-send-error')).toContainText(
      enMessages.agent.sendFailed
    )
    await composer.fill('@')
    await panel
      .getByRole('menuitem', {
        name: enMessages.agent.workflows,
        exact: true
      })
      .click()
    await panel
      .getByRole('menuitem', { name: 'Unsaved Workflow', exact: true })
      .click()
    await composer.pressSequentially('Use this workflow as inspiration')
    await expect(tabs).toHaveCount(1)
    await panel.getByRole('button', { name: enMessages.g.close }).click()
    await expect(panel).toHaveCount(0)
    await page
      .getByRole('button', {
        name: enMessages.agent.entryButton,
        exact: true
      })
      .click()
    await expect(composer).toHaveText(
      'Unsaved Workflow Use this workflow as inspiration'
    )
    const chip = panel.getByTestId('workflow-reference-chip')
    const open = chip.getByRole('button', {
      name: 'Open Unsaved Workflow',
      exact: true
    })
    const remove = chip.getByRole('button', {
      name: 'Remove Unsaved Workflow reference'
    })
    await expect(remove).toHaveCSS('opacity', '0')
    await open.hover()
    await expect(remove).toHaveCSS('opacity', '1')
    const chipBox = await open.boundingBox()
    const removeBox = await remove.boundingBox()
    expect(chipBox).not.toBeNull()
    expect(removeBox).not.toBeNull()
    expect(removeBox!.y).toBeLessThan(chipBox!.y)
    expect(removeBox!.x + removeBox!.width).toBeGreaterThan(
      chipBox!.x + chipBox!.width
    )
    await testInfo.attach('workflow-chip-hover', {
      body: await panel.screenshot({
        path: testInfo.outputPath('workflow-chip-hover.png')
      }),
      contentType: 'image/png'
    })
    await open.click()
    await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow')
    await expect(panel.getByRole('note')).toContainText(
      enMessages.agent.viewingDifferentWorkflow
    )
    await expect(composer).toHaveText(
      'Unsaved Workflow Use this workflow as inspiration'
    )
    await expect(chip).toBeVisible()
    expect(workflowSelection.postedMessages).toHaveLength(1)

    await open.focus()
    await open.press('Tab')
    await expect(remove).toBeFocused()
    await expect(remove).toHaveCSS('opacity', '1')
    await remove.press('Enter')
    await expect(chip).toHaveCount(0)
    await expect(composer).toHaveText('Use this workflow as inspiration')
    await expect(panel.getByRole('note')).toContainText(
      enMessages.agent.viewingDifferentWorkflow
    )
    await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow')
    expect(workflowSelection.postedMessages).toHaveLength(1)
  })

  test('explains disabled node references while viewing another workflow', async ({
    page,
    workflowSelection
  }, testInfo) => {
    const panel = page.locator('#agent-panel-root')
    const topbar = new Topbar(page)

    await page
      .getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })
      .click()
    await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow (2)')

    const composer = panel.getByRole('textbox', { includeHidden: true })
    await composer.fill('Start in this workflow')
    await composer.press('Enter')
    await expect.poll(() => workflowSelection.postedMessages.length).toBe(1)
    await expect(panel.getByTestId('pending-send-error')).toContainText(
      enMessages.agent.sendFailed
    )
    await composer.fill('@')
    await panel
      .getByRole('menuitem', {
        name: enMessages.agent.workflows,
        exact: true
      })
      .click()
    await panel
      .getByRole('menuitem', { name: 'Unsaved Workflow', exact: true })
      .click()
    await panel
      .getByTestId('workflow-reference-chip')
      .getByRole('button', {
        name: 'Open Unsaved Workflow',
        exact: true
      })
      .click()
    await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow')

    const reason = enMessages.agent.switchWorkflowForNodes.replace(
      '{workflowName}',
      'Unsaved Workflow (2)'
    )
    const tooltip = new Tooltip(page).named(reason)
    const addToPrompt = panel.getByRole('button', {
      name: enMessages.agent.addToPrompt
    })
    await addToPrompt.click()
    const plusNodes = page.getByRole('menuitem', {
      name: enMessages.agent.nodes,
      exact: true
    })
    await expect(plusNodes).toHaveAttribute('aria-disabled', 'true')
    await expect(plusNodes).toHaveAccessibleDescription(reason)
    await plusNodes.hover()
    await expect(tooltip).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(tooltip).toBeHidden()
    await page.keyboard.press('Escape')
    await expect(plusNodes).toBeHidden()
    await expect(addToPrompt).toBeFocused()

    await composer.fill('@')
    const referenceMenu = panel.getByTestId('agent-reference-menu')
    await expect(referenceMenu).toBeVisible()
    const menuBox = await referenceMenu.boundingBox()
    const composerBox = await panel.getByTestId('agent-composer').boundingBox()
    expect(menuBox).not.toBeNull()
    expect(composerBox).not.toBeNull()
    expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(composerBox!.y)
    const nodes = panel.getByRole('menuitem', {
      name: enMessages.agent.nodes,
      exact: true
    })
    await expect(nodes).toHaveAttribute('aria-disabled', 'true')
    await nodes.hover()
    await expect(tooltip).toBeVisible()
    await testInfo.attach('disabled-node-references', {
      body: await panel.screenshot({
        path: testInfo.outputPath('disabled-node-references.png')
      }),
      contentType: 'image/png'
    })
    await composer.press('Enter')
    await expect(nodes).toBeVisible()
    await composer.press('Escape')
    await composer.press('ControlOrMeta+a')
    await composer.press('Backspace')
    await expect(addToPrompt).toBeVisible()
    expect(workflowSelection.postedMessages).toHaveLength(1)

    await page.getByTestId('workflow-tab').last().click()
    await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow (2)')
    await addToPrompt.click()
    await expect(plusNodes).not.toHaveAttribute('aria-disabled', 'true')
    await page.keyboard.press('Escape')
    await expect(plusNodes).toBeHidden()

    await page
      .getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })
      .click()
    await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow (3)')
    await addToPrompt.click()
    await expect(plusNodes).not.toHaveAttribute('aria-disabled', 'true')
  })
})
