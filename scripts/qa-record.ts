#!/usr/bin/env tsx
/**
 * QA Recording Script
 *
 * Records a ComfyUI frontend QA session using Playwright with video capture.
 * Uses Gemini to generate targeted test steps based on the PR diff.
 *
 * Usage:
 *   pnpm exec tsx scripts/qa-record.ts \
 *     --mode before|after \
 *     --diff <path-to-diff> \
 *     --output-dir <path> \
 *     [--url <server-url>] \
 *     [--model <gemini-model>]
 *
 * Env: GEMINI_API_KEY (required)
 */

import { chromium } from '@playwright/test'
import type { Page } from '@playwright/test'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { readFileSync, mkdirSync, readdirSync, renameSync, statSync } from 'fs'

// ── Types ──

type TestAction =
  | { action: 'openMenu' }
  | { action: 'hoverMenuItem'; label: string }
  | { action: 'clickMenuItem'; label: string }
  | { action: 'fillDialog'; text: string }
  | { action: 'pressKey'; key: string }
  | { action: 'click'; text: string }
  | { action: 'rightClick'; text: string }
  | { action: 'doubleClick'; text?: string; x?: number; y?: number }
  | { action: 'clickCanvas'; x: number; y: number }
  | { action: 'rightClickCanvas'; x: number; y: number }
  | {
      action: 'dragCanvas'
      fromX: number
      fromY: number
      toX: number
      toY: number
    }
  | { action: 'scrollCanvas'; x: number; y: number; deltaY: number }
  | { action: 'wait'; ms: number }
  | { action: 'screenshot'; name: string }
  | { action: 'loadWorkflow'; url: string }
  | { action: 'setSetting'; id: string; value: string | number | boolean }
  | { action: 'loadDefaultWorkflow' }
  | { action: 'openSettings' }
  | { action: 'reload' }
  | { action: 'done'; reason: string }

interface ActionResult {
  action: TestAction
  success: boolean
  error?: string
}

interface SubIssue {
  title: string
  focus: string
}

type RecordMode = 'before' | 'after' | 'reproduce'

interface Options {
  mode: RecordMode
  diffFile?: string
  outputDir: string
  serverUrl: string
  model: string
  apiKey: string
  testPlanFile?: string
  qaGuideFile?: string
}

// ── CLI parsing ──

function parseArgs(): Options {
  const args = process.argv.slice(2)
  const opts: Partial<Options> = {
    model: 'gemini-3.1-pro-preview',
    serverUrl: 'http://127.0.0.1:8188',
    apiKey: process.env.GEMINI_API_KEY || ''
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mode':
        opts.mode = args[++i] as RecordMode
        break
      case '--diff':
        opts.diffFile = args[++i]
        break
      case '--output-dir':
        opts.outputDir = args[++i]
        break
      case '--url':
        opts.serverUrl = args[++i]
        break
      case '--model':
        opts.model = args[++i]
        break
      case '--test-plan':
        opts.testPlanFile = args[++i]
        break
      case '--qa-guide':
        opts.qaGuideFile = args[++i]
        break
      case '--help':
        console.warn(
          'Usage: qa-record.ts --mode before|after|reproduce --output-dir <path> [--diff <path>] [--url <url>] [--model <model>] [--test-plan <path>] [--qa-guide <path>]'
        )
        process.exit(0)
    }
  }

  if (!opts.mode || !opts.outputDir) {
    console.error('Required: --mode before|after|reproduce --output-dir <path>')
    process.exit(1)
  }

  const validModes: RecordMode[] = ['before', 'after', 'reproduce']
  if (!validModes.includes(opts.mode)) {
    console.error(
      `Invalid --mode "${opts.mode}". Must be one of: ${validModes.join(', ')}`
    )
    process.exit(1)
  }

  if (!opts.diffFile && opts.mode !== 'reproduce') {
    console.error('--diff is required for before/after modes')
    process.exit(1)
  }

  if (!opts.apiKey) {
    console.error('GEMINI_API_KEY environment variable is required')
    process.exit(1)
  }

  return opts as Options
}

// ── Gemini test step generation ──

