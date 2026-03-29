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

function readMultiline(): Promise<string> {
  return new Promise((resolve) => {
    const lines: string[] = []
    const rl = createInterface({ input: process.stdin })
    rl.on('line', (line) => lines.push(line))
    rl.on('close', () => resolve(lines.join('\n')))
  })
}

export async function runRecord(): Promise<void> {
  // ── Step 1: Environment Check ──────────────────────────────
  stepHeader(1, 7, 'Environment Check')
  const { allPassed } = await runChecks()
  if (!allPassed) {
    blank()
    fail('Some required checks failed. Fix the issues above.')
    process.exit(1)
  }

  // ── Step 2: Project Setup ──────────────────────────────────
  stepHeader(2, 7, 'Project Setup')

  let projectRoot: string
  try {
    projectRoot = findProjectRoot()
  } catch (err) {
    fail(err instanceof Error ? err.message : 'Could not find project root')
    process.exit(1)
  }

  const s = spinner()
  s.start('Installing dependencies...')
  spawnSync('pnpm', ['install'], { cwd: projectRoot, stdio: 'pipe' })
  s.stop('Dependencies installed')
  pass('Project ready', projectRoot)

  // ── Step 3: Backend & Dev Server ───────────────────────────
  stepHeader(3, 7, 'Backend & Dev Server')
  pass('Services checked in Step 1')

  // ── Step 4: Configure Your Test ────────────────────────────
  stepHeader(4, 7, 'Configure Your Test')

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
  const workflowOptions: {
    value: string
    label: string
    hint?: string
  }[] = [
    { value: '', label: '(empty canvas)', hint: 'start fresh' },
    ...workflows.map((wf) => ({ value: wf, label: wf }))
  ]

  const selectedWorkflow = await select({
    message: 'Start with a pre-loaded workflow?',
    options: workflowOptions
  })
  if (isCancel(selectedWorkflow)) {
    cancel('Operation cancelled')
    process.exit(0)
  }

  // ── Step 5: Record ─────────────────────────────────────────
  stepHeader(5, 7, 'Record')

  const result = await runRecording({
    testName: slug,
    workflow: selectedWorkflow || undefined,
    projectRoot
  })
  if (!result.success) {
    fail('Recording failed', result.error)
    process.exit(1)
  }

  // ── Step 6: Paste & Transform ──────────────────────────────
  stepHeader(6, 7, 'Paste & Transform')

  info([
    'Copy the generated code from the Playwright Inspector.',
    '',
    'Paste your code below, then press ' +
      pc.bold('Ctrl+D') +
      ' (Mac/Linux) or ' +
      pc.bold('Ctrl+Z') +
      ' (Windows) when done:'
  ])
  blank()

  const pastedCode = await readMultiline()

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
    tags: selectedTags as string[]
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

  blank()
  pass('Test saved', outputPath)

  // ── Step 7: Finalize ───────────────────────────────────────
  stepHeader(7, 7, 'Finalize')

  box([
    'Run your test:',
    pc.cyan(`  pnpm exec playwright test ${slug} --headed`),
    '',
    'Review in UI mode:',
    pc.cyan('  pnpm exec playwright test --ui')
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
    const gh = await checkGhAvailable()
    if (gh.available && gh.authenticated) {
      await createPr({
        testFilePath: outputPath,
        testName: slug,
        description: description as string
      })
    } else {
      const fileContents = readFileSync(outputPath, 'utf-8')
      await copyToClipboard(fileContents)
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
