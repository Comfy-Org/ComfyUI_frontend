#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const agentsDir = join(process.cwd(), '.claude', 'agents')

const patches = {
  'playwright-test-planner.md': `

## ComfyUI Project Context

### Application Overview
ComfyUI is a **canvas-based node graph editor** for AI image generation. It is a complex SPA with:
- A **LiteGraph canvas** where users create workflows by connecting nodes
- A **Vue 3 sidebar** with node library, workflows panel, and settings
- A **topbar** with queue/run buttons and workspace controls
- A **search box** for finding and adding nodes (opens on double-click)
- WebSocket-based real-time communication with a Python backend

### Exploration Tips
- Start by loading a workflow: the app is most useful with nodes on the canvas
- Key UI areas to explore: canvas interactions, sidebar panels, topbar buttons, search box, context menus, settings dialog
- Double-click the canvas to open the node search box
- Right-click nodes/canvas for context menus
- The bottom panel shows job queue and execution logs

### Test Environment
- The seed test uses \`comfyPageFixture\` which provides a \`comfyPage\` object with extensive helpers
- Workflows (JSON files) are loaded via \`comfyPage.workflow.loadWorkflow('name')\`
- Available workflow assets are in \`browser_tests/assets/\`
- The backend MUST be running with \`--multi-user\` flag
- A Vite dev server runs on \`:5173\`

### When Creating Test Plans
- Reference specific workflow assets when a scenario needs a starting state
- Note that canvas interactions use pixel coordinates — these may vary across environments
- Distinguish between "canvas tests" (LiteGraph) and "UI tests" (Vue components)
- Include tags in your plans: \`@canvas\`, \`@widget\`, \`@sidebar\`, \`@smoke\`, \`@screenshot\`
- Reference \`browser_tests/fixtures/ComfyPage.ts\` for available test helpers`,

  'playwright-test-generator.md': `

## ComfyUI Project Context

### Required Import Pattern
Generated tests MUST use ComfyUI fixtures, not generic \`@playwright/test\`:

\`\`\`typescript
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
\`\`\`

### Fixture Object
Tests receive \`comfyPage\` (not \`page\`) as their fixture:

\`\`\`typescript
test('my test', async ({ comfyPage }) => {
  // Access raw page via comfyPage.page if needed
})
\`\`\`

### Key APIs
| Need | Use | Notes |
|------|-----|-------|
| Canvas element | \`comfyPage.canvas\` | Pre-configured Locator |
| Wait for render | \`comfyPage.nextFrame()\` | After canvas mutations |
| Load workflow | \`comfyPage.workflow.loadWorkflow('name')\` | Assets in \`browser_tests/assets/\` |
| Get node by type | \`comfyPage.nodeOps.getNodeRefsByType('KSampler')\` | Returns NodeReference[] |
| Search box | \`comfyPage.searchBox.fillAndSelectFirstNode('name')\` | Opens on canvas dblclick |
| Settings | \`comfyPage.settings.setSetting(key, value)\` | Clean up in afterEach |
| Keyboard | \`comfyPage.keyboard.press('Delete')\` | Focus canvas first |
| Context menu | \`comfyPage.contextMenu\` | Right-click interactions |

### Mandatory Test Structure
Every generated test must:
1. Be wrapped in \`test.describe('Name', { tag: ['@canvas'] }, () => { ... })\`
2. Include \`test.afterEach(async ({ comfyPage }) => { await comfyPage.canvasOps.resetView() })\`
3. Use descriptive test names (not "test" or "test1")

### Anti-Patterns — NEVER Use
- ❌ \`page.goto()\` — fixture handles navigation
- ❌ \`page.waitForTimeout()\` — use \`comfyPage.nextFrame()\` or retrying assertions
- ❌ \`import from '@playwright/test'\` — use \`from '../fixtures/ComfyPage'\`
- ❌ Bare \`page.\` references — use \`comfyPage.page.\` if you need raw page access

### Reference
Read the fixture code for full API surface:
- \`browser_tests/fixtures/ComfyPage.ts\` — main fixture
- \`browser_tests/fixtures/helpers/\` — helper classes
- \`browser_tests/fixtures/components/\` — page object components
- See also: \`.claude/skills/codegen-transform/SKILL.md\` for transform rules`,

  'playwright-test-healer.md': `

## ComfyUI Project Context

### Custom Fixtures
Tests in this project use \`comfyPage\` fixture, not bare \`page\`. When healing:
- Replace any \`page.\` references with \`comfyPage.page.\` if adding new code
- Use \`comfyPage.nextFrame()\` instead of adding \`waitForTimeout()\`
- Use fixture helpers (\`comfyPage.nodeOps\`, \`comfyPage.canvas\`, etc.) over raw locators

### Common Failure Causes in ComfyUI Tests

1. **Missing \`nextFrame()\`**: Canvas operations need \`await comfyPage.nextFrame()\` after mutations. This is the #1 cause of "works locally, fails in CI" issues.

2. **Canvas focus required**: Keyboard shortcuts won't work unless \`await comfyPage.canvas.click()\` is called first.

3. **Node position drift**: Pixel coordinates can shift between environments. When possible, replace with node references:
   \`\`\`typescript
   // Instead of: canvas.click({ position: { x: 423, y: 267 } })
   const node = (await comfyPage.nodeOps.getNodeRefsByType('KSampler'))[0]
   await node.click('title')
   \`\`\`

4. **Settings pollution**: Settings persist across tests on the backend. Always reset changed settings in \`afterEach\`.

5. **Drag animation timing**: Use \`{ steps: 10 }\` option for drag operations, not \`{ steps: 1 }\`.

### Healing Safety Rules
- ❌ NEVER add \`waitForTimeout()\` — always use retrying assertions or \`nextFrame()\`
- ❌ NEVER "fix" a test by weakening assertions (e.g., removing an assertion that fails)
- ❌ NEVER modify the application code — only modify test code
- ⚠️ If a test fails because expected UI elements are missing, the app may have a regression — mark as \`test.fixme()\` with explanation, don't "heal" the assertion away
- ⚠️ If a test fails only in CI but passes locally, likely missing \`nextFrame()\` — don't mask with timeouts

### Reference
- \`browser_tests/fixtures/ComfyPage.ts\` — full fixture API
- \`browser_tests/fixtures/helpers/\` — available helper classes
- \`.claude/skills/writing-playwright-tests/SKILL.md\` — testing conventions
- \`.claude/skills/codegen-transform/SKILL.md\` — transform rules`
}

const CONTEXT_HEADING = '## ComfyUI Project Context'

for (const [filename, patch] of Object.entries(patches)) {
  const filePath = join(agentsDir, filename)
  let content = readFileSync(filePath, 'utf-8')

  // Strip existing ComfyUI context section (heading to EOF)
  const idx = content.indexOf(CONTEXT_HEADING)
  if (idx !== -1) {
    // Trim trailing whitespace before the heading too
    content = content.substring(0, idx).trimEnd()
    console.log(`  ♻️  ${filename}: stripped existing ComfyUI context`)
  }

  content += patch
  writeFileSync(filePath, content, 'utf-8')
  console.log(`  ✅ ${filename}: patched`)
}
