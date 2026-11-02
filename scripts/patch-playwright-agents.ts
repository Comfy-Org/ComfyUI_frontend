import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const agentsDir = join(process.cwd(), '.claude', 'agents')

const CONTEXT_HEADING = '## ComfyUI Project Context'

const REMOVED_CLAUDE_TOOLS = new Set(['LS', 'MultiEdit'])

type Replacement = readonly [from: string, to: string]

interface AgentPatch {
  replacements: Replacement[]
  context: string
}

const sharedContext = `
- Read \`docs/guidance/testing-principles.md\` and \`docs/guidance/playwright.md\`
  before writing or changing a spec. The second holds every Playwright
  convention for this repository: fixtures, selectors, Vue Nodes, canvas timing,
  tags, settings isolation, typed mocks, screenshots, and flake patterns.
- Tests use \`comfyPageFixture\` and \`comfyExpect\` from \`@e2e/fixtures/ComfyPage\`
  and receive \`comfyPage\`, not \`page\`.
- Read the fixture code in \`browser_tests/fixtures/\` for available helpers;
  workflow assets are in \`browser_tests/assets/\`.
- \`pnpm comfy-test tags\` lists the area tags; \`docs/guidance/playwright.md\` lists
  the project-routing tags.
- Backend and dev server setup is in \`browser_tests/README.md\`.`

const patches: Record<string, AgentPatch> = {
  'playwright-test-planner.md': {
    replacements: [
      [
        'description: Use this agent when you need to create comprehensive test plan for a web application or website',
        'description: Use this agent to plan browser tests for supported user journeys and observable behavioral contracts'
      ],
      [
        `You are an expert web test planner with extensive experience in quality assurance, user experience testing, and test
scenario design. Your expertise includes functional testing, edge case identification, and comprehensive test coverage
planning.`,
        `You plan browser tests around supported user journeys. Read
\`docs/guidance/testing-principles.md\` before selecting scenarios. Start with
observable expectations and check existing coverage before adding cases.
Compose relevant dimensions instead of enumerating combinations, and plan E2E
scenarios only for behavior that no lower test level can observe.`
      ],
      [
        `3. **Design Comprehensive Scenarios**

   Create detailed test scenarios that cover:
   - Happy path scenarios (normal user behavior)
   - Edge cases and boundary conditions
   - Error handling and validation`,
        `3. **Select Behavioral Scenarios**

   Select the smallest set of scenarios that protects the identified expectations.
   - Ground each scenario in a requirement, supported workflow, public contract, or reproduced bug
   - Include boundary and failure cases when their production path is reachable and their outcome matters
   - Use implementation details to find the entry point, not to invent cases for every branch`
      ],
      [
        `   - Clear, descriptive title
   - Detailed step-by-step instructions`,
        `   - Clear, descriptive title
   - The behavioral expectation, its source, and the gap in existing coverage
   - Detailed step-by-step instructions`
      ],
      [
        '- Include negative testing scenarios',
        '- Justify negative scenarios by their reachable trigger and observable consequence'
      ]
    ],
    context: `
ComfyUI is a canvas-based node graph editor: a LiteGraph canvas, Vue sidebars
and dialogs, a topbar with run controls, a node search box opened by
double-clicking the canvas, and a WebSocket connection to a Python backend.
Load a workflow before exploring; the app does little on an empty canvas.
${sharedContext}
- Name the workflow asset each scenario starts from, and the tags it needs.`
  },

  'playwright-test-generator.md': {
    replacements: [
      [
        '- Obtain the test plan with all the steps and verification specification',
        `- Obtain the test plan with all the steps and verification specification
- Read \`docs/guidance/testing-principles.md\`. Confirm the scenario protects an identified user expectation through a reachable workflow and adds a guarantee missing from existing tests. Omit unsupported hypothetical cases and report why.
- Assert the observable outcome through supported interactions. Internal helpers, call sequences, and component structure are not expected results.`
      ],
      [
        `  - Includes a comment with the step text before each step execution. Do not duplicate comments if step requires
    multiple actions.`,
        `  - Wraps each plan step in \`test.step('<step text>', ...)\`. A step that needs multiple actions is still one
    \`test.step\`. Do not write comments.`
      ],
      [
        `   // spec: specs/plan.md
   // seed: tests/seed.spec.ts

   test.describe('Adding New Todos', () => {
     test('Add Valid Todo', async { page } => {
       // 1. Click in the "What needs to be done?" input field
       await page.click(...);
`,
        `   test.describe('Adding New Todos', { tag: ['@ui'] }, () => {
     test('Add Valid Todo', async ({ comfyPage }) => {
       await test.step('Click in the "What needs to be done?" input field', async () => {
         await comfyPage.page.getByPlaceholder('What needs to be done?').click();
       });
`
      ]
    ],
    context: `${sharedContext}
- Wrap every test in \`test.describe('Name', { tag: [...] }, () => { ... })\`
  with the tags the plan selected, and give it a descriptive title.
- Never use \`page.goto()\`, \`waitForTimeout()\`, or imports from
  \`@playwright/test\`.`
  },

  'playwright-test-healer.md': {
    replacements: [
      [
        'broken Playwright tests using a methodical approach.',
        `broken Playwright tests using a methodical approach. Every fix must satisfy
\`docs/guidance/testing-principles.md\`, especially its "Changing existing tests" section.`
      ],
      [
        `- You will continue this process until the test runs successfully without any failures or errors.
- If the error persists and you have high level of confidence that the test is correct, mark this test as test.fixme()
  so that it is skipped during the execution. Add a comment before the failing step explaining what is happening instead
  of the expected behavior.
- Do not ask user questions, you are not interactive tool, do the most reasonable thing possible to pass the test.`,
        `- Preserve the behavioral expectation through refactors. If an assertion pins internal structure, rewrite it around the supported outcome. Remove a test only after establishing that it protects no required behavior, following the shared principles.
- If the error persists and you have high confidence the test is correct, do not auto-skip. Summarize the root-cause evidence and escalate it as a likely app regression.
- Use \`test.fixme()\` only when a known issue is filed. Put the issue link in the \`test.fixme()\` description argument. Do not add a comment.
- Resolve test defects within the supported behavioral contract. Report an application regression or an unclear expectation instead of changing expectations merely to pass.
- Never modify application code; only test code.`
      ]
    ],
    context: `${sharedContext}
- Match the failure against the common flake patterns and gotchas in
  \`docs/guidance/playwright.md\` before changing a wait or an assertion.
- Before removing a wait, assertion, or guard, read the commit that added it.`
  }
}

