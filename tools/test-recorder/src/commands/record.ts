import { createInterface } from 'node:readline'
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  text,
  select,
  multiselect,
  confirm,
  isCancel,
  cancel,
  spinner
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
import { stepHeader } from '../ui/steps'
import { pass, fail, info, blank, box } from '../ui/logger'
import { checkGhAvailable, createPr } from '../pr/gh'
import { printManualInstructions } from '../pr/manual'
import { copyToClipboard } from '../pr/clipboard'

function toSlug(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const PASTE_SENTINEL = '.'

/**
 * Reads pasted code until a lone "." line, or until EOF.
 *
 * The sentinel matters: Ctrl+D closes stdin for good, and every prompt after
 * this point would then read EOF and hang unsettled. Callers get told whether
 * stdin survived so they can degrade instead of stalling.
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

export async function runRecord(): Promise<void> {
  // ── Step 1: Environment Check ──────────────────────────────
  stepHeader(1, 6, 'Environment Check')
  const { allPassed } = await runChecks(undefined, { showHeader: false })
  if (!allPassed) {
    blank()
    fail('Some required checks failed. Fix the issues above.')
    process.exit(1)
  }

  // ── Step 2: Project Setup ──────────────────────────────────
  stepHeader(2, 6, 'Project Setup')

  let projectRoot: string
  try {
    projectRoot = findProjectRoot()
  } catch (err) {
    fail(err instanceof Error ? err.message : 'Could not find project root')
    process.exit(1)
  }

  const s = spinner()
  s.start('Installing dependencies...')
  const install = spawnSync('pnpm', ['install'], {
    cwd: projectRoot,
    stdio: 'pipe'
  })
  if (install.status !== 0) {
    s.stop('Dependency installation failed')
    fail('pnpm install failed', install.stderr?.toString() ?? '')
    process.exit(1)
  }
  s.stop('Dependencies installed')
  pass('Project ready', projectRoot)

  // ── Step 3: Configure Your Test ────────────────────────────
  stepHeader(3, 6, 'Configure Your Test')

  const description = await text({
    message: 'What are you testing?',
    placeholder: 'e.g., adding a KSampler node and queuing'
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
      placeholder: slug
    })
    if (isCancel(customName)) {
      cancel('Operation cancelled')
      process.exit(0)
    }
    slug = toSlug(customName)
  }

  const selectedTags = await multiselect({
    message: 'Select tags for this test:',
    options: [
      { value: '@canvas', label: '@canvas' },
      { value: '@widget', label: '@widget' },
      { value: '@sidebar', label: '@sidebar' },
      { value: '@smoke', label: '@smoke' },
      { value: '@mobile', label: '@mobile' },
      { value: '@screenshot', label: '@screenshot' }
    ],
    initialValues: ['@canvas']
  })
  if (isCancel(selectedTags)) {
    cancel('Operation cancelled')
    process.exit(0)
  }

  const workflows = listWorkflows(projectRoot)
  // The two starting points nearly every test uses go first; the remaining
  // ~150 assets would otherwise bury them off the top of the screen.
  const common = workflows.filter((wf) => wf === 'default')
  const rest = workflows.filter((wf) => wf !== 'default')
  const workflowOptions: {
    value: string
    label: string
    hint?: string
  }[] = [
    { value: '', label: '(empty canvas)', hint: 'start fresh' },
    ...common.map((wf) => ({ value: wf, label: wf, hint: 'standard graph' })),
    ...rest.map((wf) => ({ value: wf, label: wf }))
  ]

  const selectedWorkflow = await select({
    message: `Start with a pre-loaded workflow? (${workflows.length} available — type-ahead is not supported, use ↑/↓)`,
    options: workflowOptions,
    maxItems: 12
  })
  if (isCancel(selectedWorkflow)) {
    cancel('Operation cancelled')
    process.exit(0)
  }

  // ── Step 4: Record ─────────────────────────────────────────
  stepHeader(4, 6, 'Record')

  const result = await runRecording({
    testName: slug,
    workflow: selectedWorkflow || undefined,
    projectRoot
  })
  if (!result.success) {
    fail('Recording failed', result.error)
    process.exit(1)
  }

  // ── Step 5: Paste & Transform ──────────────────────────────
  stepHeader(5, 6, 'Paste & Transform')

  info([
    'Copy the generated code from the Playwright Inspector.',
    '',
    'Paste your code below. When you are done, type a single ' +
      pc.bold('.') +
      ' on its own line and press Enter:'
  ])
  blank()

  const { code: pastedCode, stdinOpen } = await readMultiline()

  if (!pastedCode.trim()) {
    blank()
    info([
      'No code pasted. You can transform later with:',
      pc.cyan(`  comfy-test transform <file>`)
    ])
    process.exit(0)
  }

  const transformResult = transform(pastedCode, {
    testName: slug,
    tags: selectedTags as string[],
    workflow: (selectedWorkflow as string) || undefined
  })

  blank()
  const summary = formatTransformSummary(transformResult)
  for (const line of summary) {
    console.log(`    ${line}`)
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

  // ── Step 6: Finalize ───────────────────────────────────────
  stepHeader(6, 6, 'Finalize')

  box([
    'Run your test:',
    pc.cyan(`  pnpm exec playwright test ${slug} --headed`),
    '',
    'Review in UI mode:',
    pc.cyan('  pnpm exec playwright test --ui')
  ])
  blank()

  if (!stdinOpen) {
    // Ctrl+D ended the paste, so stdin is at EOF and no further prompt can be
    // answered. Print the follow-up instead of hanging on a dead prompt.
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
    const gh = await checkGhAvailable()
    if (gh.available && gh.authenticated) {
      await createPr({
        testFilePath: outputPath,
        testName: slug,
        description: description as string
      })
    } else {
      const fileContents = readFileSync(outputPath, 'utf-8')
      const copied = await copyToClipboard(fileContents)
      if (!copied.ok) {
        info([
          'Could not copy to clipboard. File contents are at:',
          pc.cyan(outputPath)
        ])
      }
      const relativePath = `browser_tests/tests/${slug}.spec.ts`
      printManualInstructions({
        testFilePath: outputPath,
        testName: slug,
        relativePath
      })
    }
  } else {
    blank()
    info(['You can create a PR later.', pc.dim(`Test file: ${outputPath}`)])
  }
}
