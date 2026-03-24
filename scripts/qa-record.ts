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
    model: 'gemini-2.5-flash',
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
- The **default workflow** loads with ~5 nodes already on canvas

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

// ── Step executor ──

async function executeSteps(
  page: Page,
  steps: TestAction[],
  outputDir: string
) {
  for (const step of steps) {
    console.warn(
      `  → ${step.action}${('label' in step && `: ${step.label}`) || ('text' in step && `: ${step.text}`) || ('name' in step && `: ${step.name}`) || ('x' in step && `: (${step.x},${step.y})`) || ''}`
    )
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
            // Double-click center of canvas as fallback
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
          const safeName = step.name
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 100)
          await page.screenshot({
            path: `${outputDir}/${safeName}.png`
          })
          break
        }
        case 'loadWorkflow': {
          // Load a workflow JSON from a URL into ComfyUI via the API
          console.warn(`  Loading workflow from: ${step.url}`)
          await page.evaluate(async (workflowUrl) => {
            const resp = await fetch(workflowUrl)
            const workflow = await resp.json()
            // Use ComfyUI's app.loadGraphData to load the workflow
            const app = (window as Record<string, unknown>).app as {
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
          // Set a ComfyUI setting via the app API
          console.warn(`  Setting ${step.id} = ${step.value}`)
          await page.evaluate(
            ({ id, value }) => {
              const app = (window as Record<string, unknown>).app as {
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
        default:
          console.warn(`Unknown action: ${JSON.stringify(step)}`)
      }
    } catch (e) {
      console.warn(
        `Step ${step.action} failed: ${e instanceof Error ? e.message.split('\n')[0] : e}`
      )
    }
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

// ── Main ──

async function main() {
  const opts = parseArgs()
  mkdirSync(opts.outputDir, { recursive: true })

  // Generate or fall back to default test steps
  let steps: TestAction[]
  try {
    steps = await generateTestSteps(opts)
  } catch (err) {
    console.warn('Gemini generation failed, using fallback steps:', err)
    steps = FALLBACK_STEPS[opts.mode]
  }

  // Launch browser with video recording (Chromium for WebGL support)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: opts.outputDir, size: { width: 1280, height: 720 } }
  })
  const page = await context.newPage()

  try {
    console.warn(`Opening ComfyUI at ${opts.serverUrl}`)
    await page.goto(opts.serverUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })
    await sleep(2000)

    await loginAsQaCi(page, opts.serverUrl)

    // Debug: capture page state after login
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

  // Rename the recorded video to expected filename
  const videoName =
    opts.mode === 'before' ? 'qa-before-session.webm' : 'qa-session.webm'
  // reproduce mode uses 'qa-session.webm' (same as after — it's the primary video)
  const knownNames = new Set(['qa-before-session.webm', 'qa-session.webm'])
  const files = readdirSync(opts.outputDir)
    .filter((f) => f.endsWith('.webm') && !knownNames.has(f))
    .sort((a, b) => {
      const mtimeA = statSync(`${opts.outputDir}/${a}`).mtimeMs
      const mtimeB = statSync(`${opts.outputDir}/${b}`).mtimeMs
      return mtimeB - mtimeA
    })
  if (files.length > 0) {
    const recorded = files[0]
    renameSync(
      `${opts.outputDir}/${recorded}`,
      `${opts.outputDir}/${videoName}`
    )
    console.warn(`Video saved: ${opts.outputDir}/${videoName}`)
  } else {
    console.warn('WARNING: No .webm video found after recording')
  }

  console.warn('Recording complete!')
}

main().catch((err) => {
  console.error('Recording failed:', err)
  process.exit(1)
})
