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
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync
} from 'fs'
import { execSync } from 'child_process'

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
  | {
      action: 'annotate'
      text: string
      x: number
      y: number
      durationMs?: number
    }
  | { action: 'addNode'; nodeName: string; x?: number; y?: number }
  | { action: 'cloneNode'; x: number; y: number }
  | { action: 'copyPaste'; x?: number; y?: number }
  | {
      action: 'holdKeyAndDrag'
      key: string
      fromX: number
      fromY: number
      toX: number
      toY: number
    }
  | { action: 'resizeNode'; x: number; y: number; dx: number; dy: number }
  | { action: 'middleClick'; x: number; y: number }

export interface ActionResult {
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

### Compound actions (save multiple turns)
- { "action": "addNode", "nodeName": "KSampler", "x": 640, "y": 400 } — double-clicks canvas, types name, presses Enter
- { "action": "cloneNode", "x": 750, "y": 350 } — right-clicks node, clicks Clone
- { "action": "copyPaste", "x": 640, "y": 400 } — clicks node at coords, Ctrl+C then Ctrl+V
- { "action": "holdKeyAndDrag", "key": " ", "fromX": 640, "fromY": 400, "toX": 400, "toY": 300 } — hold key + drag (Space=pan)
- { "action": "resizeNode", "x": 200, "y": 380, "dx": 100, "dy": 50 } — drag node edge to resize
- { "action": "middleClick", "x": 640, "y": 400 } — middle mouse button

### Utility actions
- { "action": "wait", "ms": 1000 } — waits (use sparingly, max 3000ms)
- { "action": "screenshot", "name": "step-name" } — takes a screenshot
- { "action": "annotate", "text": "Look here!", "x": 640, "y": 400 } — shows a floating label at coordinates for 2s (use to draw viewer attention to important UI state)
- { "action": "annotate", "text": "Bug: tab still dirty", "x": 100, "y": 20, "durationMs": 3000 } — annotation with custom duration
- { "action": "reload" } — reloads the page (use for testing state persistence across page loads)
${qaGuideSection}${testPlanSection}
${diff ? `## PR Diff\n\`\`\`\n${diff.slice(0, 3000)}\n\`\`\`` : ''}

## Rules
- Output ONLY a valid JSON array of actions, no markdown fences or explanation
- ${mode === 'reproduce' ? 'You MUST follow the reproduction steps from the issue closely. Generate 8-15 steps that actually trigger the bug. Do NOT just open a menu and take a screenshot — perform the FULL reproduction sequence including node interactions, context menus, keyboard shortcuts, and canvas operations' : mode === 'before' ? 'Keep it minimal — just show the old/missing behavior' : 'CRITICAL: Test the EXACT behavior changed by the PR. Read the diff carefully to understand what UI feature was modified. Do NOT just open menus and take screenshots — you must TRIGGER the specific scenario the PR fixes. For example: if the PR fixes "tabs lost on restart", actually create tabs AND reload the page. If the PR fixes "widget disappears on collapse", create a subgraph with widgets AND collapse it. Generic UI walkthrough is USELESS — demonstrate the actual fix working.'}
- Always include at least one screenshot
- Do NOT include login steps (handled automatically)
- The default workflow is already loaded when your steps start
- CRITICAL menu navigation: You MUST use ALL THREE steps in order: openMenu → hoverMenuItem("File") → clickMenuItem("Save As"). NEVER use clickMenuItem without openMenu and hoverMenuItem first — the menu items are NOT visible until you open the menu and hover the correct submenu. The top-level menu items are: "File", "Edit", "View", "Theme", "Help". Example: [{"action":"openMenu"},{"action":"hoverMenuItem","label":"File"},{"action":"clickMenuItem","label":"Save As"}]
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

async function moveCursorOverlay(page: Page, x: number, y: number) {
  await page.evaluate(
    ([cx, cy]) => {
      const fn = (window as unknown as Record<string, unknown>).__moveCursor as
        | ((x: number, y: number) => void)
        | undefined
      if (fn) fn(cx, cy)
    },
    [x, y]
  )
}

async function clickCursorOverlay(page: Page, down: boolean) {
  await page.evaluate((d) => {
    const fn = (window as unknown as Record<string, unknown>).__clickCursor as
      | ((down: boolean) => void)
      | undefined
    if (fn) fn(d)
  }, down)
}

interface NarrationSegment {
  turn: number
  timestampMs: number
  text: string
}

// Collected during recording, used for TTS post-processing
const narrationSegments: NarrationSegment[] = []
const recordingStartMs = 0

async function showSubtitle(page: Page, text: string, turn: number) {
  const safeText = text.slice(0, 120).replace(/'/g, "\\'").replace(/\n/g, ' ')
  const encoded = encodeURIComponent(safeText)

  // Track for TTS post-processing
  narrationSegments.push({
    turn,
    timestampMs: Date.now() - recordingStartMs,
    text: safeText
  })

  await page.addScriptTag({
    content: `(function(){
      var id='qa-subtitle';
      var el=document.getElementById(id);
      if(!el){
        el=document.createElement('div');
        el.id=id;
        Object.assign(el.style,{position:'fixed',bottom:'32px',left:'50%',transform:'translateX(-50%)',zIndex:'2147483646',maxWidth:'90%',padding:'6px 14px',borderRadius:'6px',background:'rgba(0,0,0,0.8)',color:'rgba(255,255,255,0.95)',fontSize:'12px',fontFamily:'system-ui,sans-serif',fontWeight:'400',lineHeight:'1.4',pointerEvents:'none',textAlign:'center',transition:'opacity 0.3s',whiteSpace:'normal'});
        document.body.appendChild(el);
      }
      var msg=decodeURIComponent('${encoded}');
      el.textContent='['+${turn}+'] '+msg;
      el.style.opacity='1';
    })()`
  })
}

async function generateNarrationAudio(
  segments: NarrationSegment[],
  outputDir: string,
  _apiKey: string
): Promise<string | null> {
  if (segments.length === 0) return null

  const narrationDir = `${outputDir}/narration`
  mkdirSync(narrationDir, { recursive: true })

  // Save narration metadata
  writeFileSync(
    `${narrationDir}/segments.json`,
    JSON.stringify(segments, null, 2)
  )

  // Generate TTS using OpenAI API (high quality, fast)
  const ttsKey = process.env.OPENAI_API_KEY
  if (!ttsKey) {
    console.warn('  OPENAI_API_KEY not set, skipping TTS narration')
    return null
  }

  const audioFiles: Array<{ path: string; offsetMs: number }> = []

  for (const seg of segments) {
    const audioPath = `${narrationDir}/turn-${seg.turn}.mp3`
    try {
      const resp = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ttsKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: 'nova',
          input: seg.text,
          speed: 1.15
        })
      })
      if (!resp.ok)
        throw new Error(`TTS API ${resp.status}: ${await resp.text()}`)
      const audioBuffer = Buffer.from(await resp.arrayBuffer())
      writeFileSync(audioPath, audioBuffer)
      audioFiles.push({ path: audioPath, offsetMs: seg.timestampMs })
      console.warn(
        `  TTS [${seg.turn}]: ${audioPath} (${audioBuffer.length} bytes)`
      )
    } catch (e) {
      console.warn(
        `  TTS [${seg.turn}] failed: ${e instanceof Error ? e.message.slice(0, 80) : e}`
      )
    }
  }

  if (audioFiles.length === 0) return null

  // Build ffmpeg filter to mix all audio clips at correct timestamps
  const inputArgs: string[] = []
  const filterParts: string[] = []

  for (let i = 0; i < audioFiles.length; i++) {
    inputArgs.push('-i', audioFiles[i].path)
    filterParts.push(
      `[${i}]adelay=${audioFiles[i].offsetMs}|${audioFiles[i].offsetMs}[a${i}]`
    )
  }

  const mixInputs = audioFiles.map((_, i) => `[a${i}]`).join('')
  const filter = `${filterParts.join(';')};${mixInputs}amix=inputs=${audioFiles.length}:normalize=0[aout]`

  const mixedAudio = `${narrationDir}/mixed.mp3`
  try {
    execSync(
      `ffmpeg -y ${inputArgs.join(' ')} -filter_complex "${filter}" -map "[aout]" "${mixedAudio}" 2>/dev/null`,
      { timeout: 30000 }
    )
    console.warn(`  TTS mixed: ${mixedAudio}`)
    return mixedAudio
  } catch (e) {
    console.warn(
      `  TTS mix failed: ${e instanceof Error ? e.message.slice(0, 80) : e}`
    )
    return null
  }
}

function mergeAudioIntoVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string
): boolean {
  try {
    execSync(
      `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${outputPath}" 2>/dev/null`,
      { timeout: 60000 }
    )
    // Replace original with narrated version
    renameSync(outputPath, videoPath)
    console.warn(`  Narrated video: ${videoPath}`)
    return true
  } catch (e) {
    console.warn(
      `  Audio merge failed: ${e instanceof Error ? e.message.slice(0, 80) : e}`
    )
    return false
  }
}

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
    const box = await menuItem.boundingBox().catch(() => null)
    if (box)
      await moveCursorOverlay(
        page,
        box.x + box.width / 2,
        box.y + box.height / 2
      )
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
    const box = await primeItem.boundingBox().catch(() => null)
    if (box)
      await moveCursorOverlay(
        page,
        box.x + box.width / 2,
        box.y + box.height / 2
      )
    if (box) await clickCursorOverlay(page, true)
    await primeItem.click({ timeout: 5000 }).catch(() => {
      console.warn(`Click on PrimeVue menu item "${label}" failed`)
    })
    if (box) await clickCursorOverlay(page, false)
    await sleep(800)
    return
  }

  // Try litegraph context menu (right-click on nodes/canvas)
  const liteItem = page
    .locator('.litemenu-entry')
    .filter({ hasText: label })
    .first()
  if (await liteItem.isVisible().catch(() => false)) {
    const box = await liteItem.boundingBox().catch(() => null)
    if (box)
      await moveCursorOverlay(
        page,
        box.x + box.width / 2,
        box.y + box.height / 2
      )
    if (box) await clickCursorOverlay(page, true)
    await liteItem.click({ timeout: 5000 }).catch(() => {
      console.warn(`Click on litegraph menu item "${label}" failed`)
    })
    if (box) await clickCursorOverlay(page, false)
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
    // Get element position for cursor overlay
    const box = await el.boundingBox().catch(() => null)
    if (box) {
      await moveCursorOverlay(
        page,
        box.x + box.width / 2,
        box.y + box.height / 2
      )
    }
    await el.hover({ timeout: 3000 }).catch(() => {})
    await sleep(400)
    if (box) await clickCursorOverlay(page, true)
    await el.click({ timeout: 5000 }).catch((e) => {
      console.warn(
        `Click on "${text}" failed: ${e instanceof Error ? e.message.split('\n')[0] : e}`
      )
    })
    if (box) await clickCursorOverlay(page, false)
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

export async function executeAction(
  page: Page,
  step: TestAction,
  outputDir: string
): Promise<ActionResult> {
  console.warn(
    `  → ${step.action}${('label' in step && `: ${step.label}`) || ('nodeName' in step && `: ${step.nodeName}`) || ('text' in step && `: ${step.text}`) || ('name' in step && `: ${step.name}`) || ('x' in step && `: (${step.x},${step.y})`) || ''}`
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
          // Show key in subtitle (persists 2s) then instant press
          const keyLabel =
            step.key === ' '
              ? 'Space'
              : step.key.length === 1
                ? step.key.toUpperCase()
                : step.key
          await showSubtitle(page, `⌨ ${keyLabel}`, 0)
          await sleep(200) // Let subtitle render before pressing
          await page.keyboard.press(step.key)
          await sleep(500)
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
        await page.mouse.move(step.x, step.y)
        await sleep(300)
        await page.mouse.click(step.x, step.y)
        await sleep(300)
        break
      case 'rightClickCanvas':
        await page.mouse.move(step.x, step.y)
        await sleep(300)
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
        // Load default workflow via app API (most reliable, no menu navigation)
        try {
          await page.evaluate(() => {
            const app = (window as unknown as Record<string, unknown>).app as {
              loadGraphData?: (d: unknown) => Promise<void>
              resetToDefaultWorkflow?: () => Promise<void>
            }
            if (app?.resetToDefaultWorkflow) return app.resetToDefaultWorkflow()
            return Promise.resolve()
          })
          await sleep(1000)
        } catch {
          // Fallback: try menu navigation with multiple possible item names
          await openComfyMenu(page)
          await hoverMenuItem(page, 'File')
          const loaded = await clickSubmenuItem(page, 'Load Default')
            .then(() => true)
            .catch(() => false)
          if (!loaded) {
            await clickSubmenuItem(page, 'Default Workflow').catch(() => {})
          }
          await sleep(1000)
        }
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
      case 'annotate': {
        const duration = Math.min(step.durationMs ?? 2000, 5000)
        await page.evaluate(
          ({ text, x, y, ms }) => {
            const el = document.createElement('div')
            el.textContent = 'QA: ' + text
            Object.assign(el.style, {
              position: 'fixed',
              left: x + 'px',
              top: y + 'px',
              zIndex: '2147483646',
              padding: '3px 8px',
              borderRadius: '3px',
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1.5px dashed rgba(120, 200, 255, 0.8)',
              color: 'rgba(120, 200, 255, 0.9)',
              fontSize: '11px',
              fontWeight: '500',
              fontFamily: 'monospace',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              transform: 'translateY(-100%) translateX(-50%)',
              animation: 'qa-ann-in 200ms ease-out'
            })
            const style = document.createElement('style')
            style.textContent =
              '@keyframes qa-ann-in{from{opacity:0;transform:translateY(-80%) translateX(-50%)}to{opacity:1;transform:translateY(-100%) translateX(-50%)}}'
            document.head.appendChild(style)
            document.body.appendChild(el)
            setTimeout(() => {
              el.remove()
              style.remove()
            }, ms)
          },
          { text: step.text, x: step.x, y: step.y, ms: duration }
        )
        await sleep(duration + 200)
        break
      }
      case 'addNode': {
        const nx = step.x ?? 640
        const ny = step.y ?? 400
        await page.mouse.dblclick(nx, ny)
        await sleep(500)
        await page.keyboard.type(step.nodeName, { delay: 30 })
        await sleep(300)
        await page.keyboard.press('Enter')
        await sleep(500)
        console.warn(`  Added node "${step.nodeName}" at (${nx}, ${ny})`)
        break
      }
      case 'cloneNode': {
        // Select node then Ctrl+C/Ctrl+V — works in both legacy and Nodes 2.0
        await page.mouse.click(step.x, step.y)
        await sleep(300)
        await page.keyboard.press('Control+c')
        await sleep(200)
        await page.keyboard.press('Control+v')
        await sleep(500)
        console.warn(`  Cloned node at (${step.x}, ${step.y}) via Ctrl+C/V`)
        break
      }
      case 'copyPaste': {
        const cx = step.x ?? 640
        const cy = step.y ?? 400
        await page.mouse.click(cx, cy)
        await sleep(200)
        await page.keyboard.press('Control+c')
        await sleep(300)
        await page.keyboard.press('Control+v')
        await sleep(500)
        console.warn(`  Copy-pasted at (${cx}, ${cy})`)
        break
      }
      case 'holdKeyAndDrag': {
        await page.keyboard.down(step.key)
        await sleep(100)
        await page.mouse.move(step.fromX, step.fromY)
        await page.mouse.down()
        await sleep(100)
        const hkSteps = 5
        for (let i = 1; i <= hkSteps; i++) {
          const hx = step.fromX + ((step.toX - step.fromX) * i) / hkSteps
          const hy = step.fromY + ((step.toY - step.fromY) * i) / hkSteps
          await page.mouse.move(hx, hy)
          await sleep(50)
        }
        await page.mouse.up()
        await page.keyboard.up(step.key)
        await sleep(300)
        console.warn(
          `  Hold ${step.key} + drag (${step.fromX},${step.fromY})→(${step.toX},${step.toY})`
        )
        break
      }
      case 'resizeNode': {
        // Click bottom-right corner of node, then drag
        await page.mouse.move(step.x, step.y)
        await page.mouse.down()
        await sleep(100)
        await page.mouse.move(step.x + step.dx, step.y + step.dy)
        await sleep(100)
        await page.mouse.up()
        await sleep(300)
        console.warn(
          `  Resized node at (${step.x},${step.y}) by (${step.dx},${step.dy})`
        )
        break
      }
      case 'middleClick': {
        await page.mouse.click(step.x, step.y, { button: 'middle' })
        await sleep(300)
        console.warn(`  Middle-clicked at (${step.x}, ${step.y})`)
        break
      }
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

function buildIssueSpecificHints(context: string): string {
  const ctx = context.toLowerCase()
  const hints: string[] = []

  if (/clone|z.?index|overlap|above.*origin|layering/.test(ctx))
    hints.push(
      'Preflight already cloned a node. NOW: take a screenshot to see the cloned node, then dragCanvas from (~800,350) to (~750,350) to overlap the clone on the original. Take screenshot to capture z-index. The clone should be ABOVE the original.'
    )
  if (/copy.*paste|paste.*offset|ctrl\+c|ctrl\+v|clipboard/.test(ctx))
    hints.push(
      'MUST: loadDefaultWorkflow, then clickCanvas on a node (~450,250), then use copyPaste to copy+paste it. Check if pasted nodes are offset or misaligned.'
    )
  if (/group.*paste|paste.*group/.test(ctx))
    hints.push(
      'MUST: Select multiple nodes by drag-selecting, then copyPaste. Check if the group frame and nodes align after paste.'
    )
  if (/numeric.*drag|drag.*numeric|drag.*value|widget.*drag|slider/.test(ctx))
    hints.push(
      'Preflight already enabled Nodes 2.0 and loaded the workflow. NOW: take a screenshot, find a numeric widget (e.g. KSampler seed/cfg around ~750,300), then use dragCanvas from that widget value to the right (fromX:750,fromY:300,toX:850,toY:300) to attempt changing the value by dragging. Take screenshot after to compare.'
    )
  if (
    /sidebar.*file|file.*extension|workflow.*sidebar|workflow.*tree/.test(ctx)
  )
    hints.push(
      'MUST: Click the "Workflows" button in the left sidebar to open the file tree. Take a screenshot of the file list to check for missing extensions.'
    )
  if (/spacebar|space.*pan|pan.*space|space.*drag/.test(ctx))
    hints.push(
      'Preflight already loaded the workflow. NOW: first take a screenshot, then use holdKeyAndDrag with key=" " (Space) fromX:640 fromY:400 toX:400 toY:300 to test spacebar panning. Take screenshot after. Then try: clickCanvas on an output slot (~200,320), then holdKeyAndDrag with key=" " to test panning while connecting.'
    )
  if (/resize.*node|node.*resize|gap.*widget|widget.*gap/.test(ctx))
    hints.push(
      'MUST: loadDefaultWorkflow, then use resizeNode on the bottom-right corner of a node (e.g. KSampler at ~830,430 with dx=100,dy=50) to resize it. Screenshot before and after.'
    )
  if (/new.*tab|open.*tab|tab.*open/.test(ctx))
    hints.push(
      'MUST: Right-click on a workflow tab in the topbar, then look for "Open in new tab" option in the context menu.'
    )
  if (/hover.*image|zoom.*button|asset.*column|thumbnail/.test(ctx))
    hints.push(
      'MUST: Open the sidebar, navigate to assets/models, hover over image thumbnails to trigger the zoom button overlay. Screenshot the hover state.'
    )
  if (/scroll.*leak|scroll.*text|text.*widget.*scroll|scroll.*canvas/.test(ctx))
    hints.push(
      'MUST: loadDefaultWorkflow, click on a text widget (e.g. CLIP Text Encode prompt at ~450,250), type some text, then use scrollCanvas inside the widget area to test if scroll leaks to canvas zoom.'
    )
  if (/middle.*click|mmb|reroute/.test(ctx))
    hints.push(
      'MUST: loadDefaultWorkflow, then use middleClick on a link/wire between two nodes to test reroute creation.'
    )
  if (/node.*shape|change.*shape/.test(ctx))
    hints.push(
      'MUST: loadDefaultWorkflow, then rightClickCanvas on a node (~750,350), look for "Shape" or "Properties" in context menu to change node shape.'
    )
  if (/nodes.*2\.0|vue.*node|new.*node/.test(ctx))
    hints.push(
      'MUST: Enable Nodes 2.0 via setSetting("Comfy.UseNewMenu","Top") and setSetting("Comfy.NodeBeta.Enabled",true) FIRST before testing.'
    )

  if (hints.length === 0) return ''
  return `\n## Issue-Specific Action Plan\nBased on keyword analysis of this issue, you MUST follow these steps:\n${hints.map((h, i) => `${i + 1}. ${h}`).join('\n')}\nDo NOT skip these steps. They are the minimum required to attempt reproduction.\n`
}

function buildPreflightActions(context: string): TestAction[] {
  const ctx = context.toLowerCase()
  const actions: TestAction[] = []

  // Enable Nodes 2.0 if issue mentions it — requires reload to take effect
  if (/nodes.*2\.0|vue.*node|new.*node|node.*beta/.test(ctx)) {
    actions.push({
      action: 'setSetting',
      id: 'Comfy.NodeBeta.Enabled',
      value: true
    })
    actions.push({ action: 'reload' })
  }

  // Load default workflow for most reproduction scenarios
  if (
    /clone|z.?index|overlap|copy.*paste|paste|resize|drag|scroll.*leak|scroll.*text|spacebar|space.*pan|node.*shape|numeric/.test(
      ctx
    )
  ) {
    actions.push({ action: 'loadDefaultWorkflow' })
    actions.push({ action: 'screenshot', name: 'preflight-default-workflow' })
  }

  // Issue-specific preflight: perform the actual reproduction steps
  // mechanically so the agent starts with the right state
  if (/clone|z.?index|above.*origin/.test(ctx)) {
    // #10307: clone a node and check z-index
    actions.push({ action: 'cloneNode', x: 750, y: 350 })
    actions.push({ action: 'screenshot', name: 'preflight-after-clone' })
  }

  if (/numeric.*drag|drag.*numeric|drag.*value|widget.*drag/.test(ctx)) {
    // #7414: click on a numeric widget value to prepare for drag test
    actions.push({ action: 'clickCanvas', x: 750, y: 300 })
    actions.push({ action: 'screenshot', name: 'preflight-numeric-widget' })
  }

  if (/spacebar.*pan|space.*pan|pan.*space/.test(ctx)) {
    // #7806: start a connection drag then try spacebar pan
    // First click an output slot to start dragging a wire
    actions.push({ action: 'screenshot', name: 'preflight-before-connection' })
  }

  return actions
}

function buildAgenticSystemPrompt(
  issueContext: string,
  subIssueFocus?: string,
  qaGuide?: string,
  preflightNote?: string
): string {
  const focusSection = subIssueFocus
    ? `\n## Current Focus\nYou are reproducing this specific sub-issue: ${subIssueFocus}\nStay focused on this particular bug. When you have demonstrated it, return done.\n`
    : ''

  const qaSection = qaGuide
    ? `\n## QA Analysis\nA deep analysis of this issue produced the following guide. Follow it closely:\n${qaGuide}\n`
    : ''

  const issueHints = buildIssueSpecificHints(issueContext)

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
- { "action": "addNode", "nodeName": "KSampler", "x": 640, "y": 400 } — double-clicks canvas to open search, types node name, presses Enter
- { "action": "cloneNode", "x": 750, "y": 350 } — right-clicks node at coords and clicks Clone
- { "action": "copyPaste", "x": 640, "y": 400 } — clicks at coords then Ctrl+C, Ctrl+V
- { "action": "holdKeyAndDrag", "key": " ", "fromX": 640, "fromY": 400, "toX": 400, "toY": 300 } — holds key (e.g. Space for pan) while dragging
- { "action": "resizeNode", "x": 200, "y": 380, "dx": 100, "dy": 50 } — drags from node edge to resize
- { "action": "middleClick", "x": 640, "y": 400 } — middle mouse button click
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
- Prefer convenience actions (loadDefaultWorkflow, openSettings, addNode, cloneNode) over manual menu navigation — they save turns and are more reliable.
- To add nodes to the canvas: use addNode (double-clicks canvas → types name → Enter), or loadDefaultWorkflow (loads 7 default nodes).
- For visual/rendering bugs (z-index, overlap, z-fighting): ALWAYS start with loadDefaultWorkflow to get nodes on canvas. You cannot reproduce visual bugs on an empty canvas.
- To clone a node: use cloneNode at the node's coordinates (right-clicks → Clone).
- To overlap nodes for z-index testing: use dragCanvas to move one node on top of another.
- For copy-paste bugs: use copyPaste to select+copy+paste a node or group.
- For panning bugs: use holdKeyAndDrag with key=" " (Space) to test spacebar panning.
- For node resize bugs: use resizeNode on the bottom-right corner of a node.
- For reroute/middle-click bugs: use middleClick on a link or slot.
- Do NOT waste turns on generic exploration. Focus on reproducing the specific bug.
${preflightNote || ''}${issueHints}${focusSection}${qaSection}
## Issue to Reproduce
${issueContext}`
}

interface AgenticTurnContent {
  role: 'user' | 'model'
  parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  >
}

// @ts-expect-error TS6133 — legacy function kept for fallback
async function _runAgenticLoop(
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

  // Auto-execute prerequisite actions based on issue keywords BEFORE the
  // agentic loop starts. This guarantees nodes are on canvas, settings are
  // correct, etc. — the agent model often ignores prompt-only hints.
  const preflight = buildPreflightActions(issueContext)
  if (preflight.length > 0) {
    console.warn(`Running ${preflight.length} preflight actions...`)
    for (const action of preflight) {
      await executeAction(page, action, outputDir)
    }
    await sleep(500)
  }

  // Tell the agent what preflight already did so it doesn't repeat
  const preflightNote =
    preflight.length > 0
      ? `\n## Already Done (by preflight)\nThe following actions were ALREADY executed before you started. Do NOT repeat them:\n${preflight.map((a) => `- ${a.action}${('id' in a && `: ${a.id}=${a.value}`) || ''}`).join('\n')}\nThe default workflow is loaded and settings are configured. Start with the REPRODUCTION steps immediately.\n`
      : ''

  const systemInstruction = buildAgenticSystemPrompt(
    issueContext,
    subIssue?.focus,
    qaGuideSummary,
    preflightNote
  )

  const anthropicKey =
    process.env.ANTHROPIC_API_KEY_QA || process.env.ANTHROPIC_API_KEY
  const useHybrid = Boolean(anthropicKey)

  const genAI = new GoogleGenerativeAI(opts.apiKey)
  // @ts-expect-error TS6133 — kept for hybrid mode fallback
  const _geminiVisionModel = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview'
  })

  // Gemini-only fallback model (used when no ANTHROPIC_API_KEY_QA)
  const agenticModel = opts.model.includes('flash')
    ? opts.model
    : 'gemini-3-flash-preview'
  const _geminiOnlyModel = genAI.getGenerativeModel({
    model: agenticModel,
    systemInstruction
  })

  console.warn(
    `Starting ${useHybrid ? 'hybrid (Claude planner + Gemini vision)' : 'Gemini-only'} agentic loop` +
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
      const result = await _geminiOnlyModel.generateContent({
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
        // Show reasoning as subtitle overlay in the video
        await showSubtitle(page, parsed.reasoning, turn)
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
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage'
    ]
  })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } }
  })
  const page = await context.newPage()

  // Cursor overlay placeholder — injected after login when DOM is stable

  // Monkey-patch page.mouse to auto-update cursor overlay on ALL mouse ops
  const origMove = page.mouse.move.bind(page.mouse)
  const origClick = page.mouse.click.bind(page.mouse)
  const origDown = page.mouse.down.bind(page.mouse)
  const origUp = page.mouse.up.bind(page.mouse)
  const origDblclick = page.mouse.dblclick.bind(page.mouse)

  page.mouse.move = async (
    x: number,
    y: number,
    options?: Parameters<typeof origMove>[2]
  ) => {
    await origMove(x, y, options)
    await moveCursorOverlay(page, x, y)
  }
  page.mouse.click = async (
    x: number,
    y: number,
    options?: Parameters<typeof origClick>[2]
  ) => {
    await moveCursorOverlay(page, x, y)
    await clickCursorOverlay(page, true)
    await origClick(x, y, options)
    await clickCursorOverlay(page, false)
  }
  page.mouse.dblclick = async (
    x: number,
    y: number,
    options?: Parameters<typeof origDblclick>[2]
  ) => {
    await moveCursorOverlay(page, x, y)
    await clickCursorOverlay(page, true)
    await origDblclick(x, y, options)
    await clickCursorOverlay(page, false)
  }
  page.mouse.down = async (options?: Parameters<typeof origDown>[0]) => {
    await clickCursorOverlay(page, true)
    await origDown(options)
  }
  page.mouse.up = async (options?: Parameters<typeof origUp>[0]) => {
    await origUp(options)
    await clickCursorOverlay(page, false)
  }

  console.warn(`Opening ComfyUI at ${opts.serverUrl}`)
  await page.goto(opts.serverUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  await sleep(2000)
  await loginAsQaCi(page, opts.serverUrl)
  await sleep(1000)

  // Inject cursor overlay AFTER login (addInitScript gets destroyed by Vue mount)
  await page.addScriptTag({
    content: `(function(){
      var s=document.createElement('style');
      s.textContent='#qa-cursor{position:fixed;z-index:2147483647;pointer-events:none;width:20px;height:20px;margin:-2px 0 0 -2px;opacity:0.95;transition:transform 80ms ease-out;transform:scale(1)}#qa-cursor.clicking{transform:scale(1.4)}';
      document.head.appendChild(s);
      var c=document.createElement('div');c.id='qa-cursor';
      c.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="1.5"><path d="M4 2l14 10-6.5 1.5L15 21l-3.5-1.5L8 21l-1.5-7.5L2 16z"/></svg>';
      document.body.appendChild(c);
      window.__moveCursor=function(x,y){c.style.left=x+'px';c.style.top=y+'px'};
      window.__clickCursor=function(d){if(d)c.classList.add('clicking');else c.classList.remove('clicking')};
    })()`
  })

  // Inject keyboard HUD — shows pressed keys in bottom-right corner of video
  // Uses addScriptTag to avoid tsx __name compilation artifacts in page.evaluate
  await page.addScriptTag({
    content: `(function(){
      var hud=document.createElement('div');
      Object.assign(hud.style,{position:'fixed',bottom:'8px',right:'8px',zIndex:'2147483647',padding:'3px 8px',borderRadius:'4px',background:'rgba(0,0,0,0.7)',border:'1px solid rgba(120,200,255,0.4)',color:'rgba(120,200,255,0.9)',fontSize:'11px',fontFamily:'monospace',fontWeight:'500',pointerEvents:'none',display:'none',whiteSpace:'nowrap'});
      document.body.appendChild(hud);
      var held=new Set();
      function update(){if(held.size===0){hud.style.display='none'}else{hud.style.display='block';hud.textContent=String.fromCharCode(9000)+' '+Array.from(held).map(function(k){return k===' '?'Space':k.length===1?k.toUpperCase():k}).join('+')}}
      document.addEventListener('keydown',function(e){held.add(e.key);update()},true);
      document.addEventListener('keyup',function(e){held.delete(e.key);update()},true);
      window.addEventListener('blur',function(){held.clear();update()});
    })()`
  })

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
        // ═══ Phase 1: RESEARCH — Claude writes E2E test to reproduce ═══
        console.warn('Phase 1: Research — Claude writes E2E test')
        const anthropicKey =
          process.env.ANTHROPIC_API_KEY_QA || process.env.ANTHROPIC_API_KEY
        const { runResearchPhase } = await import('./qa-agent.js')
        const issueCtx = opts.diffFile
          ? readFileSync(opts.diffFile, 'utf-8').slice(0, 6000)
          : 'No issue context provided'
        let qaGuideText = ''
        if (opts.qaGuideFile) {
          try {
            qaGuideText = readFileSync(opts.qaGuideFile, 'utf-8')
          } catch {
            // QA guide not available
          }
        }
        const research = await runResearchPhase({
          page,
          issueContext: issueCtx,
          qaGuide: qaGuideText,
          outputDir: opts.outputDir,
          serverUrl: opts.serverUrl,
          anthropicApiKey: anthropicKey
        })
        console.warn(
          `Research complete: ${research.verdict} — ${research.summary.slice(0, 100)}`
        )
        console.warn(`Evidence: ${research.evidence.slice(0, 200)}`)

        // ═══ Phase 2: Run passing test with video recording ═══
        if (research.verdict === 'REPRODUCED' && research.testCode) {
          console.warn('Phase 2: Recording test execution with video')
          const projectRoot = process.cwd()
          const browserTestFile = `${projectRoot}/browser_tests/tests/qa-reproduce.spec.ts`
          const testResultsDir = `${opts.outputDir}/test-results`
          // Inject cursor overlay into the test — add page.addInitScript in beforeEach
          const cursorScript = `await comfyPage.page.addInitScript(() => {
  var c=document.createElement('div');c.id='qa-cursor';
  c.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="1.5"><path d="M4 2l14 10-6.5 1.5L15 21l-3.5-1.5L8 21l-1.5-7.5L2 16z"/></svg>';
  Object.assign(c.style,{position:'fixed',zIndex:'2147483647',pointerEvents:'none',width:'20px',height:'20px',margin:'-2px 0 0 -2px',opacity:'0.95'});
  if(document.body)document.body.appendChild(c);
  else document.addEventListener('DOMContentLoaded',function(){document.body.appendChild(c)});
  document.addEventListener('mousemove',function(e){c.style.left=e.clientX+'px';c.style.top=e.clientY+'px'});
});`
          // Insert cursor injection after the first line of the test body (after async ({ comfyPage }) => {)
          let testCode = research.testCode
          const testBodyMatch = testCode.match(
            /async\s*\(\{\s*comfyPage\s*\}\)\s*=>\s*\{/
          )
          if (testBodyMatch && testBodyMatch.index !== undefined) {
            const insertPos = testBodyMatch.index + testBodyMatch[0].length
            testCode =
              testCode.slice(0, insertPos) +
              '\n    ' +
              cursorScript +
              '\n' +
              testCode.slice(insertPos)
          }
          // Inject 800ms pauses between actions for human-readable video
          // Uses comfyPage.page since test code uses comfyPageFixture
          testCode = testCode.replace(
            /(\n\s*)(await\s+(?:comfyPage|topbar|firstNode|page|canvas|expect))/g,
            '$1await comfyPage.page.waitForTimeout(800);\n$1$2'
          )
          writeFileSync(browserTestFile, testCode)
          try {
            const output = execSync(
              `cd "${projectRoot}" && npx playwright test browser_tests/tests/qa-reproduce.spec.ts --reporter=list --timeout=30000 --retries=0 --workers=1 --output="${testResultsDir}" 2>&1`,
              {
                timeout: 90000,
                encoding: 'utf-8',
                env: {
                  ...process.env,
                  COMFYUI_BASE_URL: opts.serverUrl,
                  PLAYWRIGHT_LOCAL: '1' // Enables video=on + trace=on in playwright.config.ts
                }
              }
            )
            console.warn(`Phase 2: Test passed\n${output.slice(-300)}`)
          } catch (e) {
            const err = e as { stdout?: string }
            console.warn(
              `Phase 2: Test failed\n${(err.stdout || '').slice(-300)}`
            )
          }
          // Copy recorded video to outputDir so deploy script finds it
          try {
            const videos = execSync(
              `find "${testResultsDir}" -name '*.webm' -type f 2>/dev/null`,
              { encoding: 'utf-8' }
            )
              .trim()
              .split('\n')
              .filter(Boolean)
            if (videos.length > 0) {
              execSync(`cp "${videos[0]}" "${opts.outputDir}/qa-session.webm"`)
              console.warn(`Phase 2: Video → ${opts.outputDir}/qa-session.webm`)
            }
          } catch {
            console.warn('Phase 2: No test video found')
          }
          // Cleanup
          try {
            execSync(`rm -f "${browserTestFile}"`)
          } catch {
            /* ignore */
          }
        } else {
          console.warn(`Skipping Phase 2: verdict=${research.verdict}`)
        }
        await sleep(2000)
      } finally {
        await context.close()
        await browser.close()
      }

      knownNames.add(videoName)
      // If Phase 2 already copied a test video as qa-session.webm, don't overwrite it
      // with the idle research browser video
      const videoPath = `${opts.outputDir}/${videoName}`
      if (statSync(videoPath, { throwIfNoEntry: false })) {
        console.warn(
          'Phase 2 test video exists — skipping research video rename'
        )
      } else {
        renameLatestWebm(opts.outputDir, videoName, knownNames)
      }

      // Post-process: add TTS narration audio to the video
      if (narrationSegments.length > 0) {
        const videoPath = `${opts.outputDir}/${videoName}`
        if (statSync(videoPath, { throwIfNoEntry: false })) {
          console.warn(
            `Generating TTS narration for ${narrationSegments.length} segments...`
          )
          const audioPath = await generateNarrationAudio(
            narrationSegments,
            opts.outputDir,
            opts.apiKey
          )
          if (audioPath) {
            mergeAudioIntoVideo(
              videoPath,
              audioPath,
              `${opts.outputDir}/${videoName.replace('.webm', '-narrated.webm')}`
            )
          }
        }
      }
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
