import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const PROOFS = {
  '1': {
    witness: 'comfyui-impact-pack',
    testIdentity:
      'S1: every enrolled registered node mounts on the canvas renderer',
    failurePattern:
      'ImpactInt: instance is missing declared input \\"value\\" \\(litegraph\\)'
  },
  '2': {
    witness: 'comfyui-impact-pack',
    testIdentity:
      'S2: every enrolled registered node mounts on the DOM renderer',
    failurePattern: 'ImpactInt: Vue mounts 0 of 1 widgets'
  },
  '3': {
    witness: 'comfyui-impact-pack',
    testIdentity:
      'S3: enrolled registered-node save/reload outcomes match exact contracts',
    failurePattern:
      'ImpactInt: widgets_values \\[1\\] -> \\[0\\] on set-values reload'
  },
  '9': {
    witness: 'comfyui-videohelpersuite',
    testIdentity: 'S9: calibrated model-free node corpus executes',
    failurePattern: 'DETECTION PROOF \\(row 9\\): pack node runtime failure'
  },
  '15': {
    witness: 'ComfyUI-Impact-Pack',
    testIdentity: 'Curated workflow execution: completes without error',
    failurePattern:
      'ComfyUI-Impact-Pack/impact_primitives_run\\.json 2: output hash changed'
  }
} as const

type ProofRow = keyof typeof PROOFS

function proofRow(value: string | undefined): ProofRow {
  if (!(value && value in PROOFS))
    throw new Error(`invalid proof row: ${value}`)
  return value as ProofRow
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} exited ${result.status}`)
}

function output(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} exited ${result.status}`)
  return result.stdout.trim()
}

function digest(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function actionOutputs(values: Record<string, string>): void {
  const path = process.env.GITHUB_OUTPUT
  if (!path) throw new Error('GITHUB_OUTPUT is not set')
  appendFileSync(
    path,
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}\n`)
      .join('')
  )
}

export function mutateExecutionSource(value: string): string {
  const pattern =
    /(class LoadAudioUpload:.*?def load_audio\(self, start_time=0, duration=0, \*\*kwargs\):)/s
  const replacement =
    '$1\n        raise ValueError("DETECTION PROOF (row 9): pack node runtime failure")'
  const mutated = value.replace(pattern, replacement)
  if (
    mutated === value ||
    (mutated.match(/DETECTION PROOF \(row 9\)/g) ?? []).length !== 1 ||
    !mutated.includes('"VHS_LoadAudioUpload": LoadAudioUpload')
  )
    throw new Error('could not apply the S9 execution mutation')
  return mutated
}

export function proofIdentity(input: {
  row: ProofRow
  sha: string
  mutationPath: string
  mutationDigest: string
}): string {
  const proof = PROOFS[input.row]
  if (!input.mutationPath) throw new Error('mutation path is missing')
  if (!/^[0-9a-f]{64}$/.test(input.mutationDigest))
    throw new Error('mutation digest is not a SHA-256 value')
  return [
    `proof_sha=${input.sha}`,
    `tier=S${input.row}`,
    `test_identity=${proof.testIdentity}`,
    `mutation_path=${input.mutationPath}`,
    `mutation_sha256=${input.mutationDigest}`,
    `expected_failure_regex=${proof.failurePattern}`,
    'workers=1',
    'retries=0',
    ''
  ].join('\n')
}

function mutateSource(row: ProofRow): void {
  const directory = join(
    'browser_tests',
    'tests',
    'customNodes',
    'detection-proof'
  )
  const prefix = `row-${row.padStart(2, '0')}-`
  const matches = readdirSync(directory).filter(
    (entry) => entry.startsWith(prefix) && entry.endsWith('.patch')
  )
  if (matches.length !== 1)
    throw new Error(`expected one patch for S${row}, found ${matches.length}`)
  const path = join(directory, matches[0])
  run('git', ['apply', '--check', path])
  run('git', ['apply', path])
  if (spawnSync('git', ['diff', '--quiet', '--', 'src/']).status === 0)
    throw new Error(`S${row} patch did not change src/`)
  actionOutputs({ path, digest: digest(path) })
}

function mutateExecution(): void {
  const path = join(
    'ComfyUI',
    'custom_nodes',
    'comfyui-videohelpersuite',
    'videohelpersuite',
    'nodes.py'
  )
  writeFileSync(path, mutateExecutionSource(readFileSync(path, 'utf8')))
  actionOutputs({ path, digest: digest(path) })
}

function writeIdentity(row: ProofRow): void {
  const contents = proofIdentity({
    row,
    sha: output('git', ['rev-parse', 'HEAD']),
    mutationPath: process.env.MUTATION_PATH ?? '',
    mutationDigest: process.env.MUTATION_DIGEST ?? ''
  })
  writeFileSync('tier-isolation-proof-identity.txt', contents)
  process.stdout.write(contents)
}

export function main(): void {
  const command = process.argv[2]
  const row = proofRow(process.env.PROOF_ROW)
  if (command === 'mutate-source') mutateSource(row)
  else if (command === 'mutate-execution' && row === '9') mutateExecution()
  else if (command === 'identity') writeIdentity(row)
  else throw new Error(`invalid proof command ${command} for S${row}`)
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
