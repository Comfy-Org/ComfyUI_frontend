#!/usr/bin/env tsx
/**
 * QA Research Phase — Claude Sonnet 4.6 investigates via a11y API
 *
 * Claude explores the UI using accessibility tree assertions as ground truth.
 * NO video, NO Gemini vision — only DOM state via page.accessibility.snapshot().
 *
 * Tools:
 *   - inspect(selector) — search a11y tree for element state (source of truth)
 *   - perform(action, params) — execute Playwright action + auto-log a11y before/after
 *   - done(verdict, summary, reproductionPlan) — finish with evidence-backed conclusion
 */

import type { Page } from '@playwright/test'
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { mkdirSync, writeFileSync } from 'fs'

// ── Types ──

interface ResearchOptions {
  page: Page
  issueContext: string
  qaGuide: string
  outputDir: string
  anthropicApiKey?: string
  maxTurns?: number
  timeBudgetMs?: number
}

export interface ResearchTurn {
  turn: number
  timestampMs: number
  toolName: string
  toolInput: unknown
  toolResult: string
  a11yBefore?: unknown
  a11yAfter?: unknown
}

export interface ReproductionStep {
  action: Record<string, unknown> & { action: string }
  expectedAssertion: string
}

export interface ResearchResult {
  verdict: 'REPRODUCED' | 'NOT_REPRODUCIBLE' | 'INCONCLUSIVE'
  summary: string
  evidence: string
  reproductionPlan: ReproductionStep[]
  log: ResearchTurn[]
}

// ── A11y helpers ──

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
  if (
    node.name?.toLowerCase().includes(sel) ||
    node.role?.toLowerCase().includes(sel)
  ) {
    return node
  }
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

// ── Main research function ──

