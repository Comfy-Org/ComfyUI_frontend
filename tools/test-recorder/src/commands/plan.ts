import { join } from 'node:path'
import pc from 'picocolors'
import { findProjectRoot, listWorkflows } from '../recorder/runner'
import { toSlug } from '../cli/slug'
import { fail, info, header } from '../ui/logger'
import { filterKnownTags, unknownTagWarningLines } from '../tags'

const SEED_FILE = 'browser_tests/tests/interaction.spec.ts'

export interface PlanOptions {
  description: string
  tags?: string[]
  workflow?: string
  name?: string
  featureFlags?: Record<string, unknown>
}

export interface TestPlan {
  testSuite: string
  testName: string
  testFile: string
  seedFile: string
  tagLine: string
  featureFlagsLine?: string
  bodyLines: string[]
}

/**
 * `description`/`name` are free text from the caller — escaping `<`/`>`
 * keeps a value like `</test-suite><test-name>x` from fabricating extra
 * tags in the handoff block below. Newlines are flattened too, since each
 * field is meant to render on its own line.
 */
function escapeForHandoff(value: string): string {
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, ' ')
}

/** Builds the plan block handed to the playwright-test-generator agent. */
export function buildTestPlan(
  options: PlanOptions,
  slug: string,
  tags: string[]
): TestPlan {
  const description = escapeForHandoff(options.description)
  const workflowStep = options.workflow
    ? [
        `Call \`generator_setup_page\`, then load the workflow: comfyPage.workflow.loadWorkflow(${JSON.stringify(options.workflow)})`
      ]
    : []
  const featureFlagsStep = options.featureFlags
    ? [
        'Add `test.use({ initialFeatureFlags: ... })` above the test using the feature flags provided.'
      ]
    : []

  return {
    testSuite: description,
    testName: `${description} works as expected`,
    testFile: `browser_tests/tests/${slug}.spec.ts`,
    seedFile: SEED_FILE,
    tagLine: tags.length > 0 ? tags.join(', ') : '@canvas',
    featureFlagsLine: options.featureFlags
      ? escapeForHandoff(JSON.stringify(options.featureFlags))
      : undefined,
    bodyLines: [
      ...workflowStep,
      ...featureFlagsStep,
      description,
      'Add at least one assertion verifying the expected result',
      'If the behavior depends on actually running a workflow, use the execution fixture to queue and await real runs (see browser_tests/fixtures/helpers/ExecutionHelper.ts)'
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
  if (plan.featureFlagsLine) {
    console.log(`  <feature-flags>${plan.featureFlagsLine}</feature-flags>`)
  }
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
 *
 * Deliberately skips runChecks: plan only reads the filesystem and prints
 * text, so a backend/dev-server/Playwright-browser gate built for `record`
 * would block it for services it never touches.
 */
export async function runPlan(options: PlanOptions): Promise<void> {
  header('Test Plan')

  if (!options.description.trim()) {
    fail('A --description is required', 'What should this test do?')
    process.exit(1)
  }

  let projectRoot: string
  try {
    projectRoot = findProjectRoot()
  } catch (err) {
    fail(err instanceof Error ? err.message : 'Could not find project root')
    process.exit(1)
  }

  const slug = options.name ? toSlug(options.name) : toSlug(options.description)
  if (!slug) {
    fail('Could not derive a filename', 'Pass --name explicitly.')
    process.exit(1)
  }

  const { kept: tags, unknown } = filterKnownTags(options.tags ?? [])
  if (unknown.length > 0) {
    info(unknownTagWarningLines(unknown))
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

  const plan = buildTestPlan(options, slug, tags)
  printTestPlan(plan)
  console.log()

  info([
    'This step does not need the ComfyUI backend or dev server — only the',
    'next one (playwright-test-generator, which drives a real browser)',
    'does. Run `comfy-test check` first if you are not sure they are up.',
    '',
    'Once the agent has written the spec (via generator_write_test), open',
    'a PR for it with:',
    '',
    pc.cyan(`  comfy-test pr ${join(projectRoot, plan.testFile)}`),
    '',
    'No manual transform needed — the generator agent already writes',
    'convention-compliant specs (see .claude/agents/playwright-test-generator.md).'
  ])
}
