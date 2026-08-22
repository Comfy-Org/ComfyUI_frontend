import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

interface ResultStats {
  expected: number
  unexpected: number
  flaky: number
  skipped: number
}

interface TestResult {
  suiteTitle: string
  status: string
}

interface TierSession {
  pid: string
  tier: string
  pageId: string
}

const PROOFS = {
  '1': {
    witness: 'comfyui-impact-pack',
    title: 'S1: every enrolled registered node mounts on the canvas renderer',
    pattern:
      /ImpactInt: instance is missing declared input \\?"value\\?" \(litegraph\)/,
    nextTier: 'S2'
  },
  '2': {
    witness: 'comfyui-impact-pack',
    title: 'S2: every enrolled registered node mounts on the DOM renderer',
    pattern: /ImpactInt: Vue mounts 0 of 1 widgets/,
    nextTier: 'S3'
  },
  '3': {
    witness: 'comfyui-impact-pack',
    title:
      'S3: enrolled registered-node save/reload outcomes match exact contracts',
    pattern: /ImpactInt: widgets_values \[1\] -> \[0\] on set-values reload/,
    nextTier: undefined
  },
  '9': {
    witness: 'comfyui-videohelpersuite',
    title: 'S9: calibrated model-free node corpus executes',
    pattern: /DETECTION PROOF \(row 9\): pack node runtime failure/,
    nextTier: undefined
  },
  '15': {
    witness: 'ComfyUI-Impact-Pack',
    title: 'Curated workflow execution: completes without error',
    pattern:
      /ComfyUI-Impact-Pack\/impact_primitives_run\.json 2: output hash changed/,
    nextTier: undefined
  }
} as const

type ProofRow = keyof typeof PROOFS

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberField(value: Record<string, unknown>, key: string): number {
  const field = value[key]
  if (typeof field !== 'number' || !Number.isInteger(field) || field < 0)
    throw new Error(`results stats.${key} must be a non-negative integer`)
  return field
}

export function parseStats(value: unknown): ResultStats {
  if (!isRecord(value) || !isRecord(value.stats))
    throw new Error('results JSON has no stats object')
  return {
    expected: numberField(value.stats, 'expected'),
    unexpected: numberField(value.stats, 'unexpected'),
    flaky: numberField(value.stats, 'flaky'),
    skipped: numberField(value.stats, 'skipped')
  }
}

export function validateOrdinaryResult(
  stats: ResultStats,
  expectedTests: number | undefined
): void {
  const collected = Object.values(stats).reduce((sum, value) => sum + value, 0)
  if (expectedTests !== undefined && collected !== expectedTests)
    throw new Error(`collected ${collected} tests; expected ${expectedTests}`)
  if (stats.unexpected !== 0)
    throw new Error(`${stats.unexpected} test(s) failed`)
  if (stats.skipped !== 0) throw new Error(`${stats.skipped} test(s) skipped`)
  if (stats.flaky !== 0)
    throw new Error(`${stats.flaky} test(s) passed only after retry`)
}

function visit(
  value: unknown,
  action: (value: Record<string, unknown>) => void
) {
  if (Array.isArray(value)) {
    for (const entry of value) visit(entry, action)
    return
  }
  if (!isRecord(value)) return
  action(value)
  for (const entry of Object.values(value)) visit(entry, action)
}

function collectTests(value: unknown): TestResult[] {
  const tests: TestResult[] = []
  visit(value, (entry) => {
    if (typeof entry.title !== 'string' || !Array.isArray(entry.tests)) return
    for (const test of entry.tests)
      if (isRecord(test) && typeof test.status === 'string')
        tests.push({ suiteTitle: entry.title as string, status: test.status })
  })
  return tests
}

function evidenceValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(evidenceValue)
  if (typeof value === 'string') return [value]
  return [JSON.stringify(value)]
}

function failureEvidence(value: unknown): {
  messages: string[]
  attachments: Map<string, unknown[]>
} {
  const messages: string[] = []
  const attachments = new Map<string, unknown[]>()
  visit(value, (entry) => {
    if (entry.status !== 'unexpected' || !Array.isArray(entry.results)) return
    for (const result of entry.results) {
      if (!isRecord(result)) continue
      if (isRecord(result.error) && typeof result.error.message === 'string')
        messages.push(result.error.message)
      if (!Array.isArray(result.attachments)) continue
      for (const attachment of result.attachments) {
        if (
          !isRecord(attachment) ||
          typeof attachment.name !== 'string' ||
          attachment.contentType !== 'application/json' ||
          typeof attachment.body !== 'string'
        )
          continue
        let decoded: unknown
        try {
          decoded = JSON.parse(
            Buffer.from(attachment.body, 'base64').toString('utf8')
          )
        } catch {
          throw new Error(`${attachment.name} attachment is not valid JSON`)
        }
        const prior = attachments.get(attachment.name) ?? []
        attachments.set(attachment.name, [...prior, decoded])
      }
    }
  })
  return { messages, attachments }
}

export function parseTierSessions(value: string): TierSession[] {
  return [
    ...value.matchAll(
      /\[tier-session\] pid=(\d+) tier=(S[1239]) pageId=([^\s]+)/g
    )
  ].map(([, pid, tier, pageId]) => ({ pid, tier, pageId }))
}

