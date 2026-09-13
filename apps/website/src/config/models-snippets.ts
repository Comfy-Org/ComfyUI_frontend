import { WORKSHOP_ROUTER_BASE_URL } from './workshop-env'
import { uploadSnippet } from './workshop-upload-snippets'

export type SnippetLanguage = 'python' | 'typescript' | 'curl'

export const SNIPPET_LANGUAGES: readonly SnippetLanguage[] = [
  'python',
  'typescript',
  'curl'
]

export interface SnippetFile {
  readonly token: string
  readonly name: string
  readonly mimeType: string
  readonly encoding?: 'base64' | 'url'
}

function fileReference(value: unknown, files: readonly SnippetFile[]) {
  for (const [index, file] of files.entries()) {
    if (value === file.token) return { index, prefix: '' }
    const prefix = `data:${file.mimeType};base64,`
    if (value === prefix + file.token) return { index, prefix }
  }
  return undefined
}

function renderInput(
  value: unknown,
  language: 'python' | 'typescript',
  files: readonly SnippetFile[],
  depth = 0
): string {
  const file = fileReference(value, files)
  if (file)
    return `${file.prefix ? JSON.stringify(file.prefix) + ' + ' : ''}input_${file.index + 1}`
  if (value === null) return language === 'python' ? 'None' : 'null'
  if (typeof value === 'boolean' && language === 'python')
    return value ? 'True' : 'False'
  if (typeof value !== 'object') return JSON.stringify(value)
  const pad = '  '.repeat(depth)
  const childPad = '  '.repeat(depth + 1)
  const array = Array.isArray(value)
  const entries = array
    ? value.map((child) => renderInput(child, language, files, depth + 1))
    : Object.entries(value).map(([key, child]) => {
        const quoted = JSON.stringify(key)
        const property =
          language === 'typescript' && key === '__proto__'
            ? `[${quoted}]`
            : quoted
        return `${property}: ${renderInput(child, language, files, depth + 1)}`
      })
  const [open, close] = array ? ['[', ']'] : ['{', '}']
  return entries.length
    ? `${open}\n${entries.map((entry) => childPad + entry).join(',\n')}\n${pad}${close}`
    : open + close
}

const IMAGE_METADATA = new Set([
  'type',
  'role',
  'mimeType',
  'mime_type',
  'referenceType'
])

function omitFiles(
  value: unknown,
  files: readonly SnippetFile[],
  root = false
): unknown {
  if (fileReference(value, files)) return undefined
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    const kept = value
      .map((child) => omitFiles(child, files))
      .filter((child) => child !== undefined)
    return value.length && !kept.length ? undefined : kept
  }
  const entries = Object.entries(value)
  const kept = entries
    .map(([key, child]) => [key, omitFiles(child, files)] as const)
    .filter(([, child]) => child !== undefined)
  if (
    !root &&
    kept.length < entries.length &&
    kept.every(([key]) => IMAGE_METADATA.has(key))
  )
    return undefined
  return Object.fromEntries(kept)
}

function filePaths(files: readonly SnippetFile[]): string[] {
  const names = files.map((file) => file.name.split(/[\\/]/).at(-1) || 'input')
  return names.map((name, index) =>
    names.indexOf(name) !== names.lastIndexOf(name)
      ? `input_${index + 1}-${name}`
      : name
  )
}

