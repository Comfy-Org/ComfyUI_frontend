#!/usr/bin/env tsx
import { randomUUID } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

import { applyEdits, modify, parse } from 'jsonc-parser'
import type { FormattingOptions, ParseError } from 'jsonc-parser'

type SettingValue = boolean | string
type Tool = 'amp' | 'claude' | 'codex'
type Outcome =
  | 'already configured'
  | 'error'
  | 'updated'
  | 'workspace setting required'

interface Setting {
  path: string[]
  value: SettingValue
}

interface UpdateResult {
  tool: Tool
  outcome: Outcome
  detail?: string
}

const CLAUDE_SETTINGS: Setting[] = [
  { path: ['attribution', 'commit'], value: '' },
  { path: ['attribution', 'pr'], value: '' },
  { path: ['attribution', 'sessionUrl'], value: false }
]

const AMP_SETTINGS: Setting[] = [
  { path: ['amp.git.commit.ampThread.enabled'], value: false },
  { path: ['amp.git.commit.coauthor.enabled'], value: false }
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readPath(value: unknown, path: string[]): unknown {
  let current = value
  for (const key of path) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return current
}

function formattingOptions(content: string): FormattingOptions {
  return {
    insertSpaces: true,
    tabSize: 2,
    eol: content.includes('\r\n') ? '\r\n' : '\n'
  }
}

function parseSettings(content: string): Record<string, unknown> {
  const errors: ParseError[] = []
  const parsed: unknown = parse(content, errors, {
    allowTrailingComma: true,
    disallowComments: false
  })
  if (errors.length > 0 || !isRecord(parsed)) {
    throw new Error('settings file is not a valid JSON object')
  }
  return parsed
}

function writeSettings(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true })
  const temporaryPath = `${path}.${randomUUID()}.tmp`
  const mode = existsSync(path) ? statSync(path).mode & 0o777 : 0o600

  try {
    writeFileSync(temporaryPath, content, { flag: 'wx', mode })
    renameSync(temporaryPath, path)
    chmodSync(path, mode)
  } finally {
    rmSync(temporaryPath, { force: true })
  }
}

function updateSettingsFile(path: string, settings: Setting[]): Outcome {
  let content = existsSync(path) ? readFileSync(path, 'utf8') : '{}\n'
  const parsed = parseSettings(content)
  if (settings.every(({ path, value }) => readPath(parsed, path) === value)) {
    return 'already configured'
  }

  const options = formattingOptions(content)
  for (const setting of settings) {
    content = applyEdits(
      content,
      modify(content, setting.path, setting.value, {
        formattingOptions: options
      })
    )
  }
  parseSettings(content)
  writeSettings(path, content)
  return 'updated'
}

function ampSettingsPath(home: string): string {
  const directory = join(home, '.config', 'amp')
  const jsonPath = join(directory, 'settings.json')
  const jsoncPath = join(directory, 'settings.jsonc')
  if (existsSync(jsonPath) && existsSync(jsoncPath)) {
    throw new Error('both settings.json and settings.jsonc exist')
  }
  return existsSync(jsoncPath) ? jsoncPath : jsonPath
}

function updateTool(tool: Tool, update: () => Outcome): UpdateResult {
  try {
    return { tool, outcome: update() }
  } catch (error) {
    return {
      tool,
      outcome: 'error',
      detail: error instanceof Error ? error.message : 'unknown error'
    }
  }
}

export function updateAttributionSettings(home: string): UpdateResult[] {
  return [
    updateTool('claude', () =>
      updateSettingsFile(
        join(home, '.claude', 'settings.json'),
        CLAUDE_SETTINGS
      )
    ),
    updateTool('amp', () =>
      updateSettingsFile(ampSettingsPath(home), AMP_SETTINGS)
    ),
    { tool: 'codex', outcome: 'workspace setting required' }
  ]
}

export function formatResults(results: UpdateResult[]): string {
  return results
    .map(({ tool, outcome, detail }) =>
      detail ? `${tool}: ${outcome} (${detail})` : `${tool}: ${outcome}`
    )
    .join('\n')
}

function main() {
  const { values } = parseArgs({
    options: { home: { type: 'string', default: homedir() } }
  })
  const results = updateAttributionSettings(values.home)
  process.stdout.write(`${formatResults(results)}\n`)
  if (results.some(({ outcome }) => outcome === 'error')) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
