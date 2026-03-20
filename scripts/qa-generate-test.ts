#!/usr/bin/env tsx
/**
 * Generates a Playwright regression test (.spec.ts) from a QA report + PR diff.
 * Uses Gemini to produce a test that asserts UIUX behavior verified during QA.
 *
 * Usage:
 *   pnpm exec tsx scripts/qa-generate-test.ts \
 *     --qa-report <path>       QA video review report (markdown)
 *     --pr-diff <path>         PR diff file
 *     --output <path>          Output .spec.ts file path
 *     --model <name>           Gemini model (default: gemini-2.5-flash)
 */
import { readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

import { GoogleGenerativeAI } from '@google/generative-ai'

interface CliOptions {
  qaReport: string
  prDiff: string
  output: string
  model: string
}

const DEFAULTS: CliOptions = {
  qaReport: '',
  prDiff: '',
  output: '',
  model: 'gemini-2.5-flash'
}

// ── Fixture API reference for the prompt ────────────────────────────
const FIXTURE_API = `
## ComfyUI Playwright Test Fixture API

Import pattern:
\`\`\`typescript
import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'
\`\`\`

### Available helpers on \`comfyPage\`:
- \`comfyPage.page\` — raw Playwright Page
- \`comfyPage.menu.topbar\` — Topbar helper:
  - \`.getTabNames(): Promise<string[]>\` — get all open tab names
  - \`.getActiveTabName(): Promise<string>\` — get active tab name
  - \`.saveWorkflow(name)\` — Save via File > Save dialog
  - \`.saveWorkflowAs(name)\` — Save via File > Save As dialog
  - \`.exportWorkflow(name)\` — Export via File > Export dialog
  - \`.triggerTopbarCommand(path: string[])\` — e.g. ['File', 'Save As']
  - \`.getWorkflowTab(name)\` — get a tab locator by name
  - \`.closeWorkflowTab(name)\` — close a tab
  - \`.openTopbarMenu()\` — open the hamburger menu
  - \`.openSubmenu(label)\` — hover to open a submenu
- \`comfyPage.menu.workflowsTab\` — Workflows sidebar:
  - \`.open()\` / \`.close()\` — toggle sidebar
  - \`.getTopLevelSavedWorkflowNames()\` — list saved workflows
  - \`.getPersistedItem(name)\` — get a workflow item locator
- \`comfyPage.workflow\` — WorkflowHelper:
  - \`.loadWorkflow(name)\` — load from browser_tests/assets/{name}.json
  - \`.setupWorkflowsDirectory(structure)\` — setup test directory
  - \`.deleteWorkflow(name)\` — delete a workflow
  - \`.isCurrentWorkflowModified(): Promise<boolean>\` — check dirty state
  - \`.getUndoQueueSize()\` / \`.getRedoQueueSize()\`
- \`comfyPage.settings.setSetting(key, value)\` — change settings
- \`comfyPage.keyboard\` — KeyboardHelper:
  - \`.undo()\` / \`.redo()\` / \`.bypass()\`
- \`comfyPage.nodeOps\` — NodeOperationsHelper
- \`comfyPage.canvas\` — CanvasHelper
- \`comfyPage.contextMenu\` — ContextMenu
- \`comfyPage.toast\` — ToastHelper
- \`comfyPage.confirmDialog\` — confirmation dialog
- \`comfyPage.nextFrame()\` — wait for Vue re-render

### Test patterns:
- Use \`test.describe('Name', { tag: '@ui' }, () => { ... })\` for UI tests
- Use \`test.beforeEach\` to set up common state (settings, workflow dir)
- Use \`expect(locator).toHaveScreenshot('name.png')\` for visual assertions
- Use \`expect(locator).toBeVisible()\` / \`.toHaveText()\` for behavioral assertions
- Use \`comfyPage.workflow.setupWorkflowsDirectory({})\` to ensure clean state
`

// ── Prompt builder ──────────────────────────────────────────────────
function buildPrompt(qaReport: string, prDiff: string): string {
  return `You are a Playwright test generator for the ComfyUI frontend.

Your task: Generate a single .spec.ts regression test file that asserts the UIUX behavior
described in the QA report below. The test must:

1. Use the ComfyUI Playwright fixture API (documented below)
2. Test UIUX behavior ONLY — element visibility, tab names, dialog states, workflow states
3. NOT test code implementation details
4. Be concise — only test the behavior that the PR changed
5. Follow existing test conventions (see API reference)

${FIXTURE_API}

## QA Video Review Report
${qaReport}

## PR Diff (for context on what changed)
${prDiff.slice(0, 8000)}

## Output Requirements
- Output ONLY the .spec.ts file content — no markdown fences, no explanations
- Start with imports, end with closing brace
- Use descriptive test names that explain the expected behavior
- Add screenshot assertions where visual verification matters
- Keep it focused: 2-5 test cases covering the core behavioral change
- Use \`test.beforeEach\` for common setup (settings, workflow directory)
- Tag the describe block with \`{ tag: '@ui' }\` or \`{ tag: '@workflow' }\` as appropriate
`
}

// ── Gemini call ─────────────────────────────────────────────────────
async function generateTest(
  qaReport: string,
  prDiff: string,
  model: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY env var required')

  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({ model })

  const prompt = buildPrompt(qaReport, prDiff)
  console.warn(`Sending prompt to ${model} (${prompt.length} chars)...`)

  const result = await genModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192
    }
  })

  const text = result.response.text()

  // Strip markdown fences if model wraps output
  return text
    .replace(/^```(?:typescript|ts)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim()
}

// ── CLI ─────────────────────────────────────────────────────────────
function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  const opts = { ...DEFAULTS }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--qa-report':
        opts.qaReport = args[++i]
        break
      case '--pr-diff':
        opts.prDiff = args[++i]
        break
      case '--output':
        opts.output = args[++i]
        break
      case '--model':
        opts.model = args[++i]
        break
      case '--help':
        console.warn(`Usage:
  pnpm exec tsx scripts/qa-generate-test.ts [options]

Options:
  --qa-report <path>   QA video review report (markdown) [required]
  --pr-diff <path>     PR diff file [required]
  --output <path>      Output .spec.ts path [required]
  --model <name>       Gemini model (default: gemini-2.5-flash)`)
        process.exit(0)
    }
  }

  if (!opts.qaReport || !opts.prDiff || !opts.output) {
    console.error('Missing required args. Run with --help for usage.')
    process.exit(1)
  }

  return opts
}

async function main() {
  const opts = parseArgs()

  const qaReport = await readFile(resolve(opts.qaReport), 'utf-8')
  const prDiff = await readFile(resolve(opts.prDiff), 'utf-8')

  console.warn(
    `QA report: ${basename(opts.qaReport)} (${qaReport.length} chars)`
  )
  console.warn(`PR diff: ${basename(opts.prDiff)} (${prDiff.length} chars)`)

  const testCode = await generateTest(qaReport, prDiff, opts.model)

  const outputPath = resolve(opts.output)
  await writeFile(outputPath, testCode + '\n')
  console.warn(`Generated test: ${outputPath} (${testCode.length} chars)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