export function validateProofResult(input: {
  result: unknown
  row: ProofRow
  expectedCollected: number
  suiteOutcome: string
  log: string
}): string[] {
  const { result, row, expectedCollected, suiteOutcome, log } = input
  const stats = parseStats(result)
  const collected = Object.values(stats).reduce((sum, value) => sum + value, 0)
  if (collected !== expectedCollected)
    throw new Error(
      `S${row} collected ${collected}; expected ${expectedCollected}`
    )
  if (
    stats.expected !== expectedCollected - 1 ||
    stats.unexpected !== 1 ||
    stats.skipped !== 0 ||
    stats.flaky !== 0
  )
    throw new Error(
      `S${row} expected=${stats.expected} unexpected=${stats.unexpected} skipped=${stats.skipped} flaky=${stats.flaky}`
    )
  if (suiteOutcome !== 'failure')
    throw new Error(`S${row} did not break its witness`)
  const proof = PROOFS[row]
  const tests = collectTests(result)
  const isTargetTier = (suiteTitle: string) =>
    row === '15'
      ? suiteTitle === proof.title
      : suiteTitle.startsWith(`S${row}:`)
  if (
    !tests.some(
      ({ suiteTitle, status }) =>
        isTargetTier(suiteTitle) && status === 'unexpected'
    )
  )
    throw new Error(`S${row} target tier did not fail`)
  if (
    tests.some(
      ({ suiteTitle, status }) =>
        /^S(1|2|3|9):/.test(suiteTitle) &&
        !isTargetTier(suiteTitle) &&
        status !== 'expected'
    )
  )
    throw new Error(`a tier other than S${row} did not pass independently`)
  const evidence = failureEvidence(result)
  const lines = [
    ...evidence.messages,
    ...[...evidence.attachments.values()].flatMap((values) =>
      values.flatMap(evidenceValue)
    )
  ]
  const text = lines.join('\n')
  if (!text.includes(`[${proof.witness}]`) && row !== '15')
    throw new Error(`S${row} failure did not belong to ${proof.witness}`)
  if (!proof.pattern.test(text))
    throw new Error(`S${row} failure was not attributable to its mutation`)
  if (row === '15') return lines
  const packFailures = evidence.attachments.get(`s${row}-failures.json`)
  if (
    packFailures?.length !== 1 ||
    !Array.isArray(packFailures[0]) ||
    packFailures[0].length !== 1
  )
    throw new Error(`S${row} did not produce exactly one pack failure`)
  const sessions = parseTierSessions(log)
  if (sessions.length !== expectedCollected)
    throw new Error(
      `S${row} recorded ${sessions.length} tier sessions; expected ${expectedCollected}`
    )
  if (new Set(sessions.map(({ pageId }) => pageId)).size !== expectedCollected)
    throw new Error(`S${row} reused an application page between tiers`)
  const pids = new Set(sessions.map(({ pid }) => pid))
  if (proof.nextTier === undefined) {
    if (pids.size !== 1) throw new Error(`S${row} used ${pids.size} workers`)
  } else {
    if (pids.size !== 2) throw new Error(`S${row} used ${pids.size} workers`)
    const currentPid = sessions.find(({ tier }) => tier === `S${row}`)?.pid
    const nextPid = sessions.find(({ tier }) => tier === proof.nextTier)?.pid
    if (
      currentPid === undefined ||
      nextPid === undefined ||
      currentPid === nextPid
    )
      throw new Error(`${proof.nextTier} did not run in a replacement worker`)
  }
  return lines
}

function output(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} exited ${result.status}`)
  return result.stdout.trim()
}

function requireResults(): unknown {
  if (!existsSync('custom-nodes-results.json'))
    throw new Error(
      `suite wrote no results JSON (${process.env.SUITE_OUTCOME ?? 'unknown'})`
    )
  return JSON.parse(readFileSync('custom-nodes-results.json', 'utf8'))
}

export function main(): void {
  const mode = process.argv[2]
  const result = requireResults()
  if (mode === 'ordinary') {
    const expected = process.env.GREP_FILTER
      ? undefined
      : Number(
          output('pnpm', ['--silent', 'custom-node-shard', '--expected-tests'])
        )
    validateOrdinaryResult(parseStats(result), expected)
    return
  }
  if (mode !== 'proof') throw new Error('expected ordinary or proof mode')
  const row = process.env.PROOF_ROW
  if (!(row && row in PROOFS)) throw new Error(`invalid proof row: ${row}`)
  const proofRow = row as ProofRow
  const expectedCollected =
    proofRow === '15'
      ? 1
      : Number(
          output('pnpm', [
            '--silent',
            'custom-node-shard',
            '--expected-tier-tests'
          ])
        )
  const lines = validateProofResult({
    result,
    row: proofRow,
    expectedCollected,
    suiteOutcome: process.env.SUITE_OUTCOME ?? '',
    log: readFileSync('custom-nodes.log', 'utf8')
  })
  writeFileSync('tier-isolation-proof-evidence.txt', `${lines.join('\n')}\n`)
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  try {
    main()
  } catch (error) {
    console.error(
      `::error::${error instanceof Error ? error.message : String(error)}`
    )
    process.exitCode = 1
  }
}