function buildPrompt(
  mode: string,
  diff: string,
  testPlan?: string,
  qaGuide?: string
): string {
  const modeDescriptions: Record<string, string> = {
    before:
      'BEFORE (main branch). Show the OLD state briefly — under 15 seconds. One quick demonstration of missing feature / old behavior.',
    after:
      'AFTER (PR branch). Prove the changes work — 3-6 targeted steps, under 30 seconds.',
    reproduce:
      'REPRODUCE a reported issue on main branch. Follow the reproduction steps PRECISELY to trigger and demonstrate the reported bug. Use 8-15 detailed steps, up to 60 seconds. You must actually perform the actions that trigger the bug — not just open a menu and take a screenshot.'
  }
  const modeDesc = modeDescriptions[mode] ?? modeDescriptions.before

  const qaGuideSection = qaGuide
    ? `
## QA Analysis Guide (follow closely)
A deep analysis of this PR has produced the following targeted test guide.
Follow these steps closely — they were generated from the full PR thread,
screenshots, and reviewer comments.

${qaGuide.slice(0, 6000)}
`
    : ''

  const testPlanSection = testPlan
    ? `
## QA Test Plan Reference
Use this test plan to identify which test categories are relevant to the PR diff.
Pick test steps from the most relevant categories.

${testPlan.slice(0, 4000)}
`
    : ''

  return `You are generating test steps for a ComfyUI frontend QA recording.

ComfyUI is a node-based visual workflow editor for AI image generation. The UI has:
- A large **canvas** (1280x720 viewport) showing a node graph, centered roughly at (640, 400)
- Nodes are boxes with input/output slots that can be connected with wires
- A **hamburger menu** (top-left C logo) with File, Edit, Help submenus
- A **sidebar** on the left (Workflows, Node Library, Models)
- A **topbar** with workflow tabs and Queue button
- The **default workflow** loads with these nodes on canvas (approximate center coordinates):
  - Load Checkpoint (~150, 300)
  - CLIP Text Encode (positive prompt) (~450, 250)
  - CLIP Text Encode (negative prompt) (~450, 450)
  - Empty Latent Image (~450, 600)
  - KSampler (~750, 350)
  - VAE Decode (~1000, 350)
  - Save Image (~1200, 350)
- To interact with a specific node, use its coordinates (e.g., rightClickCanvas on KSampler at ~750, 350)
- Right-clicking ON a node shows node actions (Clone, Bypass, Convert, etc.)
- Right-clicking on EMPTY canvas shows Add Node menu — NOT the same as node context menu

MODE: ${modeDesc}

## Available actions (JSON array)
Each step is an object with an "action" field:

### Menu actions
- { "action": "openMenu" } — clicks the Comfy hamburger menu (top-left C logo)
- { "action": "hoverMenuItem", "label": "File" } — hovers a top-level menu item to open submenu
- { "action": "clickMenuItem", "label": "Save As" } — clicks an item in the visible submenu

### Element actions (by visible text)
- { "action": "click", "text": "Button Text" } — clicks an element by visible text
- { "action": "rightClick", "text": "NodeTitle" } — right-clicks an element (opens context menu)
- { "action": "doubleClick", "text": "NodeTitle" } — double-clicks an element
- { "action": "fillDialog", "text": "test-name" } — fills dialog input and presses Enter
- { "action": "pressKey", "key": "Escape" } — presses a keyboard key (Escape, Tab, Delete, Enter, etc.)

### Canvas actions (by coordinates — viewport is 1280x720)
- { "action": "clickCanvas", "x": 640, "y": 400 } — click at coordinates on canvas
- { "action": "rightClickCanvas", "x": 500, "y": 350 } — right-click on canvas (node/canvas context menu)
- { "action": "doubleClick", "x": 640, "y": 400 } — double-click on canvas (opens node search)
- { "action": "dragCanvas", "fromX": 400, "fromY": 300, "toX": 600, "toY": 300 } — drag (move nodes, pan canvas)
- { "action": "scrollCanvas", "x": 640, "y": 400, "deltaY": -300 } — scroll wheel (zoom in: negative, zoom out: positive)

### Setup actions (use to establish prerequisites)
- { "action": "loadWorkflow", "url": "https://..." } — loads a workflow JSON from a URL
- { "action": "setSetting", "id": "Comfy.Setting.Id", "value": true } — changes a ComfyUI setting

### Utility actions
- { "action": "wait", "ms": 1000 } — waits (use sparingly, max 3000ms)
- { "action": "screenshot", "name": "step-name" } — takes a screenshot
${qaGuideSection}${testPlanSection}
${diff ? `## PR Diff\n\`\`\`\n${diff.slice(0, 3000)}\n\`\`\`` : ''}

## Rules
- Output ONLY a valid JSON array of actions, no markdown fences or explanation
- ${mode === 'reproduce' ? 'You MUST follow the reproduction steps from the issue closely. Generate 8-15 steps that actually trigger the bug. Do NOT just open a menu and take a screenshot — perform the FULL reproduction sequence including node interactions, context menus, keyboard shortcuts, and canvas operations' : mode === 'before' ? 'Keep it minimal — just show the old/missing behavior' : 'Test the specific behavior that changed in the PR'}
- Always include at least one screenshot
- Do NOT include login steps (handled automatically)
- The default workflow is already loaded when your steps start
- Menu navigation pattern: openMenu → hoverMenuItem → clickMenuItem (or screenshot)
- For node interactions: right-click a node to get its context menu, double-click canvas to add nodes
- Take screenshots BEFORE and AFTER critical actions to capture the bug state
${qaGuide ? '- Follow the QA Analysis Guide steps closely — they are well-researched and specific' : diff ? '- Pick test steps from the QA test plan categories that are most relevant to the diff' : '- Pick test steps from the QA test plan categories most likely to reveal bugs'}
${
  mode === 'reproduce'
    ? `- Common ComfyUI actions: right-click node for context menu (Clone, Bypass, etc.), Ctrl+C/Ctrl+V to copy/paste, Delete key to remove, double-click canvas to add node via search, drag from output to input to connect
- CRITICAL: Establish all prerequisites BEFORE testing the bug. If the bug requires a saved workflow, SAVE it first. If it requires a dirty workflow, MODIFY it first. If it requires specific nodes, ADD them. If it requires a specific setting, use setSetting. Think step by step about what state the UI must be in to trigger the bug.
- Use loadWorkflow if the issue references a specific workflow JSON URL
- Use setSetting to configure any non-default settings needed to reproduce`
    : ''
}

## Example output
[
  {"action":"clickCanvas","x":450,"y":350},
  {"action":"screenshot","name":"node-selected"},
  {"action":"rightClickCanvas","x":450,"y":350},
  {"action":"wait","ms":500},
  {"action":"screenshot","name":"context-menu"},
  {"action":"clickMenuItem","label":"Clone"},
  {"action":"wait","ms":500},
  {"action":"screenshot","name":"after-clone"},
  {"action":"pressKey","key":"Delete"},
  {"action":"screenshot","name":"after-delete"}
]`
}

async function generateTestSteps(opts: Options): Promise<TestAction[]> {
  const diff = opts.diffFile ? readFileSync(opts.diffFile, 'utf-8') : ''
  const testPlan = opts.testPlanFile
    ? readFileSync(opts.testPlanFile, 'utf-8')
    : undefined
  let qaGuide: string | undefined
  if (opts.qaGuideFile) {
    try {
      qaGuide = readFileSync(opts.qaGuideFile, 'utf-8')
      console.warn(`Using QA guide: ${opts.qaGuideFile}`)
    } catch {
      console.warn(
        `QA guide not found: ${opts.qaGuideFile}, continuing without`
      )
    }
  }
  const prompt = buildPrompt(opts.mode, diff, testPlan, qaGuide)

  const genAI = new GoogleGenerativeAI(opts.apiKey)
  const model = genAI.getGenerativeModel({ model: opts.model })

  console.warn(`Generating ${opts.mode} test steps with ${opts.model}...`)

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
  })

  let text = result.response.text()
  // Strip markdown fences if present
  text = text
    .replace(/^```(?:json)?\n?/gm, '')
    .replace(/```$/gm, '')
    .trim()

  console.warn('Generated steps:', text)

  const steps: TestAction[] = JSON.parse(text)
  if (!Array.isArray(steps)) throw new Error('Expected JSON array')
  return steps
}

// ── Fallback steps ──

const FALLBACK_BEFORE: TestAction[] = [
  { action: 'openMenu' },
  { action: 'wait', ms: 300 },
  { action: 'hoverMenuItem', label: 'File' },
  { action: 'wait', ms: 500 },
  { action: 'screenshot', name: 'file-menu-before' },
  { action: 'pressKey', key: 'Escape' },
  { action: 'wait', ms: 500 },
  { action: 'screenshot', name: 'editor-before' }
]

const FALLBACK_AFTER: TestAction[] = [
  { action: 'openMenu' },
  { action: 'wait', ms: 300 },
  { action: 'hoverMenuItem', label: 'File' },
  { action: 'wait', ms: 500 },
  { action: 'screenshot', name: 'file-menu-after' },
  { action: 'pressKey', key: 'Escape' },
  { action: 'wait', ms: 500 },
  { action: 'screenshot', name: 'editor-after' }
]

const FALLBACK_REPRODUCE: TestAction[] = [
  { action: 'screenshot', name: 'initial-state' },
  { action: 'clickCanvas', x: 450, y: 350 },
  { action: 'wait', ms: 300 },
  { action: 'screenshot', name: 'node-selected' },
  { action: 'rightClickCanvas', x: 450, y: 350 },
  { action: 'wait', ms: 500 },
  { action: 'screenshot', name: 'context-menu' },
  { action: 'pressKey', key: 'Escape' },
  { action: 'openMenu' },
  { action: 'hoverMenuItem', label: 'File' },
  { action: 'screenshot', name: 'file-menu' },
  { action: 'pressKey', key: 'Escape' },
  { action: 'screenshot', name: 'final-state' }
]

const FALLBACK_STEPS: Record<RecordMode, TestAction[]> = {
  before: FALLBACK_BEFORE,
  after: FALLBACK_AFTER,
  reproduce: FALLBACK_REPRODUCE
}

// ── Playwright helpers ──

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function openComfyMenu(page: Page) {
  const menuTrigger = page.locator('.comfy-menu-button-wrapper')
  const menuPopup = page.locator('.comfy-command-menu')

  // Close if already open
  if (await menuPopup.isVisible().catch(() => false)) {
    await page.locator('body').click({ position: { x: 500, y: 300 } })
    await sleep(500)
  }

  if (await menuTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    await menuTrigger.click()
  } else {
    // Fallback: click where the C logo menu button typically is
    console.warn('Menu button not found by selector, using coordinate click')
    await page.mouse.click(46, 36)
    await sleep(300)
  }

  try {
    await menuPopup.waitFor({ state: 'visible', timeout: 3000 })
  } catch {
    console.warn('Menu popup did not appear')
  }
  await sleep(300)
}

async function hoverMenuItem(page: Page, label: string) {
  // Top-level items use .p-menubar-item-label in the comfy-command-menu
  const menuLabel = page.locator(`.p-menubar-item-label:text-is("${label}")`)
  if (await menuLabel.isVisible().catch(() => false)) {
    // Hover the parent .p-tieredmenu-item to trigger submenu
    const menuItem = page
      .locator('.comfy-command-menu .p-tieredmenu-item')
      .filter({ has: menuLabel })
    await menuItem.hover()
    // Wait for submenu to appear
    try {
      await page
        .locator('.p-tieredmenu-submenu:visible')
        .last()
        .waitFor({ state: 'visible', timeout: 2000 })
    } catch {
      console.warn(`Submenu for "${label}" did not appear`)
    }
    await sleep(300)
  } else {
    console.warn(`Menu item "${label}" not visible`)
  }
}

async function clickSubmenuItem(page: Page, label: string) {
  // Try PrimeVue tiered menu first (hamburger menu submenus)
  const submenu = page.locator('.p-tieredmenu-submenu:visible').last()
  const primeItem = submenu
    .locator('.p-tieredmenu-item')
    .filter({ hasText: label })
    .first()
  if (await primeItem.isVisible().catch(() => false)) {
    await primeItem.click({ timeout: 5000 }).catch(() => {
      console.warn(`Click on PrimeVue menu item "${label}" failed`)
    })
    await sleep(800)
    return
  }

  // Try litegraph context menu (right-click on nodes/canvas)
  const liteItem = page
    .locator('.litemenu-entry')
    .filter({ hasText: label })
    .first()
  if (await liteItem.isVisible().catch(() => false)) {
    await liteItem.click({ timeout: 5000 }).catch(() => {
      console.warn(`Click on litegraph menu item "${label}" failed`)
    })
    await sleep(800)
    return
  }

  // Try any visible menu/context menu item
  const anyItem = page.locator(`[role="menuitem"]:has-text("${label}")`).first()
  if (await anyItem.isVisible().catch(() => false)) {
    await anyItem.click({ timeout: 5000 }).catch(() => {
      console.warn(`Click on menu role item "${label}" failed`)
    })
    await sleep(800)
    return
  }

  console.warn(`Submenu item "${label}" not found in any menu type`)
}

async function fillDialogAndConfirm(page: Page, text: string) {
  // Try PrimeVue dialog input first
  const dialogInput = page.locator('.p-dialog-content input')
  if (await dialogInput.isVisible().catch(() => false)) {
    await dialogInput.fill(text)
    await sleep(300)
    await page.keyboard.press('Enter')
    await sleep(2000)
    return
  }

  // Try node search box input (opened by double-clicking canvas)
  const searchInput = page.locator(
    '[id^="comfy-vue-node-search-box-input"], [role="search"] input, .comfy-vue-node-search-container input, .p-autocomplete-input'
  )
  if (
    await searchInput
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await searchInput.first().fill(text)
    await sleep(500)
    // Select first result from dropdown
    const firstOption = page
      .locator('.p-autocomplete-item, .p-autocomplete-option, [role="option"]')
      .first()
    if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstOption.click({ timeout: 3000 }).catch(() => {
        console.warn('Could not click autocomplete option, pressing Enter')
      })
    } else {
      await page.keyboard.press('Enter')
    }
    await sleep(1000)
    return
  }

  // Fallback: type into whatever is focused
  const activeInput = page.locator('input:focus, textarea:focus')
  if (await activeInput.isVisible().catch(() => false)) {
    await activeInput.fill(text)
    await sleep(300)
    await page.keyboard.press('Enter')
    await sleep(1000)
    return
  }

  // Last resort: keyboard type
  console.warn('No input found, typing via keyboard')
  await page.keyboard.type(text, { delay: 50 })
  await sleep(300)
  await page.keyboard.press('Enter')
  await sleep(1000)
}

async function clickByText(page: Page, text: string) {
  const el = page.locator(`text=${text}`).first()
  if (await el.isVisible().catch(() => false)) {
    await el.click({ timeout: 5000 }).catch((e) => {
      console.warn(
        `Click on "${text}" failed: ${e instanceof Error ? e.message.split('\n')[0] : e}`
      )
    })
    await sleep(500)
  } else {
    console.warn(`Element with text "${text}" not found`)
  }
}

// ── Action executor ──

async function waitForEditorReady(page: Page) {
  try {
    await page
      .locator('.comfy-menu-button-wrapper')
      .waitFor({ state: 'visible', timeout: 15000 })
  } catch {
    console.warn('Editor not ready after reload (menu button not visible)')
  }
  await sleep(1000)
}

async function executeAction(
  page: Page,
  step: TestAction,
  outputDir: string
): Promise<ActionResult> {
  console.warn(
    `  → ${step.action}${('label' in step && `: ${step.label}`) || ('text' in step && `: ${step.text}`) || ('name' in step && `: ${step.name}`) || ('x' in step && `: (${step.x},${step.y})`) || ''}`
  )
  // Reject invalid click targets
  const INVALID_TARGETS = ['undefined', 'null', '[object Object]', '']
  if (
    'text' in step &&
    typeof step.text === 'string' &&
    INVALID_TARGETS.includes(step.text.trim())
  ) {
    const error = `Invalid click target: "${step.text}". Use a real UI label or coordinates instead.`
    console.warn(`  ${error}`)
    return { action: step, success: false, error }
  }

  try {
    switch (step.action) {
      case 'openMenu':
        await openComfyMenu(page)
        break
      case 'hoverMenuItem':
        await hoverMenuItem(page, step.label)
        break
      case 'clickMenuItem':
        await clickSubmenuItem(page, step.label)
        break
      case 'fillDialog':
        await fillDialogAndConfirm(page, step.text)
        break
      case 'pressKey':
        try {
          await page.keyboard.press(step.key)
          await sleep(300)
        } catch (e) {
          console.warn(
            `Skipping invalid key "${step.key}": ${e instanceof Error ? e.message : e}`
          )
        }
        break
      case 'click':
        await clickByText(page, step.text)
        break
      case 'rightClick': {
        const rcEl = page.locator(`text=${step.text}`).first()
        if (await rcEl.isVisible().catch(() => false)) {
          await rcEl.click({ button: 'right' })
          await sleep(500)
        } else {
          console.warn(
            `Element with text "${step.text}" not found for rightClick`
          )
        }
        break
      }
      case 'doubleClick': {
        if (step.x !== undefined && step.y !== undefined) {
          await page.mouse.dblclick(step.x, step.y)
        } else if (step.text) {
          const dcEl = page.locator(`text=${step.text}`).first()
          if (await dcEl.isVisible().catch(() => false)) {
            await dcEl.dblclick()
          } else {
            console.warn(
              `Element with text "${step.text}" not found for doubleClick`
            )
          }
        } else {
          await page.mouse.dblclick(640, 400)
        }
        await sleep(500)
        break
      }
      case 'clickCanvas':
        await page.mouse.click(step.x, step.y)
        await sleep(300)
        break
      case 'rightClickCanvas':
        await page.mouse.click(step.x, step.y, { button: 'right' })
        await sleep(500)
        break
      case 'dragCanvas': {
        await page.mouse.move(step.fromX, step.fromY)
        await page.mouse.down()
        await sleep(100)
        const dragSteps = 5
        for (let i = 1; i <= dragSteps; i++) {
          const x = step.fromX + ((step.toX - step.fromX) * i) / dragSteps
          const y = step.fromY + ((step.toY - step.fromY) * i) / dragSteps
          await page.mouse.move(x, y)
          await sleep(50)
        }
        await page.mouse.up()
        await sleep(300)
        break
      }
      case 'scrollCanvas':
        await page.mouse.move(step.x, step.y)
        await page.mouse.wheel(0, step.deltaY)
        await sleep(500)
        break
      case 'wait':
        await sleep(Math.min(step.ms, 5000))
        break
      case 'screenshot': {
        const safeName = step.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)
        await page.screenshot({
          path: `${outputDir}/${safeName}.png`
        })
        break
      }
      case 'loadWorkflow': {
        console.warn(`  Loading workflow from: ${step.url}`)
        await page.evaluate(async (workflowUrl) => {
          const resp = await fetch(workflowUrl)
          const workflow = await resp.json()
          const app = (window as unknown as Record<string, unknown>).app as {
            loadGraphData: (data: unknown) => Promise<void>
          }
          if (app?.loadGraphData) {
            await app.loadGraphData(workflow)
          }
        }, step.url)
        await sleep(2000)
        break
      }
      case 'setSetting': {
        console.warn(`  Setting ${step.id} = ${step.value}`)
        await page.evaluate(
          ({ id, value }) => {
            const app = (window as unknown as Record<string, unknown>).app as {
              ui: {
                settings: {
                  setSettingValue: (id: string, value: unknown) => void
                }
              }
            }
            app?.ui?.settings?.setSettingValue(id, value)
          },
          { id: step.id, value: step.value }
        )
        await sleep(500)
        break
      }
      case 'loadDefaultWorkflow':
        // Convenience: File → Load Default in one action
        await openComfyMenu(page)
        await hoverMenuItem(page, 'File')
        await clickSubmenuItem(page, 'Load Default')
        await sleep(1000)
        break
      case 'openSettings':
        // Convenience: open Settings dialog in one action
        await openComfyMenu(page)
        await clickSubmenuItem(page, 'Settings')
        await sleep(1000)
        break
      case 'reload':
        await page.reload({ waitUntil: 'domcontentloaded' })
        await waitForEditorReady(page)
        break
      case 'done':
        console.warn(`  Agent done: ${step.reason}`)
        break
      default:
        console.warn(`Unknown action: ${JSON.stringify(step)}`)
    }
    return { action: step, success: true }
  } catch (e) {
    const error = e instanceof Error ? e.message.split('\n')[0] : String(e)
    console.warn(`Step ${step.action} failed: ${error}`)
    return { action: step, success: false, error }
  }
}

// ── Step executor (batch mode for before/after) ──

async function executeSteps(
  page: Page,
  steps: TestAction[],
  outputDir: string
) {
  for (const step of steps) {
    await executeAction(page, step, outputDir)
  }
}

// ── Login flow ──

async function loginAsQaCi(page: Page, _serverUrl: string) {
  console.warn('Logging in as qa-ci...')

  // Detect login page by looking for the "New user" input
  const newUserInput = page.locator('input[placeholder*="username"]').first()
  const isLoginPage = await newUserInput
    .isVisible({ timeout: 5000 })
    .catch(() => false)

  if (isLoginPage) {
    console.warn('Login page detected, selecting existing user...')

    // Try selecting existing user from dropdown (created by Pre-seed step)
    const dropdown = page
      .locator('.p-select, .p-dropdown, [role="combobox"]')
      .first()
    let loginDone = false

    if (await dropdown.isVisible().catch(() => false)) {
      await dropdown.click()
      await sleep(500)

      // Look for qa-ci in the dropdown options
      const option = page.locator('text=qa-ci').first()
      if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
        await option.click()
        await sleep(300)
        console.warn('Selected qa-ci from dropdown')

        const nextBtn = page.getByRole('button', { name: 'Next' })
        if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click({ timeout: 5000 })
          console.warn('Clicked Next with existing user')
          loginDone = true
          await sleep(5000)
        }
      } else {
        // Close dropdown
        await page.keyboard.press('Escape')
        await sleep(300)
        console.warn('qa-ci not found in dropdown')
      }
    }

    // Fallback: create new user with unique name
    if (!loginDone) {
      const uniqueName = `qa-${Date.now()}`
      console.warn(`Creating new user: ${uniqueName}`)
      await newUserInput.fill(uniqueName)
      await sleep(500)
      const nextBtn = page.getByRole('button', { name: 'Next' })
      await nextBtn.click({ timeout: 5000 })
      console.warn('Clicked Next with new user')
      await sleep(5000)
    }
  } else {
    console.warn('No login page detected, continuing...')
  }

  // Skip tutorial/template gallery
  await page.evaluate(() => {
    localStorage.setItem('Comfy.TutorialCompleted', 'true')
  })

  // Close template gallery if it appeared
  await page.keyboard.press('Escape')
  await sleep(1000)

  // Dismiss error popup if present
  const dismissBtn = page.locator('text=Dismiss').first()
  if (await dismissBtn.isVisible().catch(() => false)) {
    await dismissBtn.click()
    await sleep(500)
  }

  // Wait for the editor UI to be fully loaded (menu button visible)
  try {
    await page
      .locator('.comfy-menu-button-wrapper')
      .waitFor({ state: 'visible', timeout: 15000 })
    console.warn('Editor UI loaded (menu button visible)')
  } catch {
    console.warn('Menu button not visible after 15s')
    console.warn(`Current URL: ${page.url()}`)
  }
  await sleep(1000)
}

// ── Agentic loop (reproduce mode) ──

async function captureScreenshotForGemini(page: Page): Promise<string> {
  const buffer = await page.screenshot({ type: 'jpeg', quality: 50 })
  return buffer.toString('base64')
}

function buildAgenticSystemPrompt(
  issueContext: string,
  subIssueFocus?: string,
  qaGuide?: string
): string {
  const focusSection = subIssueFocus
    ? `\n## Current Focus\nYou are reproducing this specific sub-issue: ${subIssueFocus}\nStay focused on this particular bug. When you have demonstrated it, return done.\n`
    : ''

  const qaSection = qaGuide
    ? `\n## QA Analysis\nA deep analysis of this issue produced the following guide. Follow it closely:\n${qaGuide}\n`
    : ''

  return `You are an AI QA agent controlling a ComfyUI browser session to reproduce reported bugs.
You see the ACTUAL screen after each action and decide what to do next.

## ComfyUI Layout (viewport 1280x720)
- A large canvas showing a node graph, centered roughly at (640, 400)
- Nodes are boxes with input/output slots connected by wires
- Hamburger menu (top-left C logo) with File, Edit, Help submenus
- Sidebar on the left (Workflows, Node Library, Models)
- Topbar with workflow tabs and Queue button
- Default workflow nodes (approximate center coordinates):
  - Load Checkpoint (~150, 300)
  - CLIP Text Encode (positive) (~450, 250)
  - CLIP Text Encode (negative) (~450, 450)
  - Empty Latent Image (~450, 600)
  - KSampler (~750, 350)
  - VAE Decode (~1000, 350)
  - Save Image (~1200, 350)

## Available Actions
Each action is a JSON object with an "action" field:
- { "action": "openMenu" } — clicks the hamburger menu
- { "action": "hoverMenuItem", "label": "File" } — hovers a top-level menu item
- { "action": "clickMenuItem", "label": "Save As" } — clicks submenu item
- { "action": "click", "text": "Button Text" } — clicks element by text
- { "action": "rightClick", "text": "NodeTitle" } — right-clicks element
- { "action": "doubleClick", "text": "NodeTitle" } — double-clicks element
- { "action": "doubleClick", "x": 640, "y": 400 } — double-click at coords (opens node search)
- { "action": "fillDialog", "text": "search-text" } — fills input and presses Enter
- { "action": "pressKey", "key": "Escape" } — presses a key
- { "action": "clickCanvas", "x": 640, "y": 400 } — click at coordinates
- { "action": "rightClickCanvas", "x": 500, "y": 350 } — right-click on canvas
- { "action": "dragCanvas", "fromX": 400, "fromY": 300, "toX": 600, "toY": 300 }
- { "action": "scrollCanvas", "x": 640, "y": 400, "deltaY": -300 } — scroll (negative=zoom in)
- { "action": "loadWorkflow", "url": "https://..." } — loads workflow JSON from URL
- { "action": "setSetting", "id": "Comfy.Setting.Id", "value": true } — changes a setting
- { "action": "loadDefaultWorkflow" } — loads the default workflow (File → Load Default)
- { "action": "openSettings" } — opens the Settings dialog
- { "action": "reload" } — reloads the page (for bugs that manifest on load)
- { "action": "wait", "ms": 1000 } — waits (max 3000ms)
- { "action": "screenshot", "name": "step-name" } — takes a named screenshot
- { "action": "done", "reason": "..." } — signals you are finished

## Response Format
Return JSON: { "reasoning": "brief explanation of what you see and plan to do", "action": { "action": "...", ...params } }
Return { "reasoning": "...", "action": { "action": "done", "reason": "..." } } when finished.

## Rules
- You see the ACTUAL screen state via the screenshot. Use it to decide your next action.
- If an action failed, try an alternative approach (different coordinates, different selector).
- Take screenshots before and after critical state changes to capture the bug.
- Never repeat the same failing action more than twice. Adapt your approach.
- Establish prerequisites first: if the bug requires a specific setting, use setSetting. If it needs a workflow, use loadWorkflow.
- Use reload for bugs that manifest on page load/startup.
- Common interactions: right-click node for context menu, Ctrl+C/V to copy/paste, Delete to remove, double-click canvas to add node via search.

## Strategy Hints
- For accessibility/UI bugs: use openSettings, setSetting to change themes or display options.
- For workflow bugs: use loadDefaultWorkflow first to ensure a clean starting state.
- Prefer convenience actions (loadDefaultWorkflow, openSettings) over manual menu navigation — they save turns and are more reliable.
- Do NOT waste turns on generic exploration. Focus on reproducing the specific bug.
${focusSection}${qaSection}
## Issue to Reproduce
${issueContext}`
}