export async function runResearchPhase(
  opts: ResearchOptions
): Promise<ResearchResult> {
  const { page, issueContext, qaGuide, outputDir, anthropicApiKey } = opts
  const maxTurns = opts.maxTurns ?? 40
  const timeBudgetMs = opts.timeBudgetMs ?? 180_000

  let agentDone = false
  let finalVerdict: ResearchResult['verdict'] = 'INCONCLUSIVE'
  let finalSummary = 'Agent did not complete'
  let finalEvidence = ''
  let finalPlan: ReproductionStep[] = []
  let turnCount = 0
  const startTime = Date.now()
  const researchLog: ResearchTurn[] = []

  const { executeAction } = await import('./qa-record.js')

  // ── Tool: inspect ──
  const inspectTool = tool(
    'inspect',
    'Search the accessibility tree for a UI element. Returns role, name, value, checked state. This is your SOURCE OF TRUTH — use it after every action to verify state.',
    {
      selector: z
        .string()
        .describe(
          'Element name or role to search for, e.g. "Settings", "Language", "KSampler seed", "tab"'
        )
    },
    async (args) => {
      const snapshot = (await page.accessibility.snapshot()) as A11yNode | null
      const found = searchA11y(snapshot, args.selector)

      const resultText = found
        ? JSON.stringify({
            role: found.role,
            name: found.name,
            value: found.value,
            checked: found.checked,
            disabled: found.disabled,
            hasChildren: Boolean(found.children?.length)
          })
        : `Element "${args.selector}" not found. Available:\n${flattenA11y(snapshot, 0).slice(0, 2000)}`

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

  // ── Tool: perform ──
  const performTool = tool(
    'perform',
    `Execute a Playwright action. Auto-captures a11y state before and after.
Available: click(text), clickCanvas(x,y), rightClickCanvas(x,y), doubleClick(x,y),
dragCanvas(fromX,fromY,toX,toY), scrollCanvas(x,y,deltaY), pressKey(key),
fillDialog(text), openMenu(), hoverMenuItem(label), clickMenuItem(label),
setSetting(id,value), loadDefaultWorkflow(), openSettings(), reload(),
addNode(nodeName,x,y), copyPaste(x,y), holdKeyAndDrag(key,fromX,fromY,toX,toY),
screenshot(name)`,
    {
      action: z.string().describe('Action name'),
      params: z.record(z.unknown()).optional().describe('Action parameters')
    },
    async (args) => {
      turnCount++
      if (turnCount > maxTurns || Date.now() - startTime > timeBudgetMs) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Budget exceeded (${turnCount}/${maxTurns} turns, ${Math.round((Date.now() - startTime) / 1000)}s). Call done() NOW with your current findings.`
            }
          ]
        }
      }

      // Capture a11y BEFORE
      const a11yBefore = await page.accessibility.snapshot().catch(() => null)

      const actionObj = {
        action: args.action,
        ...args.params
      } as Parameters<typeof executeAction>[1]

      let resultText: string
      try {
        const result = await executeAction(page, actionObj, outputDir)
        resultText = result.success
          ? `Action "${args.action}" succeeded.`
          : `Action "${args.action}" FAILED: ${result.error}`
      } catch (e) {
        resultText = `Action "${args.action}" threw: ${e instanceof Error ? e.message : e}`
      }

      // Capture a11y AFTER
      const a11yAfter = await page.accessibility.snapshot().catch(() => null)

      researchLog.push({
        turn: turnCount,
        timestampMs: Date.now() - startTime,
        toolName: 'perform',
        toolInput: args,
        toolResult: resultText,
        a11yBefore,
        a11yAfter
      })

      return {
        content: [
          {
            type: 'text' as const,
            text: `${resultText}\n\n(a11y state captured before/after — use inspect() to verify specific elements)`
          }
        ]
      }
    }
  )

  // ── Tool: done ──
  const doneTool = tool(
    'done',
    'Finish the research with an evidence-backed verdict and a reproduction plan.',
    {
      verdict: z
        .enum(['REPRODUCED', 'NOT_REPRODUCIBLE', 'INCONCLUSIVE'])
        .describe('Final verdict — MUST be supported by inspect() evidence'),
      summary: z
        .string()
        .describe(
          'What you did, what inspect() showed, and why you reached this verdict'
        ),
      evidence: z
        .string()
        .describe(
          'Cite specific inspect() results: "inspect(X) returned {Y} proving Z"'
        ),
      reproductionPlan: z
        .array(
          z.object({
            action: z
              .record(z.unknown())
              .describe('Action object with "action" field + params'),
            expectedAssertion: z
              .string()
              .describe(
                'Expected a11y state after this action, e.g. "Settings dialog: visible" or "tab count: 2"'
              )
          })
        )
        .describe(
          'Minimal ordered steps to reproduce the bug. Empty if NOT_REPRODUCIBLE/INCONCLUSIVE.'
        )
    },
    async (args) => {
      agentDone = true
      finalVerdict = args.verdict
      finalSummary = args.summary
      finalEvidence = args.evidence
      finalPlan = args.reproductionPlan.map((s) => ({
        action: s.action as ReproductionStep['action'],
        expectedAssertion: s.expectedAssertion
      }))

      return {
        content: [
          {
            type: 'text' as const,
            text: `Research complete: ${args.verdict}`
          }
        ]
      }
    }
  )

  // ── MCP Server ──
  const server = createSdkMcpServer({
    name: 'qa-research',
    version: '1.0.0',
    tools: [inspectTool, performTool, doneTool]
  })

  // ── System prompt ──
  const systemPrompt = `You are a senior QA engineer investigating a reported bug in ComfyUI.

## Your tools (3 only — no vision)
- inspect(selector) — Search accessibility tree for element state. THIS IS YOUR SOURCE OF TRUTH.
- perform(action, params) — Execute a Playwright action. Auto-captures a11y before/after.
- done(verdict, summary, evidence, reproductionPlan) — Finish with evidence-backed conclusion.

## Rules (CRITICAL)
1. After EVERY perform() call, use inspect() to verify the DOM state changed as expected.
2. Your verdict MUST cite specific inspect() results as evidence.
3. NEVER claim REPRODUCED unless inspect() confirms the broken state.
4. NEVER claim NOT_REPRODUCIBLE unless you actually performed all the reproduction steps and inspect() shows normal behavior.
5. If you run out of time before completing steps, verdict is INCONCLUSIVE.
6. Complete ALL reproduction steps. Setup (loading workflow, opening settings) is NOT reproduction — the actual bug trigger is.

## Output
When you call done(), include:
- verdict: based on what inspect() showed, not what you expected
- evidence: "inspect('Settings dialog') returned {role: dialog, name: Settings} — dialog still visible after Escape, proving the bug does NOT exist on this build"
- reproductionPlan: minimal steps that demonstrate the bug (for the reproduce phase to replay as a clean video)

## Strategy
1. Read the issue carefully. Plan the FULL reproduction sequence.
2. Set up prerequisites (load workflow, open settings, etc.)
3. Perform the actual bug trigger (the specific interaction described in the issue)
4. Verify the result with inspect() — is the state broken or correct?
5. If the bug is triggered by a setting/mode, do control/test comparison:
   - CONTROL: perform action with setting OFF → inspect() → should work
   - TEST: perform action with setting ON → inspect() → should break

## ComfyUI Layout (1280×720)
- Canvas centered at ~(640, 400)
- Hamburger menu (top-left C logo) → File, Edit, View, Theme, Help
- Sidebar: Workflows, Node Library, Models
- Default workflow: Load Checkpoint (~150,300), CLIP Text Encode (~450,250/450), KSampler (~750,350)

${qaGuide ? `## QA Guide\n${qaGuide}\n` : ''}
## Issue to Reproduce
${issueContext}`

  // ── Run the agent ──
  console.warn('Starting research phase (Claude + a11y)...')

  try {
    for await (const message of query({
      prompt:
        'Investigate the reported bug. Use inspect() after every action to verify state. When done, call done() with evidence from inspect() results and a reproduction plan.',
      options: {
        model: 'claude-sonnet-4-6',
        systemPrompt,
        ...(anthropicApiKey ? { apiKey: anthropicApiKey } : {}),
        maxTurns,
        mcpServers: { 'qa-research': server },
        allowedTools: [
          'mcp__qa-research__inspect',
          'mcp__qa-research__perform',
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
    console.warn(`Research error: ${e instanceof Error ? e.message : e}`)
  }

  // Save research log
  const result: ResearchResult = {
    verdict: finalVerdict,
    summary: finalSummary,
    evidence: finalEvidence,
    reproductionPlan: finalPlan,
    log: researchLog
  }

  mkdirSync(`${outputDir}/research`, { recursive: true })
  writeFileSync(
    `${outputDir}/research/research-log.json`,
    JSON.stringify(result, null, 2)
  )
  console.warn(
    `Research complete: ${finalVerdict} (${researchLog.length} tool calls, ${finalPlan.length} reproduction steps)`
  )

  return result
}
