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
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { mkdirSync, writeFileSync } from 'fs'
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

export interface ResearchResult {
  verdict: 'REPRODUCED' | 'NOT_REPRODUCIBLE' | 'INCONCLUSIVE'
  summary: string
  evidence: string
  testCode: string
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
  const maxTurns = opts.maxTurns ?? 40
  const timeBudgetMs = opts.timeBudgetMs ?? 300_000

  let agentDone = false
  let finalVerdict: ResearchResult['verdict'] = 'INCONCLUSIVE'
  let finalSummary = 'Agent did not complete'
  let finalEvidence = ''
  let finalTestCode = ''
  let turnCount = 0
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
    async (args) => {
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

  // ── Tool: writeTest ──
  const writeTestTool = tool(
    'writeTest',
    'Write a Playwright E2E test file that reproduces the bug. The test should assert the broken behavior exists.',
    {
      code: z
        .string()
        .describe('Complete Playwright test file content (.spec.ts)')
    },
    async (args) => {
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
  const runTestTool = tool(
    'runTest',
    'Run the Playwright test and get results. Returns stdout/stderr including assertion errors.',
    {},
    async () => {
      turnCount++
      let resultText: string
      try {
        const output = execSync(
          `cd "${process.cwd()}" && npx playwright test "${testPath}" --reporter=list --timeout=30000 2>&1`,
          {
            timeout: 60000,
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

      return { content: [{ type: 'text' as const, text: resultText }] }
    }
  )

  // ── Tool: done ──
  const doneTool = tool(
    'done',
    'Finish research with verdict and the final test code.',
    {
      verdict: z.enum(['REPRODUCED', 'NOT_REPRODUCIBLE', 'INCONCLUSIVE']),
      summary: z.string().describe('What you found and why'),
      evidence: z.string().describe('Test output that proves the verdict'),
      testCode: z
        .string()
        .describe(
          'Final Playwright test code. If REPRODUCED, this test asserts the bug exists and passes.'
        )
    },
    async (args) => {
      agentDone = true
      finalVerdict = args.verdict
      finalSummary = args.summary
      finalEvidence = args.evidence
      finalTestCode = args.testCode
      writeFileSync(testPath, args.testCode)
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
    tools: [inspectTool, writeTestTool, runTestTool, doneTool]
  })

  // ── System prompt ──
  const systemPrompt = `You are a senior QA engineer who writes Playwright E2E tests to reproduce reported bugs.

## Your tools
- inspect(selector?) — Read the accessibility tree to understand the current UI. Use to discover selectors, element names, and UI state.
- writeTest(code) — Write a Playwright test file (.spec.ts)
- runTest() — Execute the test and get results (pass/fail + errors)
- done(verdict, summary, evidence, testCode) — Finish with the final test

## Workflow
1. Read the issue description carefully
2. Use inspect() to understand the current UI state and discover element selectors
3. Write a Playwright test that:
   - Navigates to ${serverUrl}
   - Performs the exact reproduction steps from the issue
   - Asserts the BROKEN behavior (the bug) — so the test PASSES when the bug exists
4. Run the test with runTest()
5. If it fails: read the error, fix the test, run again (max 5 attempts)
6. Call done() with the final verdict and test code

## Test writing guidelines
- Use \`import { test, expect } from '@playwright/test'\`
- URL: \`${serverUrl}\`
- Wait for the app to load: \`await page.waitForSelector('.comfy-menu-button-wrapper', { timeout: 15000 })\`
- Skip tutorial: \`await page.evaluate(() => localStorage.setItem('Comfy.TutorialCompleted', 'true'))\`
- Dismiss template gallery: \`await page.keyboard.press('Escape')\`
- Menu: click \`.comfy-menu-button-wrapper\` → hover menu items → click submenu
- Use \`page.locator()\` with role/text selectors — never raw CSS when possible
- Use \`expect(locator).toBeVisible()\` / \`toBeHidden()\` / \`toHaveText()\` etc.
- If the bug IS present, the test should PASS. If the bug is fixed, the test would FAIL.
- Keep tests focused and minimal — test ONLY the reported bug

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
        'Write a Playwright E2E test that reproduces the reported bug. Use inspect() to discover selectors, writeTest() to write the test, runTest() to execute it. Iterate until it works or you determine the bug cannot be reproduced.',
      options: {
        model: 'claude-sonnet-4-6',
        systemPrompt,
        ...(anthropicApiKey ? { apiKey: anthropicApiKey } : {}),
        maxTurns,
        mcpServers: { 'qa-research': server },
        allowedTools: [
          'mcp__qa-research__inspect',
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
    console.warn(`Research error: ${e instanceof Error ? e.message : e}`)
  }

  const result: ResearchResult = {
    verdict: finalVerdict,
    summary: finalSummary,
    evidence: finalEvidence,
    testCode: finalTestCode,
    log: researchLog
  }

  writeFileSync(`${testDir}/research-log.json`, JSON.stringify(result, null, 2))
  console.warn(
    `Research complete: ${finalVerdict} (${researchLog.length} tool calls)`
  )

  return result
}
