import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const themeCss = readFileSync(
  resolve('src/workbench/extensions/agent/agentTheme.css'),
  'utf8'
)
const panelCss = readFileSync(
  resolve('src/workbench/extensions/agent/agentPanel.css'),
  'utf8'
)
const loadedAgentCss = `${themeCss}\n${panelCss}`

describe('agent panel styles', () => {
  it('defines every referenced agent animation in the always-loaded theme', () => {
    const animationNames = [
      ...loadedAgentCss.matchAll(
        /(?:animation:\s*|--animate-agent-[\w-]+:\s*)(agent-[\w-]+)/g
      )
    ].map((match) => match[1])

    for (const name of new Set(animationNames)) {
      expect(themeCss).toContain(`@keyframes ${name}`)
    }
  })

  it('keeps selectors scoped to the agent root or agent namespace', () => {
    const selectors = panelCss
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => /^[^\s@].*\{$/.test(line))

    for (const selector of selectors) {
      expect(
        selector.includes('#agent-panel-root') ||
          selector.startsWith(':where(.agent-scope') ||
          selector.startsWith('.agent-')
      ).toBe(true)
    }
  })
})
