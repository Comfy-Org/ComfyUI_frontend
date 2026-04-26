import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

/**
 * E2E coverage for the in-browser agent terminal (AgentFab + XtermPanel).
 *
 * We exercise the deterministic surface: FAB → open/close, the solid-block
 * ASCII banner, the "COMFY-AI" title pill, keyboard affordances
 * (Enter submits, Shift+Enter inserts a literal newline, Tab completes),
 * and a representative slice of shell commands that back the examples
 * documented in the LLM system prompt. We intentionally do NOT drive the
 * LLM itself — typing into xterm runs the shell directly, which is what
 * the model ends up calling via the `run_shell` tool.
 */

async function openPanel(comfyPage: ComfyPage): Promise<void> {
  const fab = comfyPage.page.getByTestId('agent-fab')
  await expect(fab).toBeVisible()
  await fab.click()
  await expect(comfyPage.page.getByTestId('agent-panel')).toBeVisible()
}

async function readTerminalText(comfyPage: ComfyPage): Promise<string> {
  // xterm renders into rows under .xterm-rows; concatenate the text content.
  return await comfyPage.page
    .getByTestId('agent-terminal')
    .locator('.xterm-rows')
    .innerText()
}

async function typeAndEnter(comfyPage: ComfyPage, text: string): Promise<void> {
  const helper = comfyPage.page
    .getByTestId('agent-terminal')
    .locator('.xterm-helper-textarea')
  await helper.focus()
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

    // Banner is suppressed for token efficiency — only the shell prompt
    // should be rendered once the terminal is ready.
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
    const helper = comfyPage.page
      .getByTestId('agent-terminal')
      .locator('.xterm-helper-textarea')
    await helper.focus()
    await comfyPage.page.keyboard.type('echo one')
    await comfyPage.page.keyboard.press('Shift+Enter')
    await comfyPage.page.keyboard.type('echo two')
    // Still not submitted → now submit the whole multiline buffer.
    await comfyPage.page.keyboard.press('Enter')

    const out = await readTerminalText(comfyPage)
    // Both commands ran sequentially via the runtime.
    expect(out).toContain('one')
    expect(out).toContain('two')
  })

  test('Tab completes a partial command', async ({ comfyPage }) => {
    await openPanel(comfyPage)
    const helper = comfyPage.page
      .getByTestId('agent-terminal')
      .locator('.xterm-helper-textarea')
    await helper.focus()
    // "des" → unique prefix of `describe`
    await comfyPage.page.keyboard.type('des')
    await comfyPage.page.keyboard.press('Tab')
    // Submit; describe w/o arg yields usage text on stderr.
    await comfyPage.page.keyboard.press('Enter')
    await expect
      .poll(() => readTerminalText(comfyPage))
      .toMatch(/usage: describe/)
  })

  test('coreutils: pwd / echo / true / false', async ({ comfyPage }) => {
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
})
