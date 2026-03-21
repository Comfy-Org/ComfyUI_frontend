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

import { firefox } from '@playwright/test'
import type { Page } from '@playwright/test'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { readFileSync, mkdirSync, readdirSync, renameSync } from 'fs'

// ── Types ──

type TestAction =
  | { action: 'openMenu' }
  | { action: 'hoverMenuItem'; label: string }
  | { action: 'clickMenuItem'; label: string }
  | { action: 'fillDialog'; text: string }
  | { action: 'pressKey'; key: string }
  | { action: 'click'; text: string }
  | { action: 'wait'; ms: number }
  | { action: 'screenshot'; name: string }

interface Options {
  mode: 'before' | 'after'
  diffFile: string
  outputDir: string
  serverUrl: string
  model: string
  apiKey: string
  testPlanFile?: string
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
        opts.mode = args[++i] as 'before' | 'after'
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
      case '--help':
        console.warn(
          'Usage: qa-record.ts --mode before|after --diff <path> --output-dir <path> [--url <url>] [--model <model>] [--test-plan <path>]'
        )
        process.exit(0)
    }
  }

  if (!opts.mode || !opts.diffFile || !opts.outputDir) {
    console.error(
      'Required: --mode before|after --diff <path> --output-dir <path>'
    )
    process.exit(1)
  }

  if (!opts.apiKey) {
    console.error('GEMINI_API_KEY environment variable is required')
    process.exit(1)
  }

  return opts as Options
}

// ── Gemini test step generation ──

function buildPrompt(mode: string, diff: string, testPlan?: string): string {
  const modeDesc =
    mode === 'before'
      ? 'BEFORE (main branch). Show the OLD state briefly — under 15 seconds. One quick demonstration of missing feature / old behavior.'
      : 'AFTER (PR branch). Prove the changes work — 3-6 targeted steps, under 30 seconds.'

  const testPlanSection = testPlan
    ? `
## QA Test Plan Reference
Use this test plan to identify which test categories are relevant to the PR diff.
Pick test steps from the most relevant categories.

${testPlan.slice(0, 4000)}
`
    : ''

  return `You are generating test steps for a ComfyUI frontend QA recording.

MODE: ${modeDesc}

## Available actions (JSON array)
Each step is an object with an "action" field:
- { "action": "openMenu" } — clicks the Comfy hamburger menu (top-left C logo)
- { "action": "hoverMenuItem", "label": "File" } — hovers a top-level menu item to open submenu
- { "action": "clickMenuItem", "label": "Save As" } — clicks an item in the visible submenu
- { "action": "fillDialog", "text": "test-name" } — fills the dialog input and presses Enter
- { "action": "pressKey", "key": "Escape" } — presses a keyboard key
- { "action": "click", "text": "Button Text" } — clicks an element by visible text
- { "action": "wait", "ms": 1000 } — waits (use sparingly, max 3000ms)
- { "action": "screenshot", "name": "step-name" } — takes a screenshot
${testPlanSection}
## PR Diff
\`\`\`
${diff.slice(0, 3000)}
\`\`\`

## Rules
- Output ONLY a valid JSON array of actions, no markdown fences or explanation
- ${mode === 'before' ? 'Keep it minimal — just show the old/missing behavior' : 'Test the specific behavior that changed in the PR'}
- Always include at least one screenshot
- Do NOT include login steps (handled automatically)
- Menu navigation pattern: openMenu → hoverMenuItem → clickMenuItem (or screenshot)
- Pick test steps from the QA test plan categories that are most relevant to the diff

## Example output
[
  {"action":"openMenu"},
  {"action":"hoverMenuItem","label":"File"},
  {"action":"screenshot","name":"file-menu"},
  {"action":"clickMenuItem","label":"Save As"},
  {"action":"wait","ms":800},
  {"action":"fillDialog","text":"test-save"},
  {"action":"wait","ms":2000},
  {"action":"screenshot","name":"after-save"}
]`
}

