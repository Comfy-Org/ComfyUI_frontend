import { expect, mergeTests } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Tooltip } from '@e2e/fixtures/components/Tooltip'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'
import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import type { WorkspaceStore } from '@e2e/types/globals'

const test = mergeTests(agentTest, workflowSelectionTest)

const BACKGROUND_TAB = 'Unsaved Workflow'
const BACKGROUND_TAB_PATH = `workflows/${BACKGROUND_TAB}.json`
const FOREGROUND_TAB = 'Unsaved Workflow (2)'

function isBackgroundTabLoaded(page: Page): Promise<boolean | undefined> {
  return page.evaluate(
    (path) =>
      (
        window.app!.extensionManager as WorkspaceStore
      ).workflow.getWorkflowByPath(path)?.isLoaded,
    BACKGROUND_TAB_PATH
  )
}

/**
 * Leaves `Unsaved Workflow` holding a Note node open in the background, never
 * loaded in this page session: a reload restores a tab it left unopened. This is
 * the state a person reaches by working in one workflow, opening another, and
 * coming back to the first later.
 */
async function openWorkflowInBackground(page: Page): Promise<void> {
  const tabs = page.getByTestId('workflow-tab')
  // The agent fixture answers the API without a socket, so no client id is
  // issued and the per-browser-tab pointer that carries open tabs across a
  // reload is never written. Seed the id the server would have given us.
  await page.evaluate(() => sessionStorage.setItem('clientId', 'e2e-client'))
  await page.reload()
  await waitForCloudApp(page)
  await expect(tabs).toHaveCount(1)
  await expect(new Topbar(page).getActiveTab()).toHaveText(BACKGROUND_TAB)
  await page.evaluate(() => {
    const workflow = (window.app!.extensionManager as WorkspaceStore).workflow
      .activeWorkflow!
    window.app!.graph.add(window.LiteGraph!.createNode('Note'))
    workflow.changeTracker.checkState()
  })
  await page
    .getByRole('button', {
      name: enMessages.sideToolbar.newBlankWorkflow,
      exact: true
    })
    .click()
  await expect(tabs).toHaveCount(2)
  for (const [store, prefix] of [
    ['local', 'Comfy.Workflow.DraftIndex.v2:'],
    ['session', 'Comfy.Workflow.OpenPaths:']
  ] as const)
    await expect
      .poll(() =>
        page.evaluate(
          ([which, keyPrefix, path]) => {
            const storage = which === 'local' ? localStorage : sessionStorage
            return Object.keys(storage).some(
              (key) =>
                key.startsWith(keyPrefix) &&
                storage.getItem(key)!.includes(`"${path}"`)
            )
          },
          [store, prefix, BACKGROUND_TAB_PATH]
        )
      )
      .toBe(true)

  await page.reload()
  await waitForCloudApp(page)
  await expect(tabs).toHaveCount(2)
  await expect(new Topbar(page).getActiveTab()).toHaveText(FOREGROUND_TAB)
  await expect.poll(() => isBackgroundTabLoaded(page)).toBe(false)
}

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

/**
 * These start from an unsaved first tab, so they cannot share the save in the
 * suite above: the pick under test only saves a tab that has no workflow id yet.
 */
test.describe(
  'A workflow opened in the background',
  { tag: ['@cloud', '@ui'] },
  () => {
    test('reaches the agent once its tab is activated', async ({
      page,
      toast,
      workflowSelection
    }) => {
      expect(workflowSelection.savedPaths).toHaveLength(0)
      await openWorkflowInBackground(page)
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      const topbar = new Topbar(page)

      await topbar.getWorkflowTab(BACKGROUND_TAB).click()
      await expect(topbar.getActiveTab()).toHaveText(BACKGROUND_TAB)

      await agentPanel.composer.fill('@')
      await agentPanel.root
        .getByRole('menuitem', { name: enMessages.agent.nodes, exact: true })
        .click()
      await expect(
        agentPanel.root.getByRole('menuitem', { name: 'Note', exact: true })
      ).toBeVisible()

      await expect(
        toast.withText(enMessages.agent.targetNavigationUnavailable)
      ).toHaveCount(0)
      await expect(
        toast.withText(enMessages.shareWorkflow.saveFailedTitle)
      ).toHaveCount(0)
      await expect(
        agentPanel.root.getByText(enMessages.agent.viewingDifferentWorkflow)
      ).toHaveCount(0)
    })

    test('can be referenced while a reload has left it unopened', async ({
      page,
      toast,
      workflowSelection
    }) => {
      await openWorkflowInBackground(page)
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()

      await agentPanel.composer.fill('@')
      await agentPanel.root
        .getByRole('menuitem', {
          name: enMessages.agent.workflows,
          exact: true
        })
        .click()
      expect(await isBackgroundTabLoaded(page)).toBe(false)
      await agentPanel.root
        .getByRole('menuitem', {
          name: `${BACKGROUND_TAB} ${enMessages.agent.unsavedWorkflow}`,
          exact: true
        })
        .click()
      await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
      workflowSelection.finishSave(true)

      await expect(
        agentPanel.root.getByTestId('workflow-reference-chip')
      ).toContainText(BACKGROUND_TAB)
      await expect(
        toast.withText(enMessages.shareWorkflow.saveFailedTitle)
      ).toHaveCount(0)
      await expect(new Topbar(page).getActiveTab()).toHaveText(FOREGROUND_TAB)

      const savedGraph = await page.evaluate(async (path) => {
        const response = await fetch(
          `/api/userdata/${encodeURIComponent(path)}`
        )
        return (await response.json()) as ComfyWorkflowJSON
      }, workflowSelection.savedPaths[0])
      expect(savedGraph.nodes.map(({ type }) => type)).toContain('Note')
    })
  }
)
