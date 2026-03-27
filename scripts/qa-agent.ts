#!/usr/bin/env tsx
/**
 * Hybrid QA Agent — Claude Sonnet 4.6 brain + Gemini 3.1 Pro eyes
 *
 * Claude plans and reasons. Gemini watches the video buffer and describes
 * what it sees. The agent uses 4 tools:
 *   - observe(seconds, focus) — Gemini reviews last N seconds of video
 *   - inspect(selector) — search accessibility tree for element state
 *   - perform(action, params) — execute Playwright action
 *   - done(verdict, summary) — finish with result
 */

import type { Page } from '@playwright/test'
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
// eslint-disable-next-line import-x/no-unresolved -- zod/v4 is re-exported by claude-agent-sdk
import { z } from 'zod/v4'
import { execSync } from 'child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'fs'

// ── Types ──

interface AgentOptions {
  page: Page
  issueContext: string
  qaGuide: string
  outputDir: string
  geminiApiKey: string
  anthropicApiKey: string
  maxTurns?: number
  timeBudgetMs?: number
}

interface ScreenshotFrame {
  timestampMs: number
  base64: string
}

// ── Video buffer ──

const FRAME_INTERVAL_MS = 2000
const MAX_BUFFER_FRAMES = 30 // 60 seconds at 2fps

class VideoBuffer {
  private frames: ScreenshotFrame[] = []
  private startMs = Date.now()
  private intervalId: ReturnType<typeof setInterval> | null = null
  private page: Page

  constructor(page: Page) {
    this.page = page
  }

  start() {
    this.startMs = Date.now()
    this.intervalId = setInterval(async () => {
      try {
        const buf = await this.page.screenshot({
          type: 'jpeg',
          quality: 60
        })
        this.frames.push({
          timestampMs: Date.now() - this.startMs,
          base64: buf.toString('base64')
        })
        if (this.frames.length > MAX_BUFFER_FRAMES) {
          this.frames.shift()
        }
      } catch {
        // page may be navigating
      }
    }, FRAME_INTERVAL_MS)
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId)
  }

  getLastFrames(seconds: number): ScreenshotFrame[] {
    const cutoffMs = Date.now() - this.startMs - seconds * 1000
    return this.frames.filter((f) => f.timestampMs >= cutoffMs)
  }

  async buildVideoClip(
    seconds: number,
    outputDir: string
  ): Promise<Buffer | null> {
    const frames = this.getLastFrames(seconds)
    if (frames.length < 2) return null

    const clipDir = `${outputDir}/.clip-frames`
    mkdirSync(clipDir, { recursive: true })

    // Write frames as numbered JPEGs
    for (let i = 0; i < frames.length; i++) {
      writeFileSync(
        `${clipDir}/frame-${String(i).padStart(4, '0')}.jpg`,
        Buffer.from(frames[i].base64, 'base64')
      )
    }

    // Compose into video with ffmpeg
    const clipPath = `${outputDir}/.observe-clip.mp4`
    try {
      const fps = Math.max(1, Math.round(frames.length / seconds))
      execSync(
        `ffmpeg -y -framerate ${fps} -i "${clipDir}/frame-%04d.jpg" ` +
          `-c:v libx264 -preset ultrafast -pix_fmt yuv420p "${clipPath}" 2>/dev/null`,
        { timeout: 10000 }
      )
      return readFileSync(clipPath)
    } catch {
      return null
    }
  }
}

// ── Gemini Vision ──

async function geminiObserve(
  videoBuffer: VideoBuffer,
  seconds: number,
  focus: string,
  outputDir: string,
  geminiApiKey: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(geminiApiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-preview-05-20'
  })

  // Try video clip first, fall back to last frame
  const clip = await videoBuffer.buildVideoClip(seconds, outputDir)

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [
    {
      text: `You are observing a ComfyUI frontend session. Focus on: ${focus}\n\nDescribe what happened in the last ${seconds} seconds. Be specific about UI state, actions taken, and results.`
    }
  ]

  if (clip) {
    parts.push({
      inlineData: { mimeType: 'video/mp4', data: clip.toString('base64') }
    })
  } else {
    // Fall back to last frame
    const frames = videoBuffer.getLastFrames(seconds)
    if (frames.length > 0) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: frames[frames.length - 1].base64
        }
      })
    }
  }

  const result = await model.generateContent(parts)
  return result.response.text().trim()
}

// ── Accessibility tree helpers ──

interface A11yNode {
  role: string
  name: string
  value?: string
  checked?: boolean
  disabled?: boolean
  children?: A11yNode[]
}

function searchA11y(node: A11yNode | null, selector: string): A11yNode | null {
  if (!node) return null
  const sel = selector.toLowerCase()

  // Match by name or role
  if (
    node.name?.toLowerCase().includes(sel) ||
    node.role?.toLowerCase().includes(sel)
  ) {
    return node
  }

  // Recurse into children
  if (node.children) {
    for (const child of node.children) {
      const found = searchA11y(child, selector)
      if (found) return found
    }
  }
  return null
}