interface AgenticTurnContent {
  role: 'user' | 'model'
  parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  >
}

async function runAgenticLoop(
  page: Page,
  opts: Options,
  outputDir: string,
  subIssue?: SubIssue
): Promise<void> {
  const MAX_TURNS = 30
  const TIME_BUDGET_MS = 120_000
  const SCREENSHOT_HISTORY_WINDOW = 3

  const issueContext = opts.diffFile
    ? readFileSync(opts.diffFile, 'utf-8').slice(0, 6000)
    : 'No issue context provided'

  // Read QA guide if available — contains structured analysis from analyze-pr
  let qaGuideSummary = ''
  if (opts.qaGuideFile) {
    try {
      const raw = readFileSync(opts.qaGuideFile, 'utf-8')
      const guide = JSON.parse(raw)
      const parts: string[] = []
      if (guide.summary) parts.push(`Summary: ${guide.summary}`)
      if (guide.test_focus) parts.push(`Test focus: ${guide.test_focus}`)
      if (guide.steps?.length) {
        parts.push(
          'Steps:\n' +
            guide.steps
              .map(
                (s: { description?: string }, i: number) =>
                  `${i + 1}. ${s.description || JSON.stringify(s)}`
              )
              .join('\n')
        )
      }
      if (guide.expected_result)
        parts.push(`Expected: ${guide.expected_result}`)
      qaGuideSummary = parts.join('\n')
      console.warn(`Loaded QA guide: ${qaGuideSummary.slice(0, 200)}...`)
    } catch {
      console.warn(`Could not load QA guide from ${opts.qaGuideFile}`)
    }
  }

  const systemInstruction = buildAgenticSystemPrompt(
    issueContext,
    subIssue?.focus,
    qaGuideSummary
  )

  const genAI = new GoogleGenerativeAI(opts.apiKey)
  // Use flash for agentic loop — rapid iteration matters more than reasoning
  const agenticModel = opts.model.includes('flash')
    ? opts.model
    : 'gemini-3-flash-preview'
  const model = genAI.getGenerativeModel({
    model: agenticModel,
    systemInstruction
  })

  console.warn(
    `Starting agentic loop with ${agenticModel}` +
      (subIssue ? ` — focus: ${subIssue.title}` : '')
  )

  const history: AgenticTurnContent[] = []
  let lastResult: ActionResult | undefined
  let consecutiveFailures = 0
  let lastActionKey = ''
  let repeatCount = 0
  const actionTypeCounts: Record<string, number> = {}
  const startTime = Date.now()

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const elapsed = Date.now() - startTime
    if (elapsed > TIME_BUDGET_MS) {
      console.warn(`Time budget exhausted (${elapsed}ms), stopping loop`)
      break
    }

    // 1. Capture screenshot
    const screenshotB64 = await captureScreenshotForGemini(page)

    // 2. Build user message for this turn
    const userParts: AgenticTurnContent['parts'] = []

    // Build focus reminder from QA guide or sub-issue
    const focusGoal = subIssue?.focus || qaGuideSummary.split('\n')[0] || ''

    if (turn === 0) {
      userParts.push({
        text: 'Here is the current screen state. What action should I take first to reproduce the reported issue?'
      })
    } else if (lastResult) {
      const statusText = lastResult.success
        ? `Action "${lastResult.action.action}" succeeded.`
        : `Action "${lastResult.action.action}" FAILED: ${lastResult.error}`
      const reminder =
        turn >= 3 && focusGoal ? `\nRemember your goal: ${focusGoal}` : ''
      userParts.push({
        text: `${statusText}\nHere is the screen after that action. What should I do next? (Turn ${turn + 1}/${MAX_TURNS}, ${Math.round((TIME_BUDGET_MS - elapsed) / 1000)}s remaining)${reminder}`
      })
    }

    userParts.push({
      inlineData: { mimeType: 'image/jpeg', data: screenshotB64 }
    })

    // Add to history, trimming old screenshots
    history.push({ role: 'user', parts: userParts })

    // Build contents with sliding window for screenshots
    const contents: AgenticTurnContent[] = history.map((entry, idx) => {
      // Keep screenshots only in last SCREENSHOT_HISTORY_WINDOW user turns
      const userTurnIndices = history
        .map((e, i) => (e.role === 'user' ? i : -1))
        .filter((i) => i >= 0)
      const recentUserTurns = userTurnIndices.slice(-SCREENSHOT_HISTORY_WINDOW)

      if (entry.role === 'user' && !recentUserTurns.includes(idx)) {
        // Replace screenshot with placeholder text
        return {
          role: entry.role,
          parts: entry.parts.map((p) =>
            'inlineData' in p ? { text: '[screenshot omitted]' } : p
          )
        }
      }
      return entry
    })

    // 3. Call Gemini
    let actionObj: TestAction
    try {
      const result = await model.generateContent({
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json'
        }
      })

      const responseText = result.response.text().trim()
      console.warn(`  Gemini [${turn}]: ${responseText.slice(0, 200)}`)

      const parsed = JSON.parse(responseText)
      if (parsed.reasoning) {
        console.warn(`  Reasoning: ${parsed.reasoning.slice(0, 150)}`)
      }
      actionObj = parsed.action || parsed.actions?.[0] || parsed
      if (!actionObj?.action) {
        throw new Error('No action field in response')
      }

      consecutiveFailures = 0
    } catch (e) {
      consecutiveFailures++
      const errMsg = e instanceof Error ? e.message.split('\n')[0] : String(e)
      console.warn(`  Gemini call failed (${consecutiveFailures}/3): ${errMsg}`)

      // Add a placeholder model response to keep history balanced
      history.push({
        role: 'model',
        parts: [
          {
            text: `{"reasoning": "API error", "action": {"action": "wait", "ms": 500}}`
          }
        ]
      })

      if (consecutiveFailures >= 3) {
        console.warn('3 consecutive API failures, falling back to static steps')
        await executeSteps(page, FALLBACK_REPRODUCE, outputDir)
        return
      }
      continue
    }

    // Add model response to history
    history.push({
      role: 'model',
      parts: [{ text: JSON.stringify({ action: actionObj }) }]
    })

    // 4. Check for done
    if (actionObj.action === 'done') {
      console.warn(
        `Agent signaled done: ${'reason' in actionObj ? actionObj.reason : 'no reason'}`
      )
      // Take a final screenshot
      await page.screenshot({
        path: `${outputDir}/agentic-final.png`
      })
      break
    }

    // 5. Stuck detection — normalize coords to 50px grid for fuzzy matching
    const normalizedAction = { ...actionObj } as Record<string, unknown>
    for (const key of ['x', 'y', 'fromX', 'fromY', 'toX', 'toY']) {
      if (typeof normalizedAction[key] === 'number') {
        normalizedAction[key] =
          Math.round((normalizedAction[key] as number) / 50) * 50
      }
    }
    const actionKey = JSON.stringify(normalizedAction)
    if (actionKey === lastActionKey) {
      repeatCount++
      if (repeatCount >= 3) {
        console.warn('Stuck: same action repeated 3x, breaking loop')
        break
      }
    } else {
      repeatCount = 0
      lastActionKey = actionKey
    }

    // Track action-type frequency — inject nudge if stuck in a pattern
    actionTypeCounts[actionObj.action] =
      (actionTypeCounts[actionObj.action] || 0) + 1
    let stuckNudge = ''
    if (actionTypeCounts[actionObj.action] >= 5) {
      stuckNudge = ` You have used "${actionObj.action}" ${actionTypeCounts[actionObj.action]} times. Try a different approach or action type.`
    }
    if (stuckNudge && lastResult) {
      // Append nudge to the last user message
      const lastUserEntry = history[history.length - 2] // -2 because model response was just pushed
      if (lastUserEntry?.role === 'user') {
        const textPart = lastUserEntry.parts.find(
          (p): p is { text: string } => 'text' in p
        )
        if (textPart) textPart.text += stuckNudge
      }
    }

    // 6. Execute the action
    lastResult = await executeAction(page, actionObj, outputDir)
  }

  console.warn('Agentic loop complete')
}

