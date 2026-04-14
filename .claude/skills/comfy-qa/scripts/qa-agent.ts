#!/usr/bin/env tsx
/**
 * QA Research Phase — Claude writes & debugs E2E tests to reproduce bugs
 *
 * Instead of driving a browser interactively, Claude:
 * 1. Reads the issue + a11y snapshot of the UI
 * 2. Writes a Playwright E2E test (.spec.ts) that reproduces the bug
 * 3. Runs the test → reads errors → rewrites → repeats until it works
 * 4. Outputs the passing test + verdict
 *
 * Tools:
 *   - inspect(selector) — read a11y tree to understand UI state
 *   - writeTest(code) — write a Playwright test file
 *   - runTest() — execute the test and get results
 *   - done(verdict, summary, testCode) — finish with the working test
 */

import type { Page } from '@playwright/test'
/* eslint-disable import-x/no-unresolved */
// @ts-expect-error — claude-agent-sdk has no type declarations for vue-tsc
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
/* eslint-enable import-x/no-unresolved */
import { z } from 'zod'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

// ── Types ──

interface ResearchOptions {
  page: Page
  issueContext: string
  qaGuide: string
  outputDir: string
  serverUrl: string
  anthropicApiKey?: string
  maxTurns?: number
  timeBudgetMs?: number
}

export type ReproMethod = 'e2e_test' | 'video' | 'both' | 'none'

export interface ResearchResult {
  verdict: 'REPRODUCED' | 'NOT_REPRODUCIBLE' | 'INCONCLUSIVE'
  reproducedBy: ReproMethod
  summary: string
  evidence: string
  testCode: string
  videoScript?: string
  log: Array<{
    turn: number
    timestampMs: number
    toolName: string
    toolInput: unknown
    toolResult: string
  }>
}

// ── Main research function ──

