#!/usr/bin/env tsx
/**
 * QA Reproduce Phase — Deterministic replay of research plan with narration
 *
 * Takes a reproduction plan from the research phase and replays it:
 * 1. Execute each action deterministically (no AI decisions)
 * 2. Capture a11y snapshot before/after each action
 * 3. Gemini describes what visually changed (narration for humans)
 * 4. Output: narration-log.json with full evidence chain
 */

import type { Page } from '@playwright/test'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { mkdirSync, writeFileSync } from 'fs'

import type { ActionResult } from './qa-record.js'

// ── Types ──

interface ReproductionStep {
  action: Record<string, unknown> & { action: string }
  expectedAssertion: string
}

interface NarrationEntry {
  step: number
  action: string
  params: Record<string, unknown>
  result: ActionResult
  a11yBefore: unknown
  a11yAfter: unknown
  assertionExpected: string
  assertionPassed: boolean
  assertionActual: string
  geminiNarration: string
  timestampMs: number
}

export interface NarrationLog {
  entries: NarrationEntry[]
  allAssertionsPassed: boolean
}

interface ReproduceOptions {
  page: Page
  plan: ReproductionStep[]
  geminiApiKey: string
  outputDir: string
}

// ── A11y helpers ──

interface A11yNode {
  role: string
  name: string
  value?: string
  checked?: boolean
  disabled?: boolean
  expanded?: boolean
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

function summarizeA11y(node: A11yNode | null): string {
  if (!node) return 'null'
  const parts = [`role=${node.role}`, `name="${node.name}"`]
  if (node.value !== undefined) parts.push(`value="${node.value}"`)
  if (node.checked !== undefined) parts.push(`checked=${node.checked}`)
  if (node.disabled) parts.push('disabled')
  if (node.expanded !== undefined) parts.push(`expanded=${node.expanded}`)
  return `{${parts.join(', ')}}`
}

// ── Subtitle overlay ──

async function showSubtitle(page: Page, text: string, step: number) {
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
        Object.assign(el.style,{position:'fixed',bottom:'32px',left:'50%',transform:'translateX(-50%)',zIndex:'2147483646',maxWidth:'90%',padding:'6px 14px',borderRadius:'6px',background:'rgba(0,0,0,0.8)',color:'rgba(255,255,255,0.95)',fontSize:'12px',fontFamily:'system-ui,sans-serif',fontWeight:'400',lineHeight:'1.4',pointerEvents:'none',textAlign:'center',whiteSpace:'normal'});
        document.body.appendChild(el);
      }
      el.textContent='['+${step}+'] '+decodeURIComponent('${encoded}');
    })()`
  })
}

// ── Gemini visual narration ──

async function geminiDescribe(
  page: Page,
  geminiApiKey: string,
  focus: string
): Promise<string> {
  try {
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 70 })
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

    const result = await model.generateContent([
      {
        text: `Describe in 1-2 sentences what you see on this ComfyUI screen. Focus on: ${focus}. Be factual — only describe what is visible.`
      },
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: screenshot.toString('base64')
        }
      }
    ])
    return result.response.text().trim()
  } catch (e) {
    return `(Gemini narration failed: ${e instanceof Error ? e.message.slice(0, 50) : e})`
  }
}

// ── Main reproduce function ──

export async function runReproducePhase(
  opts: ReproduceOptions
): Promise<NarrationLog> {
  const { page, plan, geminiApiKey, outputDir } = opts
  const { executeAction } = await import('./qa-record.js')

  const narrationDir = `${outputDir}/narration`
  mkdirSync(narrationDir, { recursive: true })

  const entries: NarrationEntry[] = []
  const startMs = Date.now()

  console.warn(`Reproduce phase: replaying ${plan.length} steps...`)

  for (let i = 0; i < plan.length; i++) {
    const step = plan[i]
    const actionObj = step.action
    const elapsed = Date.now() - startMs

    // Show subtitle
    await showSubtitle(page, `Step ${i + 1}: ${actionObj.action}`, i + 1)
    console.warn(`  [${i + 1}/${plan.length}] ${actionObj.action}`)

    // Capture a11y BEFORE
    const a11yBefore = await page.accessibility.snapshot().catch(() => null)

    // Execute action
    const result = await executeAction(
      page,
      actionObj as Parameters<typeof executeAction>[1],
      outputDir
    )
    await new Promise((r) => setTimeout(r, 500))

    // Capture a11y AFTER
    const a11yAfter = await page.accessibility.snapshot().catch(() => null)

    // Check assertion
    let assertionPassed = false
    let assertionActual = ''
    if (step.expectedAssertion) {
      // Parse the expected assertion — e.g. "Settings dialog: visible" or "tab count: 2"
      const parts = step.expectedAssertion.split(':').map((s) => s.trim())
      const selectorName = parts[0]
      const expectedState = parts.slice(1).join(':').trim()

      const found = searchA11y(a11yAfter as A11yNode | null, selectorName)
      assertionActual = found ? summarizeA11y(found) : 'NOT FOUND'

      if (expectedState === 'visible' || expectedState === 'exists') {
        assertionPassed = found !== null
      } else if (expectedState === 'hidden' || expectedState === 'gone') {
        assertionPassed = found === null
      } else {
        // Generic: check if the actual state contains the expected text
        assertionPassed = assertionActual
          .toLowerCase()
          .includes(expectedState.toLowerCase())
      }

      console.warn(
        `    Assertion: "${step.expectedAssertion}" → ${assertionPassed ? '✓ PASS' : '✗ FAIL'} (actual: ${assertionActual})`
      )
    }

    // Gemini narration (visual description for humans)
    const geminiNarration = await geminiDescribe(
      page,
      geminiApiKey,
      `What changed after ${actionObj.action}?`
    )

    entries.push({
      step: i + 1,
      action: actionObj.action,
      params: actionObj,
      result,
      a11yBefore,
      a11yAfter,
      assertionExpected: step.expectedAssertion,
      assertionPassed,
      assertionActual,
      geminiNarration,
      timestampMs: elapsed
    })
  }

  // Final screenshot
  await page.screenshot({ path: `${outputDir}/reproduce-final.png` })

  const log: NarrationLog = {
    entries,
    allAssertionsPassed: entries.every((e) => e.assertionPassed)
  }

  writeFileSync(
    `${narrationDir}/narration-log.json`,
    JSON.stringify(log, null, 2)
  )
  console.warn(
    `Reproduce phase complete: ${entries.filter((e) => e.assertionPassed).length}/${entries.length} assertions passed`
  )

  return log
}