// ── Multi-pass issue decomposition ──

async function decomposeIssue(opts: Options): Promise<SubIssue[]> {
  const issueContext = opts.diffFile
    ? readFileSync(opts.diffFile, 'utf-8').slice(0, 8000)
    : ''

  if (!issueContext) {
    return [{ title: 'General reproduction', focus: 'Reproduce the issue' }]
  }

  const genAI = new GoogleGenerativeAI(opts.apiKey)
  const model = genAI.getGenerativeModel({ model: opts.model })

  console.warn('Decomposing issue into sub-issues...')

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Analyze this GitHub issue and decompose it into 1-3 independent, testable sub-issues that can each be reproduced in a separate browser session. Each sub-issue should focus on ONE specific bug or visual problem.

If the issue describes only one bug, return just one sub-issue.

Return JSON array: [{ "title": "short title", "focus": "specific instruction for what to test and how to trigger it" }]

Issue context:
${issueContext}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json'
      }
    })

    let text = result.response.text().trim()
    text = text
      .replace(/^```(?:json)?\n?/gm, '')
      .replace(/```$/gm, '')
      .trim()

    const subIssues: SubIssue[] = JSON.parse(text)
    if (!Array.isArray(subIssues) || subIssues.length === 0) {
      throw new Error('Expected non-empty array')
    }

    // Cap at 3 sub-issues
    const capped = subIssues.slice(0, 3)
    console.warn(
      `Decomposed into ${capped.length} sub-issue(s):`,
      capped.map((s) => s.title)
    )
    return capped
  } catch (e) {
    console.warn(
      'Issue decomposition failed, using single pass:',
      e instanceof Error ? e.message : e
    )
    return [
      { title: 'Issue reproduction', focus: 'Reproduce the reported issue' }
    ]
  }
}