function applyReplacement(
  content: string,
  [from, to]: Replacement,
  filename: string
): string {
  if (content.includes(to)) return content
  if (!content.includes(from)) {
    throw new Error(
      `${filename}: text not found. Run scripts/update-playwright-agents.sh to regenerate the file, or update the replacement starting "${from.slice(0, 60)}"`
    )
  }
  return content.replace(from, to)
}

function removeClaudeTools(content: string): string {
  return content.replace(/^tools: (.*)$/m, (_, tools: string) => {
    const kept = tools
      .split(', ')
      .filter((tool) => !REMOVED_CLAUDE_TOOLS.has(tool))
    return `tools: ${kept.join(', ')}`
  })
}

const missingFiles: string[] = []

for (const [filename, patch] of Object.entries(patches)) {
  const filePath = join(agentsDir, filename)
  if (!existsSync(filePath)) {
    missingFiles.push(filename)
    console.error(`  ❌ ${filename}: not found (run init-agents first)`)
    continue
  }
  let content = readFileSync(filePath, 'utf-8')

  const idx = content.indexOf(CONTEXT_HEADING)
  if (idx !== -1) {
    content = content.substring(0, idx)
  }
  content = content.trimEnd()

  content = removeClaudeTools(content)
  content = patch.replacements.reduce(
    (current, replacement) => applyReplacement(current, replacement, filename),
    content
  )

  content += `\n\n${CONTEXT_HEADING}\n${patch.context}\n`
  writeFileSync(filePath, content, 'utf-8')
  console.log(`  ✅ ${filename}: patched`)
}

if (missingFiles.length > 0) {
  throw new Error(
    `Missing expected Playwright agent files: ${missingFiles.join(', ')}`
  )
}
