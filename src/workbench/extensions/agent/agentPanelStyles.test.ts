import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const panelCss = readFileSync(
  resolve('src/workbench/extensions/agent/agentPanel.css'),
  'utf8'
)

describe('agent panel styles', () => {
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