export function buildSnippet(
  language: SnippetLanguage,
  routerId: string,
  body: Readonly<Record<string, unknown>>,
  idempotencyKey: string,
  files: readonly SnippetFile[] = []
): string {
  const endpoint = `${WORKSHOP_ROUTER_BASE_URL}/v2/models/${routerId.split('/').map(encodeURIComponent).join('/')}`
  const json = JSON.stringify(body, null, 2)
  const key = JSON.stringify(idempotencyKey)
  if (!idempotencyKey) throw new Error('Missing idempotency key')
  const paths = filePaths(files)
  const hasUploads = files.some((file) => file.encoding === 'url')
  if (language === 'python') {
    return [
      ...(files.length ? ['import base64', 'from pathlib import Path'] : []),
      ...(!files.length ? ['import json'] : []),
      'import os',
      'import requests',
      '',
      ...(hasUploads ? uploadSnippet('python') : []),
      ...(files.length
        ? [
            '# Set these paths to your local input files.',
            ...paths.map(
              (path, index) =>
                `input_${index + 1} = ${
                  files[index].encoding === 'url'
                    ? `upload_file(${JSON.stringify(path)}, ${JSON.stringify(files[index].mimeType || 'application/octet-stream')})`
                    : `base64.b64encode(Path(${JSON.stringify(path)}).read_bytes()).decode("ascii")`
                }`
            ),
            ''
          ]
        : []),
      ...(hasUploads
        ? [
            '# For retries, reuse these prepared inputs and the same key; do not rerun uploads.'
          ]
        : []),
      `response = requests.post(${JSON.stringify(endpoint)},`,
      '    headers={',
      '        "X-API-Key": os.environ["COMFY_API_KEY"],',
      `        "Idempotency-Key": ${key},`,
      '    },',
      `    json=${files.length ? renderInput(body, 'python', files, 2) : `json.loads(${JSON.stringify(json)})`},`,
      '    timeout=660,',
      ')',
      'response.raise_for_status()',
      'if "json" in response.headers.get("Content-Type", ""):',
      '    print(response.json())',
      'else:',
      '    with open("output.bin", "wb") as output:',
      '        output.write(response.content)'
    ].join('\n')
  }
  if (language === 'typescript') {
    return [
      ...(files.length
        ? ['import { readFile } from "node:fs/promises"', '']
        : []),
      'const apiKey = process.env.COMFY_API_KEY',
      'if (!apiKey) throw new Error("Set COMFY_API_KEY")',
      ...(hasUploads ? uploadSnippet('typescript') : []),
      ...(files.length
        ? [
            '// Set these paths to your local input files.',
            ...paths.map(
              (path, index) =>
                `const input_${index + 1} = ${
                  files[index].encoding === 'url'
                    ? `await uploadFile(${JSON.stringify(path)}, ${JSON.stringify(files[index].mimeType || 'application/octet-stream')})`
                    : `(await readFile(${JSON.stringify(path)})).toString("base64")`
                }`
            ),
            ''
          ]
        : []),
      ...(hasUploads
        ? [
            '// For retries, reuse these prepared inputs and the same key; do not rerun uploads.'
          ]
        : []),
      `const response = await fetch(${JSON.stringify(endpoint)}, {`,
      '  method: "POST",',
      '  headers: {',
      '    "X-API-Key": apiKey,',
      '    "Content-Type": "application/json",',
      `    "Idempotency-Key": ${key},`,
      '  },',
      `  body: JSON.stringify(${renderInput(body, 'typescript', files, 1)}),`,
      '  signal: AbortSignal.timeout(660_000)',
      '})',
      'if (!response.ok) throw new Error(await response.text())',
      'if (response.headers.get("Content-Type")?.includes("json")) {',
      '  console.log(await response.json())',
      '} else {',
      '  const { writeFile } = await import("node:fs/promises")',
      '  await writeFile("output.bin", new Uint8Array(await response.arrayBuffer()))',
      '}'
    ].join('\n')
  }
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
  return [
    ...(files.length
      ? [
          '# Uploaded files are omitted. This request may be incomplete.',
          '# Use Python or TypeScript to include local files.',
          ''
        ]
      : []),
    '# To save a binary response, add --output output.bin to the command.',
    `curl --fail-with-body --max-time 660 --request POST ${quote(endpoint)} \\`,
    '  --header "X-API-Key: $COMFY_API_KEY" \\',
    '  --header "Content-Type: application/json" \\',
    `  --header ${quote(`Idempotency-Key: ${idempotencyKey}`)} \\`,
    `  --data ${quote(JSON.stringify(omitFiles(body, files, true) ?? {}, null, 2))}`
  ].join('\n')
}