export async function runResearchPhase(
  opts: ResearchOptions
): Promise<ResearchResult> {
  const { page, issueContext, qaGuide, outputDir, serverUrl, anthropicApiKey } =
    opts
  const maxTurns = opts.maxTurns ?? 50

  let agentDone = false
  let finalVerdict: ResearchResult['verdict'] = 'INCONCLUSIVE'
  let finalReproducedBy: ReproMethod = 'none'
  let finalSummary = 'Agent did not complete'
  let finalEvidence = ''
  let finalTestCode = ''
  let finalVideoScript = ''
  let turnCount = 0
  let lastPassedTurn = -1
  const startTime = Date.now()
  const researchLog: ResearchResult['log'] = []

  const testDir = `${outputDir}/research`
  mkdirSync(testDir, { recursive: true })
  const testPath = `${testDir}/reproduce.spec.ts`

  // Get initial a11y snapshot for context
  let initialA11y = ''
  try {
    initialA11y = await page.locator('body').ariaSnapshot({ timeout: 5000 })
    initialA11y = initialA11y.slice(0, 3000)
  } catch {
    initialA11y = '(could not capture initial a11y snapshot)'
  }

  // ── Tool: inspect ──
  const inspectTool = tool(
    'inspect',
    'Read the current accessibility tree to understand UI state. Use this to discover element names, roles, and selectors for your test.',
    {
      selector: z
        .string()
        .optional()
        .describe(
          'Optional filter — only show elements matching this name/role. Omit for full tree.'
        )
    },
    async (args: { selector?: string }) => {
      let resultText: string
      try {
        const ariaText = await page
          .locator('body')
          .ariaSnapshot({ timeout: 5000 })
        if (args.selector) {
          const lines = ariaText.split('\n')
          const matches = lines.filter((l: string) =>
            l.toLowerCase().includes(args.selector!.toLowerCase())
          )
          resultText =
            matches.length > 0
              ? `Found "${args.selector}":\n${matches.slice(0, 15).join('\n')}`
              : `"${args.selector}" not found. Full tree:\n${ariaText.slice(0, 2000)}`
        } else {
          resultText = ariaText.slice(0, 3000)
        }
      } catch (e) {
        resultText = `inspect failed: ${e instanceof Error ? e.message : e}`
      }

      researchLog.push({
        turn: turnCount,
        timestampMs: Date.now() - startTime,
        toolName: 'inspect',
        toolInput: args,
        toolResult: resultText.slice(0, 500)
      })

      return { content: [{ type: 'text' as const, text: resultText }] }
    }
  )

  // ── Tool: readFixture ──
  const readFixtureTool = tool(
    'readFixture',
    'Read a fixture or helper file from browser_tests/fixtures/ to understand the API. Use this to discover available methods on comfyPage helpers before writing your test.',
    {
      path: z
        .string()
        .describe(
          'Relative path within browser_tests/fixtures/, e.g. "helpers/CanvasHelper.ts" or "components/Topbar.ts" or "ComfyPage.ts"'
        )
    },
    async (args: { path: string }) => {
      let resultText: string
      try {
        const fullPath = `${projectRoot}/browser_tests/fixtures/${args.path}`
        const content = readFileSync(fullPath, 'utf-8')
        resultText = content.slice(0, 4000)
        if (content.length > 4000) {
          resultText += `\n\n... (truncated, ${content.length} total chars)`
        }
      } catch (e) {
        resultText = `Could not read fixture: ${e instanceof Error ? e.message : e}`
      }

      researchLog.push({
        turn: turnCount,
        timestampMs: Date.now() - startTime,
        toolName: 'readFixture',
        toolInput: args,
        toolResult: resultText.slice(0, 500)
      })

      return { content: [{ type: 'text' as const, text: resultText }] }
    }
  )

  // ── Tool: readTest ──
  const readTestTool = tool(
    'readTest',
    'Read an existing E2E test file from browser_tests/tests/ to learn patterns and conventions used in this project.',
    {
      path: z
        .string()
        .describe(
          'Relative path within browser_tests/tests/, e.g. "workflow.spec.ts" or "subgraph.spec.ts"'
        )
    },
    async (args: { path: string }) => {
      let resultText: string
      try {
        const fullPath = `${projectRoot}/browser_tests/tests/${args.path}`
        const content = readFileSync(fullPath, 'utf-8')
        resultText = content.slice(0, 4000)
        if (content.length > 4000) {
          resultText += `\n\n... (truncated, ${content.length} total chars)`
        }
      } catch (e) {
        // List available test files if the path doesn't exist
        try {
          const { readdirSync } = await import('fs')
          const files = readdirSync(`${projectRoot}/browser_tests/tests/`)
            .filter((f: string) => f.endsWith('.spec.ts'))
            .slice(0, 30)
          resultText = `File not found: ${args.path}\n\nAvailable test files:\n${files.join('\n')}`
        } catch {
          resultText = `Could not read test: ${e instanceof Error ? e.message : e}`
        }
      }

      researchLog.push({
        turn: turnCount,
        timestampMs: Date.now() - startTime,
        toolName: 'readTest',
        toolInput: args,
        toolResult: resultText.slice(0, 500)
      })

      return { content: [{ type: 'text' as const, text: resultText }] }
    }
  )

  // ── Tool: writeTest ──
  const writeTestTool = tool(
    'writeTest',
    'Write a Playwright E2E test file that reproduces the bug. The test should assert the broken behavior exists.',
    {
      code: z
        .string()
        .describe('Complete Playwright test file content (.spec.ts)')
    },
    async (args: { code: string }) => {
      writeFileSync(testPath, args.code)

      researchLog.push({
        turn: turnCount,
        timestampMs: Date.now() - startTime,
        toolName: 'writeTest',
        toolInput: { path: testPath, codeLength: args.code.length },
        toolResult: `Test written to ${testPath} (${args.code.length} chars)`
      })

      return {
        content: [
          {
            type: 'text' as const,
            text: `Test written to ${testPath}. Use runTest() to execute it.`
          }
        ]
      }
    }
  )

  // ── Tool: runTest ──
  // Place test in browser_tests/ so Playwright config finds fixtures
  const projectRoot = process.cwd()
  const browserTestPath = `${projectRoot}/browser_tests/tests/qa-reproduce.spec.ts`

  const runTestTool = tool(
    'runTest',
    'Run the Playwright test and get results. Returns stdout/stderr including assertion errors.',
    {},
    async () => {
      turnCount++
      // Copy the test to browser_tests/tests/ where Playwright expects it
      const { copyFileSync } = await import('fs')
      try {
        copyFileSync(testPath, browserTestPath)
      } catch {
        // directory may not exist
        mkdirSync(`${projectRoot}/browser_tests/tests`, { recursive: true })
        copyFileSync(testPath, browserTestPath)
      }

      let resultText: string
      try {
        const output = execSync(
          `cd "${projectRoot}" && npx playwright test browser_tests/tests/qa-reproduce.spec.ts --reporter=list --timeout=30000 --retries=0 --workers=1 2>&1`,
          {
            timeout: 90000,
            encoding: 'utf-8',
            env: {
              ...process.env,
              COMFYUI_BASE_URL: serverUrl
            }
          }
        )
        resultText = `TEST PASSED:\n${output.slice(-1500)}`
      } catch (e) {
        const err = e as { stdout?: string; stderr?: string; message?: string }
        const output = (err.stdout || '') + '\n' + (err.stderr || '')
        resultText = `TEST FAILED:\n${output.slice(-2000)}`
      }

      researchLog.push({
        turn: turnCount,
        timestampMs: Date.now() - startTime,
        toolName: 'runTest',
        toolInput: { testPath },
        toolResult: resultText.slice(0, 1000)
      })

      // Auto-save passing test code for fallback completion — but only if
      // the test contains a bug-specific assertion (not just a discovery/debug test)
      if (resultText.startsWith('TEST PASSED')) {
        try {
          const code = readFileSync(browserTestPath, 'utf-8')
          const hasBugAssertion =
            /expect\s*\(/.test(code) &&
            !/^\s*expect\([^)]+\)\.toBeDefined\(\)/m.test(code) &&
            !/^\s*expect\([^)]+\)\.toBeGreaterThan\(0\)/m.test(code) &&
            !/Inspect|Find|Debug|discover/i.test(
              code.match(/test\(['"`]([^'"`]+)/)?.[1] ?? ''
            )
          if (hasBugAssertion) {
            finalTestCode = code
            lastPassedTurn = turnCount
          }
        } catch {
          // ignore
        }
        resultText +=
          '\n\n⚠️ Test PASSED — call done() now with verdict REPRODUCED and the test code. Do NOT write more tests.'
      }

      return { content: [{ type: 'text' as const, text: resultText }] }
    }
  )

  // ── Tool: done ──
  const doneTool = tool(
    'done',
    'Finish research with verdict and the final test code.',
    {
      verdict: z.enum(['REPRODUCED', 'NOT_REPRODUCIBLE', 'INCONCLUSIVE']),
      reproducedBy: z
        .enum(['e2e_test', 'video', 'both', 'none'])
        .describe(
          'How the bug was proven: e2e_test = Playwright assertion passed, video = visual evidence only, both = both methods, none = not reproduced'
        ),
      summary: z.string().describe('What you found and why'),
      evidence: z.string().describe('Test output that proves the verdict'),
      testCode: z
        .string()
        .describe(
          'Final Playwright test code. If REPRODUCED, this test asserts the bug exists and passes.'
        ),
      videoScript: z
        .string()
        .optional()
        .describe(
          'Demowright video script for Phase 2 demo recording. REQUIRED when verdict is REPRODUCED. A separate test file using createVideoScript with title, segments, and outro. Do NOT include demowright imports in testCode.'
        )
    },
    async (args: {
      verdict: ResearchResult['verdict']
      reproducedBy: ReproMethod
      summary: string
      evidence: string
      testCode: string
      videoScript?: string
    }) => {
      agentDone = true
      finalVerdict = args.verdict
      finalReproducedBy = args.reproducedBy
      finalSummary = args.summary
      finalEvidence = args.evidence
      finalTestCode = args.testCode
      finalVideoScript = args.videoScript ?? ''
      writeFileSync(testPath, args.testCode)
      if (args.videoScript) {
        writeFileSync(`${outputDir}/video-script.spec.ts`, args.videoScript)
      }
      return {
        content: [
          { type: 'text' as const, text: `Research complete: ${args.verdict}` }
        ]
      }
    }
  )

  // ── MCP Server ──
  const server = createSdkMcpServer({
    name: 'qa-research',
    version: '1.0.0',
    tools: [
      inspectTool,
      readFixtureTool,
      readTestTool,
      writeTestTool,
      runTestTool,
      doneTool
    ]
  })

  // ── System prompt ──
  const systemPrompt = `You are a senior QA engineer who writes Playwright E2E tests to reproduce reported bugs.

## Your tools
- inspect(selector?) — Read the accessibility tree to understand the current UI. Use to discover selectors, element names, and UI state.
- readFixture(path) — Read fixture source code from browser_tests/fixtures/. Use to discover available methods. E.g. "helpers/CanvasHelper.ts", "components/Topbar.ts", "ComfyPage.ts"
- readTest(path) — Read an existing test from browser_tests/tests/ to learn patterns. E.g. "workflow.spec.ts". Pass any name to list available files.
- writeTest(code) — Write a Playwright test file (.spec.ts)
- runTest() — Execute the test and get results (pass/fail + errors)
- done(verdict, summary, evidence, testCode) — Finish with the final test

## Workflow
1. Read the issue description carefully
2. FIRST: Use readTest() to read 1-2 existing tests similar to the bug you're reproducing:
   - For menu/workflow bugs: readTest("workflow.spec.ts") or readTest("topbarMenu.spec.ts")
   - For node/canvas bugs: readTest("nodeInteraction.spec.ts") or readTest("copyPaste.spec.ts")
   - For settings bugs: readTest("settingDialogSearch.spec.ts")
   - For subgraph bugs: readTest("subgraph.spec.ts")
3. Use inspect() to understand the current UI state and discover element selectors
4. If unsure about the fixture API, use readFixture("ComfyPage.ts") or relevant helper
5. Write a Playwright test that:
   - Performs the exact reproduction steps from the issue
   - Asserts the BROKEN behavior (the bug) — so the test PASSES when the bug exists
6. Run the test with runTest()
7. If it fails: read the error, fix the test, run again (max 5 attempts)
8. Call done() with the final verdict and test code

## Test writing guidelines
- Import the project fixture: \`import { comfyPageFixture as test } from '../fixtures/ComfyPage'\`
- Import expect: \`import { expect } from '@playwright/test'\`
- The fixture provides \`comfyPage\` which has all the helpers listed below
- If the bug IS present, the test should PASS. If the bug is fixed, the test would FAIL.
- Keep tests focused and minimal — test ONLY the reported bug
- Write ONE test, not multiple. Focus on the single clearest reproduction.
- The test file will be placed in browser_tests/tests/qa-reproduce.spec.ts
- Use \`comfyPage.nextFrame()\` after interactions that trigger UI updates
- NEVER use \`page.waitForTimeout()\` — use Locator actions and retrying assertions instead
- ALWAYS call done() when finished, even if the test passed — do not keep iterating after a passing test
- CRITICAL: If your test FAILS 3 times in a row with the same or similar error, call done(NOT_REPRODUCIBLE) immediately. Do NOT keep retrying the same approach — try a completely different strategy or give up. Spending 20+ tool calls on failing tests is wasteful.
- Budget your turns: spend at most 3 turns on inspect/readFixture, 2 turns writing the first test, then max 3 fix attempts. If still failing after ~10 tool calls, call done().
- Use \`expect.poll()\` for async assertions: \`await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(8)\`
- CRITICAL: Your assertions must be SPECIFIC TO THE BUG. A test that asserts \`expect(count).toBeGreaterThan(0)\` proves nothing — it would pass even without the bug. Instead assert the exact broken state, e.g. \`expect(clonedWidgets).toHaveLength(0)\` (missing widgets) or \`expect(zIndex).toBeLessThan(parentZIndex)\` (wrong z-order). If a test passes trivially, it's a false positive.
- NEVER write "debug", "discovery", or "inspect node types" tests. These waste turns and produce false REPRODUCED verdicts. If you need to discover node type names, use inspect() or readFixture() — not a passing test.
- If you cannot write a bug-specific assertion, call done() with verdict NOT_REPRODUCIBLE and explain why.

## ComfyPage Fixture API Reference

### Core properties
- \`comfyPage.page\` — raw Playwright Page
- \`comfyPage.canvas\` — Locator for #graph-canvas
- \`comfyPage.queueButton\` — "Queue Prompt" button
- \`comfyPage.runButton\` — "Run" button (new UI)
- \`comfyPage.confirmDialog\` — ConfirmDialog (has .confirm, .delete, .overwrite, .reject locators + .click(name) method)
- \`comfyPage.nextFrame()\` — wait for next requestAnimationFrame
- \`comfyPage.setup()\` — navigate + wait for app ready (called automatically by fixture)

### Menu (comfyPage.menu)
- \`comfyPage.menu.topbar\` — Topbar helper:
  - \`.triggerTopbarCommand(['File', 'Save As'])\` — navigate menu hierarchy
  - \`.openTopbarMenu()\` / \`.closeTopbarMenu()\` — open/close hamburger
  - \`.openSubmenu('File')\` — hover to open submenu, returns submenu Locator
  - \`.getTabNames()\` — get all open workflow tab names
  - \`.getActiveTabName()\` — get active tab name
  - \`.getWorkflowTab(name)\` — get tab Locator
  - \`.closeWorkflowTab(name)\` — close a tab
  - \`.saveWorkflow(name)\` / \`.saveWorkflowAs(name)\` / \`.exportWorkflow(name)\`
  - \`.switchTheme('dark' | 'light')\`
- \`comfyPage.menu.workflowsTab\` — WorkflowsSidebarTab:
  - \`.open()\` / \`.close()\` — toggle workflows sidebar
  - \`.getTopLevelSavedWorkflowNames()\` — list saved workflow names
- \`comfyPage.menu.nodeLibraryTab\` — NodeLibrarySidebarTab
- \`comfyPage.menu.assetsTab\` — AssetsSidebarTab

### Canvas (comfyPage.canvasOps)
- \`.click({x, y})\` — click at position on canvas
- \`.rightClick(x, y)\` — right-click (opens context menu)
- \`.doubleClick()\` — double-click canvas (opens node search)
- \`.clickEmptySpace()\` — click known empty area
- \`.dragAndDrop(source, target)\` — drag from source to target position
- \`.pan(offset, safeSpot?)\` — pan canvas by offset
- \`.zoom(deltaY, steps?)\` — zoom via scroll wheel
- \`.resetView()\` — reset zoom/pan to default
- \`.getScale()\` / \`.setScale(n)\` — get/set canvas zoom
- \`.getNodeCenterByTitle(title)\` — get screen coords of node center
- \`.disconnectEdge()\` / \`.connectEdge()\` — default graph edge operations

### Node Operations (comfyPage.nodeOps)
- \`.getGraphNodesCount()\` — count all nodes
- \`.getSelectedGraphNodesCount()\` — count selected nodes
- \`.getNodes()\` — get all nodes
- \`.getFirstNodeRef()\` — get NodeReference for first node
- \`.getNodeRefById(id)\` — get NodeReference by ID
- \`.getNodeRefsByType(type)\` — get all nodes of a type
- \`.waitForGraphNodes(count)\` — wait until node count matches

### Settings (comfyPage.settings)
- \`.setSetting(id, value)\` — change a ComfyUI setting
- \`.getSetting(id)\` — read current setting value

### Keyboard (comfyPage.keyboard)
- \`.undo()\` / \`.redo()\` — Ctrl+Z / Ctrl+Y
- \`.bypass()\` — Ctrl+B
- \`.selectAll()\` — Ctrl+A
- \`.ctrlSend(key)\` — send Ctrl+key

### Workflow (comfyPage.workflow)
- \`.loadWorkflow(name)\` — load from browser_tests/assets/{name}.json
- \`.setupWorkflowsDirectory(structure)\` — setup test directory
- \`.deleteWorkflow(name)\`
- \`.isCurrentWorkflowModified()\` — check dirty state

### Context Menu (comfyPage.contextMenu)
- \`.openFor(locator)\` — right-click locator and wait for menu
- \`.clickMenuItem(name)\` — click a menu item by name
- \`.isVisible()\` — check if context menu is showing
- \`.assertHasItems(items)\` — assert menu contains items

### Other helpers
- \`comfyPage.settingDialog\` — SettingDialog component
- \`comfyPage.searchBox\` / \`comfyPage.searchBoxV2\` — node search
- \`comfyPage.toast\` — ToastHelper (\`.visibleToasts\`)
- \`comfyPage.subgraph\` — SubgraphHelper
- \`comfyPage.vueNodes\` — VueNodeHelpers
- \`comfyPage.bottomPanel\` — BottomPanel
- \`comfyPage.clipboard\` — ClipboardHelper
- \`comfyPage.dragDrop\` — DragDropHelper

### Available fixture files (use readFixture to explore)
- ComfyPage.ts — main fixture with all helpers
- helpers/CanvasHelper.ts, NodeOperationsHelper.ts, WorkflowHelper.ts
- helpers/KeyboardHelper.ts, SettingsHelper.ts, SubgraphHelper.ts
- components/Topbar.ts, ContextMenu.ts, SettingDialog.ts, SidebarTab.ts

## Video Script (IMPORTANT — provide via done() tool)

When calling done(), provide a \`videoScript\` parameter with a SEPARATE test file that uses demowright's createVideoScript.
Do NOT put demowright imports in testCode — they won't resolve in Phase 1.

The videoScript is a complete, standalone Playwright test file for Phase 2 demo recording:

\`\`\`typescript
import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { createVideoScript, showTitleCard, hideTitleCard } from 'demowright/video-script'

test('Demo: Bug Title', async ({ comfyPage }) => {
  // Show title card IMMEDIATELY — covers the screen while setup runs behind it
  await showTitleCard(comfyPage.page, 'Bug Title Here', { subtitle: 'Issue #NNNN' })

  // Setup runs while title card is visible
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
  await comfyPage.workflow.setupWorkflowsDirectory({})

  // Remove early title card before script starts (script will show its own)
  await hideTitleCard(comfyPage.page)

  const script = createVideoScript()
    .title('Bug Title Here', { subtitle: 'Issue #NNNN', durationMs: 4000 })
    .segment('Step 1: description of what we do', async (pace) => {
      await pace()  // narration finishes FIRST
      await comfyPage.menu.topbar.saveWorkflow('name')  // THEN action
      await comfyPage.page.waitForTimeout(2000)  // pause for viewer
    })
    .segment('Bug evidence: what we see proves the bug', async (pace) => {
      await pace()
      await comfyPage.page.waitForTimeout(5000)  // hold on evidence
    })
    .outro({ text: 'Bug Reproduced', subtitle: 'Summary' })

  await script.render(comfyPage.page)
})
\`\`\`

Key API:
- \`.title(text, {subtitle?, durationMs?})\` — title card (4s default)
- \`.segment(narrationText, async (pace) => { await pace(); ...actions... })\` — TTS narrated step
- \`.outro({text?, subtitle?, durationMs?})\` — ending card
- \`pace()\` — wait for narration audio to finish

CRITICAL TIMING: Call \`await pace()\` FIRST in each segment, BEFORE the Playwright actions.
This makes the narration play and finish, THEN the actions execute — so viewers hear what's about
to happen before it happens. Pattern:

\`\`\`typescript
.segment('Now we save the workflow as a new name', async (pace) => {
  await pace()  // narration finishes first
  await comfyPage.menu.topbar.saveWorkflowAs('new-name')  // then action happens
  await comfyPage.page.waitForTimeout(2000)  // pause so viewer sees the result
})
\`\`\`

IMPORTANT RULES for videoScript:
1. You MUST provide videoScript when verdict is REPRODUCED — every reproduced bug needs a narrated demo
2. Call showTitleCard() BEFORE setup, run setup behind it, call hideTitleCard() before createVideoScript() — see example
3. Call \`await pace()\` FIRST in each segment callback, BEFORE actions
4. Add \`waitForTimeout(2000)\` after each action so viewers can see the result
5. Final evidence segment: hold for 5+ seconds
6. Reproduce the same steps as testCode but slower with clear narration

## Current UI state (accessibility tree)
${initialA11y}

${qaGuide ? `## QA Analysis Guide\n${qaGuide}\n` : ''}
## Issue to Reproduce
${issueContext}`

  // ── Run the agent ──
  console.warn('Starting research phase (Claude writes E2E tests)...')

  try {
    for await (const message of query({
      prompt:
        'Write a Playwright E2E test that reproduces the reported bug. Use inspect() to discover selectors, readFixture() or readTest() if you need to understand the fixture API or see existing test patterns, writeTest() to write the test, runTest() to execute it. Iterate until it works or you determine the bug cannot be reproduced.',
      options: {
        model: 'claude-sonnet-4-6',
        systemPrompt,
        ...(anthropicApiKey ? { apiKey: anthropicApiKey } : {}),
        maxTurns,
        mcpServers: { 'qa-research': server },
        allowedTools: [
          'mcp__qa-research__inspect',
          'mcp__qa-research__readFixture',
          'mcp__qa-research__readTest',
          'mcp__qa-research__writeTest',
          'mcp__qa-research__runTest',
          'mcp__qa-research__done'
        ]
      }
    })) {
      if (message.type === 'assistant' && message.message?.content) {
        for (const block of message.message.content) {
          if ('text' in block && block.text) {
            console.warn(`  Claude: ${block.text.slice(0, 200)}`)
          }
          if ('name' in block) {
            console.warn(
              `  Tool: ${block.name}(${JSON.stringify(block.input).slice(0, 100)})`
            )
          }
        }
      }
      if (agentDone) break
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.warn(`Research error: ${errMsg}`)

    // Detect billing/auth errors and surface them clearly
    if (
      errMsg.includes('Credit balance is too low') ||
      errMsg.includes('insufficient_quota') ||
      errMsg.includes('rate_limit')
    ) {
      finalSummary = `API error: ${errMsg.slice(0, 200)}`
      finalEvidence = 'Agent could not start due to API billing/auth issue'
      console.warn(
        '::error::Anthropic API credits exhausted — cannot run research phase'
      )
    }
  }

  // Auto-complete: if a test passed but done() was never called, use the passing test
  if (!agentDone && lastPassedTurn >= 0 && finalTestCode) {
    console.warn(
      `Auto-completing: test passed at turn ${lastPassedTurn} but done() was not called`
    )
    finalVerdict = 'REPRODUCED'
    finalReproducedBy = 'e2e_test'
    finalSummary = `Test passed at turn ${lastPassedTurn} (auto-completed — agent did not call done())`
    finalEvidence = `Test passed with exit code 0`
  }

  const result: ResearchResult = {
    verdict: finalVerdict,
    reproducedBy: finalReproducedBy,
    summary: finalSummary,
    evidence: finalEvidence,
    testCode: finalTestCode,
    videoScript: finalVideoScript || undefined,
    log: researchLog
  }

  writeFileSync(`${testDir}/research-log.json`, JSON.stringify(result, null, 2))
  console.warn(
    `Research complete: ${finalVerdict} (${researchLog.length} tool calls)`
  )

  return result
}
