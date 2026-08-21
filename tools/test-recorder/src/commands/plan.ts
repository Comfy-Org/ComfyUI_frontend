import { join } from 'node:path'
import pc from 'picocolors'
import { runChecks } from './check'
import { findProjectRoot, listWorkflows } from '../recorder/runner'
import { toSlug } from '../cli/slug'
import { fail, info, pass, header } from '../ui/logger'

const KNOWN_TAGS = ['@canvas', '@widget', '@sidebar', '@smoke', '@screenshot']
const SEED_FILE = 'browser_tests/tests/interaction.spec.ts'

export interface PlanOptions {
  description: string
  tags?: string[]
  workflow?: string
  name?: string
}

export interface TestPlan {
  testSuite: string
  testName: string
  testFile: string
  seedFile: string
  tagLine: string
  bodyLines: string[]
}

/** Drops any tag not in the suite's known set, reporting each one dropped. */
export function filterKnownTags(tags: string[]): {
  kept: string[]
  unknown: string[]
} {
  const kept: string[] = []
  const unknown: string[] = []
  for (const tag of tags) {
    ;(KNOWN_TAGS.includes(tag) ? kept : unknown).push(tag)
  }
  return { kept, unknown }
}

/** Builds the plan block handed to the playwright-test-generator agent. */
export function buildTestPlan(
  options: PlanOptions,
  slug: string,
  tags: string[]
): TestPlan {
  const workflowStep = options.workflow
    ? [
        `Call \`generator_setup_page\`, then load the workflow: comfyPage.workflow.loadWorkflow(${JSON.stringify(options.workflow)})`
      ]
    : []

  return {
    testSuite: options.description,
    testName: `${options.description} works as expected`,
    testFile: `browser_tests/tests/${slug}.spec.ts`,
    seedFile: SEED_FILE,
    tagLine: tags.length > 0 ? tags.join(', ') : '@canvas',
    bodyLines: [
      ...workflowStep,
      options.description,
      'Add at least one assertion verifying the expected result'
    ]
  }
}

function printTestPlan(plan: TestPlan): void {
  console.log(pc.bold('  Hand this to the playwright-test-generator agent:'))
  console.log()
  console.log(pc.dim('  ─────────────────────────────────────────────────'))
  console.log(`  <test-suite>${plan.testSuite}</test-suite>`)
  console.log(`  <test-name>${plan.testName}</test-name>`)
  console.log(`  <test-file>${plan.testFile}</test-file>`)
  console.log(`  <seed-file>${plan.seedFile}</seed-file>`)
  console.log(`  <tag>${plan.tagLine}</tag>`)
  console.log('  <body>')
  plan.bodyLines.forEach((line, i) => console.log(`  ${i + 1}. ${line}`))
  console.log('  </body>')
  console.log(pc.dim('  ─────────────────────────────────────────────────'))
}

/**
 * Produces a ready-to-hand-off test plan for an agent caller instead of
 * driving a browser itself — `record`'s page.pause() step assumes a human
 * clicking around, which no agent can do. This prints what to feed the
 * playwright-test-generator agent (already wired to the right MCP tools and
 * ComfyUI fixture conventions in .claude/agents/playwright-test-generator.md)
 * and the exact comfy-test command to run once it has written the spec.
 */
export async function runPlan(options: PlanOptions): Promise<void> {
  header('Test Plan')

  if (!options.description.trim()) {
    fail('A --description is required', 'What should this test do?')
    process.exit(1)
  }

  const { allPassed } = await runChecks(undefined, { showHeader: false })
  if (!allPassed) {
    fail('Some required checks failed. Fix the issues above.')
    process.exit(1)
  }

  const projectRoot = findProjectRoot()
  const slug = options.name ? toSlug(options.name) : toSlug(options.description)
  if (!slug) {
    fail('Could not derive a filename', 'Pass --name explicitly.')
    process.exit(1)
  }

  const { kept: tags, unknown } = filterKnownTags(options.tags ?? [])
  if (unknown.length > 0) {
    info([
      `Unknown tag(s) dropped: ${unknown.join(', ')}`,
      `Known tags: ${KNOWN_TAGS.join(', ')}`
    ])
  }

  if (options.workflow) {
    const workflows = listWorkflows(projectRoot)
    if (!workflows.includes(options.workflow)) {
      fail(
        `Unknown workflow "${options.workflow}"`,
        'Run `comfy-test list` to see available workflows.'
      )
      process.exit(1)
    }
  }

  pass('Environment ready', projectRoot)
  console.log()

  const plan = buildTestPlan(options, slug, tags)
  printTestPlan(plan)
  console.log()

  info([
    'Once the agent has written the spec (via generator_write_test), open',
    'a PR for it with:',
    '',
    pc.cyan(`  comfy-test pr ${join(projectRoot, plan.testFile)}`),
    '',
    'No manual transform needed — the generator agent already writes',
    'convention-compliant specs (see .claude/agents/playwright-test-generator.md).'
  ])
}
