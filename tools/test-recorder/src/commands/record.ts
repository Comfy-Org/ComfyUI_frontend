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
import { USE_CASES, useCaseById } from '../useCases'
import { addWorkflow, WORKFLOW_ASSET_EXPLANATION } from '../workflows/add'
import {
  customDistribution,
  DISTRIBUTIONS,
  normalizeBackendUrl,
  resolveDistribution
} from '../devserver/distributions'
import { ensureDevServer } from '../devserver/manager'
import { fetchEnvInfo } from '../devserver/envInfo'
import { discoverFlagKeys, parseFeatureFlagSpecs } from '../featureFlags'
import type { RecordPrefill } from './recordPrefill'
import { decidePrCheckout } from './prCheckout'

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
  s.start(
    `${adapter.label} is reviewing the test — this can take up to 10 minutes`
  )
  const result = await runAgentRefactor({
    adapter,
    specPath,
    projectRoot,
    onProgress: (elapsedMs) => {
      const seconds = Math.round(elapsedMs / 1000)
      s.message(
        `${adapter.label} is still working (${seconds}s) — this can take up to 10 minutes, please leave this window open`
      )
    }
  })

  if (!result.ran) {
    s.stop(`${adapter.label} refactor skipped`)
    warn('Agent refactor failed', result.timedOut ? 'timed out' : result.error)
    info(['Your test file is unchanged — continuing without it.'])
    return
  }

  s.stop(`${adapter.label} finished`)
  if (result.summary) {
    info(['What was changed:', ...result.summary.split('\n')])
  }
  if (!formatFile(specPath)) {
    info([`Could not format ${specPath} — run pnpm format before committing.`])
  }
  pass('Test refactored', specPath)
}

function printPrefill(label: string, value: string, source: string): void {
  console.log(`  ${label}: ${value} (from ${source})`)
}

function answered<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('Operation cancelled')
    process.exit(0)
  }
  return value
}

async function preparePrCheckout(
  pr: string,
  projectRoot: string
): Promise<void> {
  const details = runCommand(
    'gh',
    [
      'pr',
      'view',
      pr,
      '--json',
      'headRefName,title,state',
      '-q',
      '[.headRefName,.title,.state] | @tsv'
    ],
    { cwd: projectRoot, stdio: 'pipe' }
  )
  if (details.error || details.status !== 0) {
    warn(`Could not look up PR #${pr}. Continuing on the current checkout.`)
    info([`Install or sign in to gh, then run: gh pr checkout ${pr}`])
    return
  }

  const [prBranch, title] = details.stdout.toString().trim().split('\t')
  if (!prBranch || !title) {
    warn(`Could not read PR #${pr}. Continuing on the current checkout.`)
    return
  }
  const currentBranch = runCommand('git', ['branch', '--show-current'], {
    cwd: projectRoot,
    stdio: 'pipe'
  })
    .stdout.toString()
    .trim()
  const dirty =
    runCommand('git', ['status', '--porcelain'], {
      cwd: projectRoot,
      stdio: 'pipe'
    })
      .stdout.toString()
      .trim().length > 0
  const action = decidePrCheckout(currentBranch, prBranch, dirty)
  if (action === 'already-on-branch') {
    pass(`Your checkout already has the code for PR #${pr}`, prBranch)
    return
  }
  if (action === 'refuse-dirty') {
    warn(
      `PR #${pr} targets "${prBranch}", but this checkout has unsaved changes. ` +
        `I won't switch and risk losing them. Continuing on "${currentBranch}".`
    )
    info([`Save or commit your changes, then run: gh pr checkout ${pr}`])
    return
  }

  info([
    `This test plan targets PR #${pr} — '${title}'.`,
    `Your checkout is on '${currentBranch}'. I can switch to the PR's code for you.`
  ])
  const shouldSwitch = await confirm({
    message: `Switch to the code for PR #${pr}?`
  })
  if (isCancel(shouldSwitch) || !shouldSwitch) {
    warn(`Continuing on "${currentBranch}" instead of PR #${pr}.`)
    info([`To switch later, run: gh pr checkout ${pr}`])
    return
  }
  const checkout = runCommand('gh', ['pr', 'checkout', pr], {
    cwd: projectRoot,
    stdio: 'pipe'
  })
  if (checkout.error || checkout.status !== 0) {
    warn(`Could not switch to PR #${pr}. Continuing on "${currentBranch}".`)
    info([`Try manually: gh pr checkout ${pr}`])
    return
  }
  pass(`Switched to the code for PR #${pr}`, prBranch)
}

