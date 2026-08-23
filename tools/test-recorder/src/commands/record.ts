import { createInterface } from 'node:readline'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  text,
  autocomplete,
  autocompleteMultiselect,
  multiselect,
  confirm,
  isCancel,
  cancel,
  spinner,
  path,
  select
} from '@clack/prompts'
import pc from 'picocolors'
import { runChecks } from './check'
import {
  runRecording,
  findProjectRoot,
  listWorkflows
} from '../recorder/runner'
import { transform, formatTransformSummary } from '../transform/engine'
import { formatFile } from '../transform/format'
import { openPr } from '../pr/openPr'
import { runCommand } from '../cli/run'
import { detectAgentClis } from '../checks/agentCli'
import { runAgentRefactor } from '../agent/refactor'
import { stepHeader } from '../ui/steps'
import { pass, fail, warn, alert, info, blank, box } from '../ui/logger'
import { toSlug } from '../cli/slug'
import { TAG_REGISTRY } from '../tags'
import { addWorkflow } from '../workflows/add'
import {
  customDistribution,
  DISTRIBUTIONS,
  normalizeBackendUrl,
  resolveDistribution
} from '../devserver/distributions'
import { ensureDevServer } from '../devserver/manager'
import { discoverFlagKeys, parseFeatureFlagSpecs } from '../featureFlags'

const PASTE_SENTINEL = '.'
const ADD_WORKFLOW_SENTINEL = '__add-workflow__'
const CUSTOM_DISTRIBUTION_SENTINEL = 'custom'

/**
 * Ctrl+D closes stdin for good, leaving every later prompt unanswerable, so
 * callers are told whether stdin survived the paste.
 */
function readMultiline(): Promise<{ code: string; stdinOpen: boolean }> {
  return new Promise((resolve) => {
    const lines: string[] = []
    const rl = createInterface({ input: process.stdin })
    let sentinelUsed = false

    rl.on('line', (line) => {
      if (line.trim() === PASTE_SENTINEL) {
        sentinelUsed = true
        rl.close()
        return
      }
      lines.push(line)
    })
    rl.on('close', () => {
      resolve({ code: lines.join('\n'), stdinOpen: sentinelUsed })
    })
  })
}

/**
 * Best-effort — offers to hand the spec to a locally installed coding-agent
 * CLI for a convention pass against docs/guidance and browser_tests' own
 * docs. Never runs without consent, and any failure here just means the
 * user keeps the untouched spec from the transform step.
 */
async function offerAgentRefactor(
  specPath: string,
  projectRoot: string
): Promise<void> {
  const adapters = detectAgentClis()
  if (adapters.length === 0) {
    info([
      'No local coding-agent CLI found (claude, codex, gemini, amp, opencode) — skipping.',
      'You can ask one manually to refactor the spec against docs/guidance/playwright.md',
      'and browser_tests/README.md.'
    ])
    return
  }

  const adapter = adapters[0]
  const wantRefactor = await confirm({
    message: `Ask ${adapter.label} to refactor this test against our Playwright conventions?`
  })
  if (isCancel(wantRefactor) || !wantRefactor) return

  const s = spinner()
  s.start(`${adapter.label} is reviewing the test...`)
  const result = runAgentRefactor({ adapter, specPath, projectRoot })

  if (!result.ran) {
    s.stop(`${adapter.label} refactor skipped`)
    warn('Agent refactor failed', result.timedOut ? 'timed out' : result.error)
    info(['Your test file is unchanged — continuing without it.'])
    return
  }

  s.stop(`${adapter.label} finished`)
  if (!formatFile(specPath)) {
    info([`Could not format ${specPath} — run pnpm format before committing.`])
  }
  pass('Test refactored', specPath)
}

