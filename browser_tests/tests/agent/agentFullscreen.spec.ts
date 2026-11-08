import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentFullscreenTest as test } from '@e2e/fixtures/agentFullscreenFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import {
  AGENT_RECENT_OUTPUTS,
  AGENT_SAVED_WORKFLOWS,
  AGENT_THREADS,
  FOX_CHAT,
  FOX_TRANSCRIPT,
  POSTER_CHAT,
  RECENT_OUTPUT_NAME,
  SAVED_APP_NAME,
  SAVED_WORKFLOW_NAME
} from '@e2e/fixtures/data/agent/agentFullscreen'

test.describe('Agent full screen', { tag: ['@cloud', '@agent'] }, () => {
  test('covers the window and returns to the dock on minimize', async ({
    agentFullscreen,
    page
  }) => {
    const viewport = page.viewportSize()

    await agentFullscreen.enter()

    await expect
      .poll(() => agentFullscreen.panel.dockedPanel.boundingBox())
      .toEqual({ x: 0, y: 0, ...viewport })
    await expect(agentFullscreen.workspace).toHaveJSProperty('inert', true)
    await expect(agentFullscreen.sidebar).toBeVisible()
    await expect
      .poll(async () => (await agentFullscreen.canvas.boundingBox())?.width)
      .toBeGreaterThan(0)

    await agentFullscreen.exit()

    await agentFullscreen.panel.expectPanelSize({
      x: (viewport?.width ?? 0) - 420,
      width: 420
    })
    await expect(agentFullscreen.workspace).toHaveJSProperty('inert', false)
    await expect(agentFullscreen.sidebar).toHaveCount(0)
  })

  test('keeps the draft when entering and leaving full screen', async ({
    agentFullscreen
  }) => {
    const draft = 'A lighthouse at dusk, long exposure'
    await agentFullscreen.panel.composer.fill(draft)

    await agentFullscreen.enter()
    await expect(agentFullscreen.panel.composer).toHaveText(draft)

    await agentFullscreen.exit()
    await expect(agentFullscreen.panel.composer).toHaveText(draft)
  })

  test('puts the workflow picker, outputs and run permissions under the input', async ({
    agentFullscreen
  }) => {
    await agentFullscreen.enter()

    await expect(agentFullscreen.metaRow).toBeVisible()
    await expect(
      agentFullscreen.metaRow.getByRole('button', {
        name: enMessages.agent.switchWorkflow
      })
    ).toBeVisible()
    await expect(agentFullscreen.outputsToggle).toBeVisible()
    await expect(agentFullscreen.starterPrompts).toBeVisible()
  })

  test('moves the brand into the sidebar and the chat title into the top bar', async ({
    agentFullscreen
  }) => {
    await expect(agentFullscreen.topBarBrand).toBeVisible()

    await agentFullscreen.enter()

    await expect(agentFullscreen.brand).toHaveCount(1)
    await expect(agentFullscreen.sidebarBrand).toBeVisible()
    await expect(agentFullscreen.topBarBrand).toHaveCount(0)
    await expect(
      agentFullscreen.topBar.getByRole('group', {
        name: enMessages.agent.chatOptions
      })
    ).toBeVisible()

    await agentFullscreen.closeSidebarButton.click()

    await expect(agentFullscreen.topBarBrand).toBeVisible()
    await expect(agentFullscreen.brand).toHaveCount(1)
  })

  test('shows the wordmark in the brand', async ({ agentFullscreen }) => {
    await expect(agentFullscreen.brandWordmark).toBeVisible()
    await expect
      .poll(() =>
        agentFullscreen.brandWordmark.evaluate(
          (img) => img instanceof HTMLImageElement && img.naturalWidth > 0
        )
      )
      .toBe(true)

    await agentFullscreen.enter()

    await expect(agentFullscreen.sidebarBrand).toBeVisible()
    await expect(agentFullscreen.brandWordmark).toBeVisible()
  })

  test('keeps the composer at the bottom while docked and centres it in full screen', async ({
    agentFullscreen
  }) => {
    await expect
      .poll(() => agentFullscreen.composerBottomGap())
      .toBeLessThan(40)
    await expect(agentFullscreen.starterPrompts).toBeVisible()

    await agentFullscreen.enter()

    await expect
      .poll(() => agentFullscreen.composerBottomGap())
      .toBeGreaterThan(200)

    await agentFullscreen.exit()

    await expect
      .poll(() => agentFullscreen.composerBottomGap())
      .toBeLessThan(40)
  })

  test('resizes the sidebar from its edge and remembers the width', async ({
    agentFullscreen
  }) => {
    await agentFullscreen.enter()
    await expect.poll(() => agentFullscreen.sidebarWidth()).toBe(260)

    await agentFullscreen.dragSidebarEdgeBy(100)
    await expect.poll(() => agentFullscreen.sidebarWidth()).toBe(360)

    await agentFullscreen.resizeHandle.focus()
    await agentFullscreen.resizeHandle.press('ArrowLeft')
    await expect.poll(() => agentFullscreen.sidebarWidth()).toBe(344)

    await agentFullscreen.reload()

    await expect.poll(() => agentFullscreen.sidebarWidth()).toBe(344)

    await agentFullscreen.resizeHandle.dblclick()
    await expect.poll(() => agentFullscreen.sidebarWidth()).toBe(260)
  })

  test('toggles full screen from its command', async ({ agentFullscreen }) => {
    await agentFullscreen.toggleByCommand()
    await agentFullscreen.expectPresentation('fullscreen')

    await agentFullscreen.toggleByCommand()
    await agentFullscreen.expectPresentation('docked')
  })

  test('comes back in full screen after a reload', async ({
    agentFullscreen
  }) => {
    await agentFullscreen.enter()

    await agentFullscreen.reload()

    await agentFullscreen.expectPresentation('fullscreen')
    await expect(agentFullscreen.sidebar).toBeVisible()
  })

  test('opens docked after it was closed from full screen', async ({
    agentFullscreen
  }) => {
    await agentFullscreen.enter()
    await agentFullscreen.panel.close()

    await agentFullscreen.reload()
    await agentFullscreen.panel.open()

    await agentFullscreen.expectPresentation('docked')
  })

  test('remembers a collapsed sidebar', async ({ agentFullscreen }) => {
    await agentFullscreen.enter()
    await expect(agentFullscreen.sidebar).toHaveAttribute(
      'data-mode',
      'expanded'
    )

    await agentFullscreen.closeSidebarButton.click()
    await expect(agentFullscreen.sidebar).toHaveAttribute('data-mode', 'rail')

    await agentFullscreen.reload()

    await expect(agentFullscreen.sidebar).toHaveAttribute('data-mode', 'rail')
    await expect(agentFullscreen.openSidebarButton).toBeVisible()
  })

  test('opens the account menu below its control at the top of the sidebar', async ({
    agentFullscreen
  }) => {
    await agentFullscreen.enter()
    const trigger = await agentFullscreen.accountMenuButton.boundingBox()
    const nav = await agentFullscreen.sectionNav.boundingBox()
    expect(trigger && nav && trigger.y + trigger.height <= nav.y).toBe(true)

    await agentFullscreen.accountMenuButton.click()

    const { accountMenu } = agentFullscreen
    await expect(accountMenu).toBeVisible()
    await expect(
      accountMenu.getByText(enMessages.agent.account.workspaces, {
        exact: true
      })
    ).toBeVisible()
    for (const name of [
      enMessages.agent.account.workspaceSettings,
      enMessages.agent.account.usage,
      enMessages.agent.account.settings,
      enMessages.agent.account.language,
      enMessages.agent.account.getHelp,
      enMessages.agent.account.getApiKey,
      enMessages.agent.account.logOut
    ])
      await expect(
        accountMenu.getByRole('menuitem', { name: new RegExp(`^${name}`) })
      ).toBeVisible()
    await expect
      .poll(async () => (await accountMenu.boundingBox())?.y ?? null)
      .toBeGreaterThanOrEqual((trigger?.y ?? 0) + (trigger?.height ?? 0))
  })
})