export async function runRecord(
  prefill: RecordPrefill = { warnings: [] }
): Promise<void> {
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
    '  1. Answer a few quick questions about what you want to show',
    '  2. Do the steps in a real browser window while they are recorded',
    '  3. Optionally have an AI agent tidy it up and open a PR',
    '',
    "You can't do this wrong. Whatever you record is genuinely useful —",
    'what only YOU know is how real people actually use the app, and',
    "that's the part no developer can produce. Messy is fine; the",
    'maintainers happily tidy things up, and nothing here can break',
    'the product.',
    '',
    'Full docs, if you want them: browser_tests/README.md'
  ])
  blank()

  for (const warning of prefill.warnings) {
    warn(`${warning} Asking you instead.`)
  }

  if (prefill.pr) {
    let root: string
    try {
      root = findProjectRoot()
    } catch {
      warn(`Could not find the checkout for PR #${prefill.pr}. Continuing.`)
      root = process.cwd()
    }
    await preparePrCheckout(prefill.pr, root)
  }

  stepHeader(1, 7, 'Target Distribution')
  const distributionInfo = await Promise.all(
    DISTRIBUTIONS.map(async (candidate) => ({
      id: candidate.id,
      info:
        candidate.backendUrl && candidate.id !== 'local'
          ? await fetchEnvInfo(candidate.backendUrl)
          : { ok: false as const }
    }))
  )
  const selectedDistribution = prefill.distribution
    ? prefill.distribution.id
    : answered(
        await select({
          message: 'Which distribution do you want to record against?',
          options: [
            ...DISTRIBUTIONS.map(({ id, label, hint, backendUrl }) => ({
              value: id,
              label,
              hint: (() => {
                const env = distributionInfo.find(
                  (entry) => entry.id === id
                )?.info
                if (!env?.ok || !backendUrl) return hint
                const host = new URL(backendUrl).host
                const suffix = id === 'cloud' ? ' (default)' : ''
                return `${host} — backend ${env.cloudVersion}${suffix}`
              })()
            })),
            {
              value: CUSTOM_DISTRIBUTION_SENTINEL,
              label: 'Custom backend…',
              hint: 'connect Vite to another backend URL'
            }
          ],
          initialValue: 'cloud'
        })
      )
  if (prefill.distribution) {
    printPrefill(
      'Distribution',
      prefill.distribution.id,
      prefill.distributionSource ?? '--distribution'
    )
  }
  let distribution =
    prefill.distribution ?? resolveDistribution(selectedDistribution)
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

  const branch = runCommand('git', ['branch', '--show-current'], {
    cwd: process.cwd(),
    stdio: 'pipe'
  })
    .stdout?.toString()
    .trim()
  info([
    `The app you're testing is your local checkout (branch ${branch || 'unknown'}). ` +
      'The environment choice only picks which backend it talks to.'
  ])

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

  const useCaseChoice = prefill.useCase
    ? prefill.useCase.id
    : answered(
        await select({
          message:
            "What brings you here today? There's no wrong answer — this just helps us ask the right question next.",
          options: USE_CASES.map(({ id, label, hint }) => ({
            value: id,
            label,
            hint
          }))
        })
      )
  if (prefill.useCase) {
    printPrefill('Use case', prefill.useCase.id, '--use-case')
  }
  const useCase = useCaseById(useCaseChoice) ?? USE_CASES[0]

  info([
    'Naming tip: describe the user-visible behavior, not the steps —',
    pc.dim('"collapsing a node keeps its connections"') +
      ' reads better than ' +
      pc.dim('"click node then press collapse"') +
      '.',
    'Your answer becomes both the filename and the test name, so specific',
    'beats generic: "queuing a workflow with a missing model" over "test 1".'
  ])
  blank()

  const description =
    prefill.description ??
    answered(
      await text({
        message: useCase.question,
        placeholder: useCase.placeholder,
        validate: (value) =>
          toSlug(value ?? '') ? undefined : 'Use some letters or numbers.'
      })
    )
  if (prefill.description) {
    printPrefill('Description', prefill.description, '--description')
  }

  let testDescription: string = description
  let slug = toSlug(description)

  const filenameOk = prefill.name
    ? true
    : answered(
        await confirm({
          message: `Generated filename: ${slug}.spec.ts — looks good?`
        })
      )
  if (prefill.name) {
    slug = prefill.name
    printPrefill('Name', prefill.name, '--name')
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

  const selectedTags =
    prefill.tags ??
    answered(
      await multiselect({
        message:
          'Pick tags: press SPACE to select each one, ENTER when done (ENTER alone = no tags):',
        options: TAG_REGISTRY.map(({ tag, hint }) => ({
          value: tag,
          label: tag,
          hint
        })),
        initialValues: [],
        required: false
      })
    )
  if (prefill.tags) {
    printPrefill('Tags', prefill.tags.join(', '), '--tags')
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

  const validPrefillWorkflow =
    prefill.workflow !== undefined &&
    (prefill.workflow === '' || workflows.includes(prefill.workflow))
      ? prefill.workflow
      : undefined
  if (prefill.workflow !== undefined && validPrefillWorkflow === undefined) {
    warn(`Unknown --workflow "${prefill.workflow}". Asking you instead.`)
  }
  const selectedWorkflow =
    validPrefillWorkflow ??
    answered(
      await autocomplete({
        message: `Start with a pre-loaded workflow? (${workflows.length} available)`,
        options: workflowOptions,
        initialValue: '',
        maxItems: 12
      })
    )
  if (validPrefillWorkflow !== undefined) {
    printPrefill(
      'Workflow',
      validPrefillWorkflow || '(empty canvas)',
      '--workflow'
    )
  }

  let seedWorkflow = selectedWorkflow
  if (selectedWorkflow === ADD_WORKFLOW_SENTINEL) {
    info([WORKFLOW_ASSET_EXPLANATION])
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

  const overrideFeatureFlags = prefill.featureFlags
    ? true
    : answered(
        await confirm({
          message: 'Override feature flags for this test?',
          initialValue: false
        })
      )
  if (prefill.featureFlags) {
    printPrefill(
      'Feature flags',
      Object.entries(prefill.featureFlags)
        .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
        .join(', '),
      '--feature-flags'
    )
  }

  let selectedFeatureFlags: string[] = []
  if (overrideFeatureFlags && !prefill.featureFlags) {
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
  const featureFlags =
    prefill.featureFlags ?? parseFeatureFlagSpecs(selectedFeatureFlags)

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
  if (!distribution.needsLocalBackend && seedWorkflow) {
    warn(
      `Recording against ${distribution.label} can't pre-load workflows — ` +
        `load "${seedWorkflow}" manually in the app once recording starts.`
    )
  }

  let result
  try {
    result = await runRecording({
      testName: slug,
      workflow: seedWorkflow || undefined,
      featureFlags,
      projectRoot,
      distribution
    })
  } finally {
    devServer.stop()
  }
  if (!result.success) {
    fail('Recording failed', result.error)
    process.exit(1)
  }

  const nameStillFits = await confirm({
    message: `Before recording you called this "${testDescription}" — does that still match what you just did?`
  })
  if (isCancel(nameStillFits)) {
    cancel('Operation cancelled')
    process.exit(0)
  }
  if (!nameStillFits) {
    const newDescription = await text({
      message: 'No problem — what does the recording actually show?',
      placeholder: testDescription,
      validate: (value) =>
        toSlug(value ?? '') ? undefined : 'Use some letters or numbers.'
    })
    if (isCancel(newDescription)) {
      cancel('Operation cancelled')
      process.exit(0)
    }
    testDescription = newDescription
    slug = toSlug(newDescription)
    pass('Renamed', `${slug}.spec.ts`)
  }

  stepHeader(6, 7, 'Transform')

  let recordedCode: string
  let stdinOpen = true
  if (result.recordedCode?.trim()) {
    pass('Recorded code captured automatically', '(no copy/paste needed)')
    recordedCode = result.recordedCode
  } else {
    info([
      "The recording didn't save automatically this time.",
      '',
      'If you still have the generated code, paste it below. When you',
      'are done, type a single ' +
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
    tags: selectedTags,
    workflow: seedWorkflow || undefined,
    featureFlags
  })

  blank()
  const summary = formatTransformSummary(transformResult)
  for (const line of summary) {
    console.log(`    ${line}`)
  }

  if (transformResult.securityFindings.length > 0) {
    alert('Something sensitive was removed from your recording', [
      'The recording captured typing that looked like a password or a',
      'secret key. It was removed automatically and is NOT in your test:',
      '',
      ...transformResult.securityFindings.map((finding) => `  ${finding}`),
      '',
      'If you typed a real password while recording, consider changing',
      'it — the raw recording may linger in terminal or agent history.',
      '',
      'Tip: sign in BEFORE pressing Record. Nothing is captured until',
      'you press Record in the floating toolbar.'
    ])
  }

  const hasNoAssertions = transformResult.warnings.some((w) =>
    w.includes('No assertions')
  )
  if (hasNoAssertions) {
    alert('This test has no proof step', [
      'A proof step checks that something visible really happened —',
      'text appeared, a value changed. Without one, the test cannot',
      'tell success from failure, and it will be rejected on commit.',
      '',
      'Easiest fix: record again and use the assert buttons next to',
      'Record in the floating toolbar. Or add a line like this to the',
      'file below:',
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

  info([
    'A pull request just shares your recording with the team — nothing',
    'goes live from it. Rough edges are expected and welcome: reviewers',
    'gladly polish contributions like this, and a recording that needs',
    'cleanup is still far more valuable than no recording at all.'
  ])
  blank()

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
      description: testDescription,
      projectRoot
    })
  } else {
    blank()
    info(['You can create a PR later.', pc.dim(`Test file: ${outputPath}`)])
  }
}