// ── Video file management ──

function renameLatestWebm(
  outputDir: string,
  targetName: string,
  knownNames: Set<string>
) {
  const files = readdirSync(outputDir)
    .filter((f) => f.endsWith('.webm') && !knownNames.has(f))
    .sort((a, b) => {
      const mtimeA = statSync(`${outputDir}/${a}`).mtimeMs
      const mtimeB = statSync(`${outputDir}/${b}`).mtimeMs
      return mtimeB - mtimeA
    })
  if (files.length > 0) {
    renameSync(`${outputDir}/${files[0]}`, `${outputDir}/${targetName}`)
    console.warn(`Video saved: ${outputDir}/${targetName}`)
  } else {
    console.warn(`WARNING: No .webm video found for ${targetName}`)
  }
}

// ── Browser session helpers ──

async function launchSessionAndLogin(
  opts: Options,
  videoDir: string
): Promise<{
  browser: Awaited<ReturnType<typeof chromium.launch>>
  context: Awaited<
    ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newContext']>
  >
  page: Page
}> {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } }
  })
  const page = await context.newPage()

  console.warn(`Opening ComfyUI at ${opts.serverUrl}`)
  await page.goto(opts.serverUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  await sleep(2000)
  await loginAsQaCi(page, opts.serverUrl)
  await sleep(1000)

  return { browser, context, page }
}