async function generateTestSteps(opts: Options): Promise<TestAction[]> {
  const diff = readFileSync(opts.diffFile, 'utf-8')
  const testPlan = opts.testPlanFile
    ? readFileSync(opts.testPlanFile, 'utf-8')
    : undefined
  const prompt = buildPrompt(opts.mode, diff, testPlan)

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

// ── Playwright helpers ──

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function openComfyMenu(page: Page) {
  await page.mouse.click(20, 67)
  await sleep(800)
}

async function hoverMenuItem(page: Page, label: string) {
  const item = page
    .locator('.p-menubar-item-label, .p-tieredmenu-item-label')
    .filter({ hasText: label })
    .first()
  if (await item.isVisible().catch(() => false)) {
    const parent = item.locator('..').locator('..')
    await parent.hover()
    await sleep(600)
  } else {
    console.warn(`Menu item "${label}" not visible`)
  }
}

async function clickSubmenuItem(page: Page, label: string) {
  const item = page
    .locator('.p-tieredmenu-submenu:visible')
    .locator(`text=${label}`)
    .first()
  if (await item.isVisible().catch(() => false)) {
    await item.click()
    await sleep(800)
  } else {
    console.warn(`Submenu item "${label}" not found`)
  }
}

async function fillDialogAndConfirm(page: Page, text: string) {
  const input = page.locator('.p-dialog-content input')
  if (await input.isVisible().catch(() => false)) {
    await input.fill(text)
    await sleep(300)
    await page.keyboard.press('Enter')
    await sleep(2000)
  } else {
    console.warn('Dialog input not found')
  }
}

async function clickByText(page: Page, text: string) {
  const el = page.locator(`text=${text}`).first()
  if (await el.isVisible().catch(() => false)) {
    await el.click()
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
      `  → ${step.action}${('label' in step && `: ${step.label}`) || ('text' in step && `: ${step.text}`) || ('name' in step && `: ${step.name}`) || ''}`
    )
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
        await page.keyboard.press(step.key)
        await sleep(300)
        break
      case 'click':
        await clickByText(page, step.text)
        break
      case 'wait':
        await sleep(Math.min(step.ms, 5000))
        break
      case 'screenshot':
        await page.screenshot({
          path: `${outputDir}/${step.name}.png`
        })
        break
      default:
        console.warn(`Unknown action: ${JSON.stringify(step)}`)
    }
  }
}

// ── Login flow ──

async function loginAsQaCi(page: Page, serverUrl: string) {
  console.warn('Logging in as qa-ci...')

  // Pre-seed localStorage to bypass login and template gallery
  await page.evaluate(() => {
    localStorage.setItem('Comfy.userId', 'qa-ci')
    localStorage.setItem('Comfy.userName', 'qa-ci')
    localStorage.setItem('Comfy.TutorialCompleted', 'true')
  })

  // Reload so the router guard picks up the seeded user
  await page.goto(serverUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  await sleep(3000)

  // If still on user-select (e.g. multi-user server with strict auth),
  // create a new user via the text input
  if (page.url().includes('user-select')) {
    console.warn('Still on user-select, creating new user...')
    const newUserInput = page
      .locator('input[placeholder*="user"], input[type="text"]')
      .first()
    if (await newUserInput.isVisible().catch(() => false)) {
      await newUserInput.fill('qa-ci')
      await sleep(300)
    }
    const nextBtn = page.getByRole('button', { name: 'Next' })
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click({ timeout: 5000 })
      await sleep(3000)
    }
  }

  // Close template gallery if it appeared
  await page.keyboard.press('Escape')
  await sleep(1000)

  // Dismiss error popup if present
  const dismissBtn = page.locator('text=Dismiss').first()
  if (await dismissBtn.isVisible().catch(() => false)) {
    await dismissBtn.click()
    await sleep(500)
  }
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
    steps = opts.mode === 'before' ? FALLBACK_BEFORE : FALLBACK_AFTER
  }

  // Launch browser with video recording
  const browser = await firefox.launch({ headless: true })
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
  const knownNames = new Set(['qa-before-session.webm', 'qa-session.webm'])
  const files = readdirSync(opts.outputDir).filter(
    (f) => f.endsWith('.webm') && !knownNames.has(f)
  )
  if (files.length > 0) {
    const recorded = files[files.length - 1]
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