export async function runRecord(): Promise<void> {
  if (!process.stdin.isTTY) {
    fail(
      'comfy-test record needs an interactive terminal',
      'stdin is not a TTY, so the guided prompts below cannot be answered.'
    )
    info([
      'This command walks through several yes/no and text prompts, then',
      'opens a real browser window for you to click through — none of',
      'that is scriptable today.',
      '',
      'If you already have generated code, use:',
      '',
      '  comfy-test transform <file> [--name <n>] [--tags <a,b>] [--output <f>]',
      '  comfy-test pr <file.spec.ts>',
      '',
      'Both of those work without a terminal attached.'
    ])
    process.exit(1)
  }

  box([
    'This walks you through recording a real browser test — no coding',
    'required. You will:',
    '',
    '  1. Perform the steps you want tested in a real browser window',
    '  2. Paste what got recorded back here',
    '  3. Optionally have an AI agent clean it up and open a PR',
    '',
    'Full docs, if you want them: browser_tests/README.md'
  ])
  blank()

  stepHeader(1, 7, 'Target Distribution')
  const selectedDistribution = await select({
    message: 'Which distribution do you want to record against?',
    options: [
      ...DISTRIBUTIONS.map(({ id, label, hint }) => ({
        value: id,
        label,
        hint
      })),
      {
        value: CUSTOM_DISTRIBUTION_SENTINEL,
        label: 'Custom backend…',
        hint: 'connect Vite to another backend URL'
      }
    ],
    initialValue: 'cloud'
  })
  if (isCancel(selectedDistribution)) {
    cancel('Operation cancelled')
    process.exit(0)
  }
  let distribution = resolveDistribution(selectedDistribution)
  if (selectedDistribution === CUSTOM_DISTRIBUTION_SENTINEL) {
    const backendInput = await text({
      message: 'Backend URL:',
      placeholder: 'agent.comfy.org',
      validate: (value) => {
        const result = normalizeBackendUrl(value ?? '')
        return result.ok ? undefined : result.reason
      }
    })
    if (isCancel(backendInput)) {
      cancel('Operation cancelled')
      process.exit(0)
    }
    const normalized = normalizeBackendUrl(backendInput)
    if (!normalized.ok) throw new Error(normalized.reason)
    distribution = customDistribution(normalized.url)
  }
  if (!distribution) throw new Error('Selected distribution is unavailable')

  stepHeader(2, 7, 'Environment Check')
  const { allPassed } = await runChecks(distribution, undefined, {
    showHeader: false
  })
  if (!allPassed) {
    blank()
    fail('Some required checks failed. Fix the issues above.')
    process.exit(1)
  }

  stepHeader(3, 7, 'Project Setup')

  let projectRoot: string
  try {
    projectRoot = findProjectRoot()
  } catch (err) {
    fail(err instanceof Error ? err.message : 'Could not find project root')
    process.exit(1)
  }

  const s = spinner()
  s.start('Installing dependencies...')
  const install = runCommand('pnpm', ['install'], {
    cwd: projectRoot,
    stdio: 'pipe',
    maxBuffer: Infinity
  })
  if (install.error || install.status !== 0) {
    s.stop('Dependency installation failed')
    fail(
      'pnpm install failed',
      install.error?.message ?? install.stderr?.toString() ?? ''
    )
    process.exit(1)
  }
  s.stop('Dependencies installed')
  pass('Project ready', projectRoot)

  stepHeader(4, 7, 'Configure Your Test')

  info([
    'Naming tip: describe the user-visible behavior, not the steps —',
    pc.dim('"collapsing a node keeps its connections"') +
      ' reads better than ' +
      pc.dim('"click node then press collapse"') +
      '.',
    'This becomes both the filename and the test name, so specific beats',
    'generic: prefer "queuing a workflow with a missing model" over "test 1".'
  ])
  blank()

  const description = await text({
    message: 'What are you testing?',
    placeholder: 'e.g., collapsing a KSampler node keeps its connections',
    validate: (value) =>
      toSlug(value ?? '') ? undefined : 'Use some letters or numbers.'
  })
  if (isCancel(description)) {
    cancel('Operation cancelled')
    process.exit(0)
  }

  let slug = toSlug(description)

  const filenameOk = await confirm({
    message: `Generated filename: ${slug}.spec.ts — looks good?`
  })
  if (isCancel(filenameOk)) {
    cancel('Operation cancelled')
    process.exit(0)
  }
  if (!filenameOk) {
    const customName = await text({
      message: 'Enter a custom filename (without .spec.ts):',
      placeholder: slug,
      validate: (value) =>
        toSlug(value ?? '') ? undefined : 'Use letters or numbers.'
    })
    if (isCancel(customName)) {
      cancel('Operation cancelled')
      process.exit(0)
    }
    slug = toSlug(customName)
  }

  info([
    'Tags help others find and filter this test — pick whatever areas it',
    "touches, or none if you're unsure. Full list: browser_tests/README.md#test-tags"
  ])
  blank()

  const selectedTags = await multiselect({
    message: 'Select tags for this test (space to toggle, enter for none):',
    options: TAG_REGISTRY.map(({ tag, hint }) => ({
      value: tag,
      label: tag,
      hint
    })),
    initialValues: [],
    required: false
  })
  if (isCancel(selectedTags)) {
    cancel('Operation cancelled')
    process.exit(0)
  }

  const workflows = listWorkflows(projectRoot)
  // Hoisted so the ~150 other assets do not bury them off the top.
  const common = workflows.filter((wf) => wf === 'default')
  const rest = workflows.filter((wf) => wf !== 'default')
  const workflowOptions: {
    value: string
    label: string
    hint?: string
  }[] = [
    { value: '', label: '(empty canvas)', hint: 'start fresh' },
    {
      value: ADD_WORKFLOW_SENTINEL,
      label: '(add from file…)',
      hint: 'import a workflow JSON'
    },
    ...common.map((wf) => ({ value: wf, label: wf, hint: 'standard graph' })),
    ...rest.map((wf) => ({ value: wf, label: wf }))
  ]

  const selectedWorkflow = await autocomplete({
    message: `Start with a pre-loaded workflow? (${workflows.length} available)`,
    options: workflowOptions,
    initialValue: '',
    maxItems: 12
  })
  if (isCancel(selectedWorkflow)) {
    cancel('Operation cancelled')
    process.exit(0)
  }

  let seedWorkflow = selectedWorkflow
  if (selectedWorkflow === ADD_WORKFLOW_SENTINEL) {
    const workflowPath = await path({
      message: 'Select a ComfyUI workflow JSON file:',
      root: process.cwd(),
      directory: false,
      validate: (value) =>
        value?.toLowerCase().endsWith('.json')
          ? undefined
          : 'Select a .json file.'
    })
    if (isCancel(workflowPath)) {
      cancel('Operation cancelled')
      process.exit(0)
    }

    try {
      seedWorkflow = addWorkflow(workflowPath, projectRoot).destRelPath
      pass('Workflow added', seedWorkflow)
    } catch (error) {
      fail(
        'Could not add workflow; starting with an empty canvas instead.',
        error instanceof Error ? error.message : String(error)
      )
      seedWorkflow = ''
    }
  }

  const overrideFeatureFlags = await confirm({
    message: 'Override feature flags for this test?',
    initialValue: false
  })
  if (isCancel(overrideFeatureFlags)) {
    cancel('Operation cancelled')
    process.exit(0)
  }

  let selectedFeatureFlags: string[] = []
  if (overrideFeatureFlags) {
    const availableFlags = discoverFlagKeys(projectRoot)
    if (availableFlags.length > 0) {
      const selected = await autocompleteMultiselect({
        message: 'Select feature flags to enable:',
        options: availableFlags.map((flag) => ({ value: flag, label: flag })),
        required: false
      })
      if (isCancel(selected)) {
        cancel('Operation cancelled')
        process.exit(0)
      }
      selectedFeatureFlags = selected
    }

    const customFlags = await text({
      message: 'Custom flags (name:value, comma-separated, blank to skip)',
      placeholder: 'asset_rename_enabled:false, custom_flag:12'
    })
    if (isCancel(customFlags)) {
      cancel('Operation cancelled')
      process.exit(0)
    }
    selectedFeatureFlags = [
      ...selectedFeatureFlags,
      ...customFlags.split(',').map((flag) => flag.trim())
    ]
  }
  const featureFlags = parseFeatureFlagSpecs(selectedFeatureFlags)

  stepHeader(5, 7, 'Record')

  const serverSpinner = spinner()
  serverSpinner.start(`Starting dev server (${distribution.script})…`)
  const devServer = await ensureDevServer(distribution, projectRoot).catch(
    (error: unknown) => {
      serverSpinner.stop('Dev server failed to start')
      throw error
    }
  )
  serverSpinner.stop(
    devServer.ownedByUs ? 'Dev server started' : 'Using running dev server'
  )
  if (distribution.backendUrl && devServer.reused) {
    warn(
      `Reusing running dev server — it may not point at ${distribution.backendUrl}`
    )
  }

  let result
  try {
    result = await runRecording({
      testName: slug,
      workflow: seedWorkflow || undefined,
      featureFlags,
      projectRoot
    })
  } finally {
    devServer.stop()
  }
  if (!result.success) {
    fail('Recording failed', result.error)
    process.exit(1)
  }

  stepHeader(6, 7, 'Transform')

  let recordedCode: string
  let stdinOpen = true
  if (result.recordedCode?.trim()) {
    pass('Recorded code captured automatically', '(no copy/paste needed)')
    recordedCode = result.recordedCode
  } else {
    info([
      'Copy the generated code from the Playwright Inspector.',
      '',
      'Paste your code below. When you are done, type a single ' +
        pc.bold('.') +
        ' on its own line and press Enter:'
    ])
    blank()

    const pasted = await readMultiline()
    stdinOpen = pasted.stdinOpen

    if (!pasted.code.trim()) {
      blank()
      info([
        'No code pasted. You can transform later with:',
        pc.cyan(`  comfy-test transform <file>`)
      ])
      process.exit(0)
    }
    recordedCode = pasted.code
  }

  const transformResult = transform(recordedCode, {
    testName: slug,
    tags: selectedTags as string[],
    workflow: seedWorkflow || undefined,
    featureFlags
  })

  blank()
  const summary = formatTransformSummary(transformResult)
  for (const line of summary) {
    console.log(`    ${line}`)
  }

  const hasNoAssertions = transformResult.warnings.some((w) =>
    w.includes('No assertions')
  )
  if (hasNoAssertions) {
    alert('This test has no assertions', [
      "Playwright can't tell your test passed unless it checks something",
      'concrete — text, a value, whether something is visible.',
      '',
      'FIX: this WILL be rejected when you commit. Open the file below',
      'and add at least one line like:',
      '',
      "  await expect(comfyPage.page.getByText('Queue')).toBeVisible()"
    ])
  }

  const testsDir = join(projectRoot, 'browser_tests', 'tests')
  mkdirSync(testsDir, { recursive: true })
  const outputPath = join(testsDir, `${slug}.spec.ts`)
  writeFileSync(outputPath, transformResult.code)
  if (!formatFile(outputPath)) {
    info([
      `Could not format ${outputPath} — run pnpm format before committing.`
    ])
  }

  blank()
  pass('Test saved', outputPath)

  stepHeader(7, 7, 'Refactor (optional)')
  await offerAgentRefactor(outputPath, projectRoot)
  blank()

  if (!stdinOpen) {
    // stdin is at EOF, so prompting here would hang.
    blank()
    info([
      'Test saved. To open a PR for it, run:',
      pc.cyan(`  comfy-test pr ${outputPath}`),
      '',
      'Next time, end the paste with a single "." line to stay interactive.'
    ])
    return
  }

  const wantPr = await confirm({
    message: 'Create a Pull Request now?'
  })
  if (isCancel(wantPr)) {
    cancel('Operation cancelled')
    process.exit(0)
  }

  if (wantPr) {
    await openPr({
      testFilePath: outputPath,
      testName: slug,
      description: description,
      projectRoot
    })
  } else {
    blank()
    info(['You can create a PR later.', pc.dim(`Test file: ${outputPath}`)])
  }
}