// ── Main ──

async function main() {
  const opts = parseArgs()
  mkdirSync(opts.outputDir, { recursive: true })

  if (opts.mode === 'reproduce') {
    // Agentic multi-pass mode
    const subIssues = await decomposeIssue(opts)
    const knownNames = new Set<string>()

    for (let i = 0; i < subIssues.length; i++) {
      const subIssue = subIssues[i]
      const sessionLabel = subIssues.length === 1 ? '' : `-${i + 1}`
      const videoName = `qa-session${sessionLabel}.webm`

      console.warn(
        `\n=== Pass ${i + 1}/${subIssues.length}: ${subIssue.title} ===`
      )

      const { browser, context, page } = await launchSessionAndLogin(
        opts,
        opts.outputDir
      )

      try {
        await page.screenshot({
          path: `${opts.outputDir}/debug-after-login-reproduce${sessionLabel}.png`
        })
        console.warn('Editor ready — starting agentic loop')
        await runAgenticLoop(page, opts, opts.outputDir, subIssue)
        await sleep(2000)
      } finally {
        await context.close()
        await browser.close()
      }

      knownNames.add(videoName)
      renameLatestWebm(opts.outputDir, videoName, knownNames)
    }
  } else {
    // Before/after batch mode (unchanged)
    let steps: TestAction[]
    try {
      steps = await generateTestSteps(opts)
    } catch (err) {
      console.warn('Gemini generation failed, using fallback steps:', err)
      steps = FALLBACK_STEPS[opts.mode]
    }

    const { browser, context, page } = await launchSessionAndLogin(
      opts,
      opts.outputDir
    )

    try {
      await page.screenshot({
        path: `${opts.outputDir}/debug-after-login-${opts.mode}.png`
      })
      console.warn(`Debug screenshot saved: debug-after-login-${opts.mode}.png`)
      console.warn('Editor ready — executing test steps')
      await executeSteps(page, steps, opts.outputDir)
      await sleep(2000)
    } finally {
      await context.close()
      await browser.close()
    }

    const videoName =
      opts.mode === 'before' ? 'qa-before-session.webm' : 'qa-session.webm'
    const knownNames = new Set(['qa-before-session.webm', 'qa-session.webm'])
    renameLatestWebm(opts.outputDir, videoName, knownNames)
  }

  console.warn('Recording complete!')
}

main().catch((err) => {
  console.error('Recording failed:', err)
  process.exit(1)
})
