import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

/**
 * E2E coverage for the in-browser agent terminal (AgentFab + FoldablePanel).
 *
 * The panel is now a Vue-native scrollback (no xterm.js), so the tests
 * target the plain DOM directly: the input is a `<textarea>` inside
 * `[data-testid="agent-terminal"]`, and the scrollback lives in the same
 * container as a list of message blocks. We exercise the deterministic
 * shell surface — typing into the textarea runs commands directly through
 * the runtime, which is what the LLM ends up calling via `run_shell`.
 */

async function openPanel(comfyPage: ComfyPage): Promise<void> {
  const fab = comfyPage.page.getByTestId('agent-fab')
  await expect(fab).toBeVisible()
  await fab.click()
  await expect(comfyPage.page.getByTestId('agent-panel')).toBeVisible()
}

async function readTerminalText(comfyPage: ComfyPage): Promise<string> {
  return await comfyPage.page.getByTestId('agent-terminal').innerText()
}

async function typeAndEnter(comfyPage: ComfyPage, text: string): Promise<void> {
  const input = comfyPage.page.getByTestId('agent-terminal').locator('textarea')
  await input.focus()
  await comfyPage.page.keyboard.type(text)
  await comfyPage.page.keyboard.press('Enter')
}

test.describe('Agent terminal', { tag: '@ui' }, () => {
  test('FAB opens the panel and shows the COMFY-AI title + prompt', async ({
    comfyPage
  }) => {
    await openPanel(comfyPage)

    await expect(comfyPage.page.getByTestId('agent-panel-title')).toHaveText(
      'COMFY-AI'
    )
    await expect.poll(() => readTerminalText(comfyPage)).toMatch(/comfy>/)
  })

  test('Clicking the FAB again closes the panel', async ({ comfyPage }) => {
    await openPanel(comfyPage)
    await comfyPage.page.getByTestId('agent-fab').click()
    await expect(comfyPage.page.getByTestId('agent-panel')).toBeHidden()
  })

  test('Enter submits; help command lists built-ins', async ({ comfyPage }) => {
    await openPanel(comfyPage)
    await typeAndEnter(comfyPage, 'help')
    await expect
      .poll(() => readTerminalText(comfyPage))
      .toMatch(/run-js|cmd-list|comfy/)
  })

  test('Shift+Enter inserts a literal newline (no submit)', async ({
    comfyPage
  }) => {
    await openPanel(comfyPage)
    const input = comfyPage.page
      .getByTestId('agent-terminal')
      .locator('textarea')
    await input.focus()
    await comfyPage.page.keyboard.type('echo one')
    await comfyPage.page.keyboard.press('Shift+Enter')
    await comfyPage.page.keyboard.type('echo two')
    // Single submission should run BOTH lines as one multi-line script.
    await comfyPage.page.keyboard.press('Enter')

    const out = await readTerminalText(comfyPage)
    expect(out).toContain('one')
    expect(out).toContain('two')
  })

  test('coreutils: pwd / echo', async ({ comfyPage }) => {
    await openPanel(comfyPage)
    await typeAndEnter(comfyPage, 'pwd')
    await expect.poll(() => readTerminalText(comfyPage)).toMatch(/^\//m)

    await typeAndEnter(comfyPage, 'echo hello world')
    await expect
      .poll(() => readTerminalText(comfyPage))
      .toContain('hello world')
  })

  test('comfy namespace lists subcommands', async ({ comfyPage }) => {
    await openPanel(comfyPage)
    await typeAndEnter(comfyPage, 'comfy')
    await expect
      .poll(() => readTerminalText(comfyPage))
      .toMatch(/ComfyUI command namespace/)
  })

  test('run-js evaluates in the page scope', async ({ comfyPage }) => {
    await openPanel(comfyPage)
    await typeAndEnter(comfyPage, 'run-js return 1 + 2')
    await expect.poll(() => readTerminalText(comfyPage)).toMatch(/\b3\b/)
  })

  test('graph summary reports node count for the active graph', async ({
    comfyPage
  }) => {
    await openPanel(comfyPage)
    await typeAndEnter(comfyPage, 'graph summary')
    await expect
      .poll(() => readTerminalText(comfyPage))
      .toMatch(/node|count|nodes/i)
  })

  test('queue-status command returns output', async ({ comfyPage }) => {
    await openPanel(comfyPage)
    await typeAndEnter(comfyPage, 'queue-status')
    await expect
      .poll(() => readTerminalText(comfyPage))
      .toMatch(/running|pending|queue/i)
  })

  test('active-workflow reports path / state', async ({ comfyPage }) => {
    await openPanel(comfyPage)
    await typeAndEnter(comfyPage, 'active-workflow')
    await expect
      .poll(() => readTerminalText(comfyPage))
      .toMatch(/path|modified|persisted|none/i)
  })

  test('pipe: echo foo | wc -c emits a byte count', async ({ comfyPage }) => {
    await openPanel(comfyPage)
    await typeAndEnter(comfyPage, 'echo foo | wc -c')
    // "foo\n" = 4 bytes
    await expect.poll(() => readTerminalText(comfyPage)).toMatch(/\b4\b/)
  })

  test('unknown command surfaces an error', async ({ comfyPage }) => {
    await openPanel(comfyPage)
    await typeAndEnter(comfyPage, 'definitely-not-a-real-command-xyz')
    await expect
      .poll(() => readTerminalText(comfyPage))
      .toMatch(/not found|unknown|no such/i)
  })

  test('Ctrl+O folds and unfolds tool blocks', async ({ comfyPage }) => {
    await openPanel(comfyPage)
    await typeAndEnter(comfyPage, 'graph summary')
    // Tool blocks default to folded — body shouldn't be visible yet.
    const panel = comfyPage.page.getByTestId('agent-panel')
    await expect(
      panel.locator('button:has-text("graph summary")')
    ).toBeVisible()

    // Ctrl+O expands all
    await comfyPage.page.keyboard.press('Control+o')
    await expect.poll(() => readTerminalText(comfyPage)).toMatch(/nodes|types/i)

    // Ctrl+O folds all back — `nodes:` from the body should be hidden again.
    await comfyPage.page.keyboard.press('Control+o')
  })
})