test.describe('Agent sidebar sections', { tag: ['@cloud', '@agent'] }, () => {
  test.use({ agentSavedWorkflows: AGENT_SAVED_WORKFLOWS })

  test('lists the saved workflows and opens one into the editor', async ({
    agentFullscreen,
    page
  }) => {
    await agentFullscreen.enter()

    await agentFullscreen.sectionButton(enMessages.agent.nav.workflows).click()

    await expect(agentFullscreen.chatList).toHaveCount(0)
    await expect(agentFullscreen.libraryRows).toHaveText([
      new RegExp(SAVED_APP_NAME),
      new RegExp(SAVED_WORKFLOW_NAME)
    ])

    await agentFullscreen.libraryRows
      .filter({ hasText: SAVED_WORKFLOW_NAME })
      .click()

    await agentFullscreen.expectPresentation('docked')
    await expect(
      new Topbar(page).getWorkflowTab(SAVED_WORKFLOW_NAME)
    ).toBeVisible()
  })

  test('lists only the apps under Apps and comes back to the chats', async ({
    agentFullscreen
  }) => {
    await agentFullscreen.enter()

    await agentFullscreen.sectionButton(enMessages.agent.nav.apps).click()

    await expect(agentFullscreen.libraryRows).toHaveText([
      new RegExp(SAVED_APP_NAME)
    ])
    await expect(
      agentFullscreen.sectionButton(enMessages.agent.nav.apps)
    ).toHaveAttribute('aria-current', 'page')

    await agentFullscreen.sectionButton(enMessages.agent.sidebar.chats).click()

    await expect(agentFullscreen.chatList).toBeVisible()
    await expect(agentFullscreen.libraryRows).toHaveCount(0)
  })

  test('opens the template browser over the chat', async ({
    agentFullscreen,
    page
  }) => {
    await agentFullscreen.enter()

    await agentFullscreen.sectionButton(enMessages.agent.nav.templates).click()

    await expect(agentFullscreen.templatesDialog).toBeVisible()
    await agentFullscreen.expectPresentation('fullscreen')

    await page.keyboard.press('Escape')

    await expect(agentFullscreen.templatesDialog).toHaveCount(0)
    await agentFullscreen.expectPresentation('fullscreen')
  })
})