function flattenA11y(node: A11yNode | null, depth = 0): string {
  if (!node || depth > 3) return ''
  const parts: string[] = []
  const indent = '  '.repeat(depth)
  const attrs: string[] = []
  if (node.value !== undefined) attrs.push(`value="${node.value}"`)
  if (node.checked !== undefined) attrs.push(`checked=${node.checked}`)
  if (node.disabled) attrs.push('disabled')
  const attrStr = attrs.length ? ` [${attrs.join(', ')}]` : ''
  if (node.name || attrs.length) {
    parts.push(`${indent}${node.role}: ${node.name || '(unnamed)'}${attrStr}`)
  }
  if (node.children) {
    for (const child of node.children) {
      parts.push(flattenA11y(child, depth + 1))
    }
  }
  return parts.filter(Boolean).join('\n')
}

// ── Subtitle overlay ──

async function showSubtitle(page: Page, text: string, turn: number) {
  const encoded = encodeURIComponent(
    text.slice(0, 120).replace(/'/g, "\\'").replace(/\n/g, ' ')
  )
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

// ── Main agent ──

export async function runHybridAgent(opts: AgentOptions): Promise<{
  verdict: string
  summary: string
}> {
  const {
    page,
    issueContext,
    qaGuide,
    outputDir,
    geminiApiKey,
    anthropicApiKey
  } = opts
  const maxTurns = opts.maxTurns ?? 30
  const timeBudgetMs = opts.timeBudgetMs ?? 120_000

  // Start video buffer
  const videoBuffer = new VideoBuffer(page)
  videoBuffer.start()

  let lastA11ySnapshot: A11yNode | null = null
  let agentDone = false
  let finalVerdict = 'INCONCLUSIVE'
  let finalSummary = 'Agent did not complete'
  let turnCount = 0
  const startTime = Date.now()

  // Import executeAction from qa-record.ts (shared Playwright helpers)
  // For now, inline the action execution
  const { executeAction } = await import('./qa-record.js')

  // Define tools
  const observeTool = tool(
    'observe',
    'Watch the last N seconds of screen recording through Gemini vision. Use this to verify visual state, check if actions had visible effect, or inspect visual bugs. Pass a focused question so Gemini knows what to look for.',
    {
      seconds: z
        .number()
        .min(3)
        .max(60)
        .default(10)
        .describe('How many seconds to look back'),
      focus: z
        .string()
        .describe(
          'What to look for — be specific, e.g. "Did the Nodes 2.0 toggle switch to ON?"'
        )
    },
    async (args) => {
      const description = await geminiObserve(
        videoBuffer,
        args.seconds,
        args.focus,
        outputDir,
        geminiApiKey
      )
      return { content: [{ type: 'text' as const, text: description }] }
    }
  )

  const inspectTool = tool(
    'inspect',
    'Search the accessibility tree for a specific UI element. Returns its role, name, value, checked state. Fast and precise — use this to verify element state without vision.',
    {
      selector: z
        .string()
        .describe(
          'Element name or role to search for, e.g. "Nodes 2.0", "KSampler seed", "Run button"'
        )
    },
    async (args) => {
      try {
        const snapshot =
          (await page.accessibility.snapshot()) as A11yNode | null
        lastA11ySnapshot = snapshot
        const found = searchA11y(snapshot, args.selector)
        if (found) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  role: found.role,
                  name: found.name,
                  value: found.value,
                  checked: found.checked,
                  disabled: found.disabled,
                  hasChildren: Boolean(found.children?.length)
                })
              }
            ]
          }
        }
        // Return nearby elements if exact match not found
        const tree = flattenA11y(snapshot, 0).slice(0, 2000)
        return {
          content: [
            {
              type: 'text' as const,
              text: `Element "${args.selector}" not found. Available elements:\n${tree}`
            }
          ]
        }
      } catch (e) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `inspect failed: ${e instanceof Error ? e.message : e}`
            }
          ]
        }
      }
    }
  )

  const performTool = tool(
    'perform',
    `Execute a Playwright action on the ComfyUI page. Available actions:
- click(text): click element by visible text
- clickCanvas(x, y): click at coordinates
- rightClickCanvas(x, y): right-click at coordinates
- doubleClick(x, y): double-click at coordinates
- dragCanvas(fromX, fromY, toX, toY): drag between points
- scrollCanvas(x, y, deltaY): scroll wheel (negative=zoom in)
- pressKey(key): press keyboard key (Escape, Enter, Delete, Control+c, etc.)
- fillDialog(text): fill input and press Enter
- openMenu(): open hamburger menu
- hoverMenuItem(label): hover menu item
- clickMenuItem(label): click submenu item
- setSetting(id, value): change a ComfyUI setting
- loadDefaultWorkflow(): load the 7-node default workflow
- openSettings(): open Settings dialog
- reload(): reload the page
- addNode(nodeName, x, y): add a node via search
- copyPaste(x, y): Ctrl+C then Ctrl+V at coords
- holdKeyAndDrag(key, fromX, fromY, toX, toY): hold key while dragging
- screenshot(name): take a named screenshot`,
    {
      action: z.string().describe('Action name'),
      params: z
        .record(z.unknown())
        .optional()
        .describe('Action parameters as key-value pairs')
    },
    async (args) => {
      turnCount++
      if (turnCount > maxTurns || Date.now() - startTime > timeBudgetMs) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Budget exceeded (${turnCount}/${maxTurns} turns, ${Math.round((Date.now() - startTime) / 1000)}s). Use done() now.`
            }
          ]
        }
      }

      // Build TestAction object from args
      const actionObj = { action: args.action, ...args.params } as Parameters<
        typeof executeAction
      >[1]

      try {
        const result = await executeAction(page, actionObj, outputDir)
        // Show subtitle
        await showSubtitle(
          page,
          `${args.action}: ${result.success ? 'OK' : result.error}`,
          turnCount
        )
        return {
          content: [
            {
              type: 'text' as const,
              text: result.success
                ? `Action "${args.action}" succeeded.`
                : `Action "${args.action}" FAILED: ${result.error}`
            }
          ]
        }
      } catch (e) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Action "${args.action}" threw: ${e instanceof Error ? e.message : e}`
            }
          ]
        }
      }
    }
  )

  const doneTool = tool(
    'done',
    'Signal that reproduction is complete. Call this when you have either confirmed the bug or determined it cannot be reproduced.',
    {
      verdict: z
        .enum(['REPRODUCED', 'NOT_REPRODUCIBLE', 'INCONCLUSIVE'])
        .describe('Final verdict'),
      summary: z
        .string()
        .describe(
          'One paragraph: what you did, what you observed, and why you reached this verdict'
        )
    },
    async (args) => {
      agentDone = true
      finalVerdict = args.verdict
      finalSummary = args.summary
      await showSubtitle(page, `DONE: ${args.verdict}`, turnCount)
      return {
        content: [
          {
            type: 'text' as const,
            text: `Agent finished: ${args.verdict}`
          }
        ]
      }
    }
  )

  // Create MCP server with our tools
  const server = createSdkMcpServer({
    name: 'qa-agent',
    version: '1.0.0',
    tools: [observeTool, inspectTool, performTool, doneTool]
  })

  // Build system prompt
  const systemPrompt = `You are a senior QA engineer reproducing a reported bug in ComfyUI, a node-based AI image generation tool.

## Your tools
- observe(seconds, focus) — Gemini AI watches the last N seconds of screen recording and answers your focused question. Use for visual verification.
- inspect(selector) — Search the accessibility tree for a specific element's state. Use for precise state checks (toggle on/off, value, disabled).
- perform(action, params) — Execute a Playwright action on the browser.
- done(verdict, summary) — Finish with your conclusion.

## Strategy
1. Start by understanding the issue, then plan your reproduction steps.
2. Use perform() to take actions. After each action, use inspect() to verify state or observe() for visual confirmation.
3. If a setting change doesn't seem to take effect, try reload() then verify again.
4. Focus on the specific bug — don't explore randomly.
5. Take screenshots at key moments for the video evidence.
6. When you've confirmed or ruled out the bug, call done().

## ComfyUI Layout (1280×720 viewport)
- Canvas with node graph centered at ~(640, 400)
- Hamburger menu top-left (C logo)
- Sidebar: Workflows, Node Library, Models
- Default workflow nodes: Load Checkpoint (~150,300), CLIP Text Encode (~450,250/450), Empty Latent (~450,600), KSampler (~750,350), VAE Decode (~1000,350), Save Image (~1200,350)

${qaGuide ? `## QA Guide\n${qaGuide}\n` : ''}
## Issue to Reproduce
${issueContext}`

  // Run the agent
  console.warn('Starting hybrid agent (Claude Sonnet 4.6 + Gemini vision)...')

  try {
    for await (const message of query({
      prompt:
        'Reproduce the reported bug. Start by reading the issue context in your system prompt, then use your tools to interact with the ComfyUI browser session.',
      options: {
        model: 'claude-sonnet-4-6-20250514',
        systemPrompt,
        apiKey: anthropicApiKey,
        maxTurns,
        mcpServers: { 'qa-agent': server },
        allowedTools: [
          'mcp__qa-agent__observe',
          'mcp__qa-agent__inspect',
          'mcp__qa-agent__perform',
          'mcp__qa-agent__done'
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
    console.warn(`Agent error: ${e instanceof Error ? e.message : e}`)
  }

  videoBuffer.stop()

  return { verdict: finalVerdict, summary: finalSummary }
}