test.describe(
  'Agent full screen chat list',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.use({
      agentThreads: AGENT_THREADS,
      agentTranscripts: { [FOX_CHAT.id]: FOX_TRANSCRIPT }
    })

    test('opens a chat from the sidebar', async ({ agentFullscreen }) => {
      await agentFullscreen.enter()
      await expect(agentFullscreen.chatRows).toHaveCount(2)

      await agentFullscreen
        .chatRow(FOX_CHAT.title)
        .getByRole('button', { name: FOX_CHAT.title })
        .click()

      await expect(
        agentFullscreen.panel.root.getByText(FOX_CHAT.reply)
      ).toBeVisible()
      await expect(agentFullscreen.chatRow(FOX_CHAT.title)).toHaveAttribute(
        'aria-current',
        'true'
      )
      await agentFullscreen.expectPresentation('fullscreen')
    })

    test('opens a chat from the workflow name under its title', async ({
      agentFullscreen
    }) => {
      await agentFullscreen.enter()

      await agentFullscreen
        .chatRow(FOX_CHAT.title)
        .getByTestId(TestIds.agent.chatWorkflowName)
        .click()

      await expect(
        agentFullscreen.panel.root.getByText(FOX_CHAT.reply)
      ).toBeVisible()
    })

    test('keeps a pinned chat under Pinned after a reload', async ({
      agentFullscreen
    }) => {
      await agentFullscreen.enter()
      await expect(agentFullscreen.pinnedHeading).toHaveCount(0)

      await agentFullscreen.chooseChatAction(
        POSTER_CHAT.title,
        enMessages.agent.sidebar.pin
      )
      await expect(agentFullscreen.pinnedHeading).toBeVisible()

      await agentFullscreen.reload()

      await expect(agentFullscreen.pinnedHeading).toBeVisible()
      await expect(agentFullscreen.chatRows.first()).toContainText(
        POSTER_CHAT.title
      )
    })

    test('asks before deleting a chat', async ({ agentFullscreen }) => {
      await agentFullscreen.enter()

      await agentFullscreen.chooseChatAction(
        POSTER_CHAT.title,
        enMessages.g.delete
      )
      await expect(agentFullscreen.chatRows).toHaveCount(2)

      await agentFullscreen.confirmDeleteButton.click()

      await expect(agentFullscreen.chatRows).toHaveCount(1)
      await expect(agentFullscreen.chatRow(POSTER_CHAT.title)).toHaveCount(0)
    })
  }
)

test.describe('Agent recent outputs', { tag: ['@cloud', '@agent'] }, () => {
  test.use({ agentOutputs: AGENT_RECENT_OUTPUTS })

  test('adds a ticked output to the message from full screen', async ({
    agentFullscreen
  }) => {
    await agentFullscreen.enter()

    await agentFullscreen.outputsToggle.click()
    await expect(agentFullscreen.outputsTray).toBeVisible()
    await expect(agentFullscreen.starterPrompts).toHaveCount(0)

    await agentFullscreen.outputTile(RECENT_OUTPUT_NAME).click()
    await agentFullscreen.outputsTray
      .getByRole('button', {
        name: enMessages.agent.outputs.addCount.split(' | ')[0]
      })
      .click()

    await expect(
      agentFullscreen.panel.attachmentChip(RECENT_OUTPUT_NAME)
    ).toBeVisible()
    await expect(agentFullscreen.outputsTray).toHaveCount(0)
    await expect(agentFullscreen.panel.composer).toBeFocused()
  })

  test('opens the outputs under the docked composer too', async ({
    agentFullscreen
  }) => {
    await agentFullscreen.outputsToggle.click()

    await expect(agentFullscreen.outputsTray).toBeVisible()
    await expect(agentFullscreen.outputTile(RECENT_OUTPUT_NAME)).toBeVisible()
  })
})

test.describe(
  'Agent maximize without the redesign',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.use({ chatRedesignEnabled: false })

    test('widens the dock and leaves the graph in use', async ({
      agentFullscreen
    }) => {
      await agentFullscreen.maximizeButton.click()

      await expect(agentFullscreen.minimizeButton).toBeVisible()
      await agentFullscreen.expectPresentation('docked')
      await expect(agentFullscreen.workspace).toHaveJSProperty('inert', false)
      await expect(agentFullscreen.sidebar).toHaveCount(0)
      await expect(agentFullscreen.metaRow).toHaveCount(0)
    })
  }
)
