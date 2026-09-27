import {
  WORKSHOP_CLOUD_BASE_URL,
  WORKSHOP_ROUTER_BASE_URL
} from './workshop-env'

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
  readonly sourceUrl?: string
  readonly rehost?: boolean
  readonly urlAlternative?: boolean
}

interface FileReference {
  readonly index: number
  readonly kind: 'url' | 'base64' | 'data-url'
}

function fileReference(
  value: unknown,
  files: readonly SnippetFile[]
): FileReference | undefined {
  for (const [index, file] of files.entries()) {
    if (value === file.token)
      return { index, kind: file.encoding === 'url' ? 'url' : 'base64' }
    const prefix = `data:${file.mimeType};base64,`
    if (value === prefix + file.token)
      return { index, kind: file.urlAlternative ? 'url' : 'data-url' }
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
  if (file?.kind === 'data-url')
    return `"data:" + mime_${file.index + 1} + ";base64," + input_${file.index + 1}`
  if (file) return `${file.kind === 'url' ? 'url' : 'input'}_${file.index + 1}`
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
        const mime = mimeFile(value, files)
        const rendered =
          mime !== undefined && (key === 'mimeType' || key === 'mime_type')
            ? `mime_${mime + 1}`
            : renderInput(child, language, files, depth + 1)
        return `${property}: ${rendered}`
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

function curlFileValue(file: SnippetFile, kind: FileReference['kind']) {
  return kind === 'url' && !file.rehost ? file.sourceUrl : undefined
}

function omitFiles(
  value: unknown,
  files: readonly SnippetFile[],
  root = false
): unknown {
  const reference = fileReference(value, files)
  if (reference) return curlFileValue(files[reference.index], reference.kind)
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

function mimeFile(value: object, files: readonly SnippetFile[]) {
  const entries = Object.entries(value)
  const index = files.findIndex(
    (file) =>
      file.encoding !== 'url' &&
      entries.some(([, child]) => child === file.token) &&
      entries.some(
        ([key, child]) =>
          (key === 'mimeType' || key === 'mime_type') && child === file.mimeType
      )
  )
  return index < 0 ? undefined : index
}

function fileUses(body: unknown, files: readonly SnippetFile[]) {
  const uses = files.map(() => ({ base64: false, url: false, mime: false }))
  function visit(value: unknown) {
    const file = fileReference(value, files)
    if (file) {
      if (file.kind === 'url') uses[file.index].url = true
      else uses[file.index].base64 = true
      if (file.kind === 'data-url') uses[file.index].mime = true
    }
    if (!value || typeof value !== 'object') return
    const mime = mimeFile(value, files)
    if (mime !== undefined) uses[mime].mime = true
    Object.values(value).forEach(visit)
  }
  visit(body)
  return uses
}

export function hasOmittedCurlFiles(
  body: Readonly<Record<string, unknown>>,
  files: readonly SnippetFile[]
): boolean {
  return fileUses(body, files).some(
    (use, index) =>
      use.base64 ||
      (use.url && (!files[index].sourceUrl || files[index].rehost))
  )
}

interface SnippetOptions {
  readonly files?: readonly SnippetFile[]
  readonly output?: 'json' | 'binary'
}

type FileUse = ReturnType<typeof fileUses>[number]
interface InputFile extends SnippetFile, FileUse {
  readonly path: string
  readonly index: number
}

function inputFiles(body: unknown, files: readonly SnippetFile[]): InputFile[] {
  const uses = fileUses(body, files)
  const paths = filePaths(files)
  return files.map((file, index) => ({
    ...file,
    ...uses[index],
    path: paths[index],
    index: index + 1
  }))
}

function pythonFileUrl(file: InputFile): string[] {
  const { index: n, sourceUrl, path, rehost } = file
  if (!sourceUrl)
    return [
      `url_${n} = (await client.assets.from_file(${JSON.stringify(path)}).get_download_url()).url`
    ]
  if (!rehost) return [`url_${n} = ${JSON.stringify(sourceUrl)}`]
  return [
    `asset_${n} = await client.assets.from_url(${JSON.stringify(sourceUrl)})`,
    `url_${n} = (await asset_${n}.get_download_url()).url`
  ]
}

function pythonFileBytes(file: InputFile): string[] {
  const { index: n, sourceUrl, path } = file
  if (!sourceUrl)
    return [
      `input_${n} = base64.b64encode(Path(${JSON.stringify(path)}).read_bytes()).decode("ascii")`
    ]
  return [
    `download_${n} = await http.get(${JSON.stringify(sourceUrl)})`,
    `download_${n}.raise_for_status()`,
    `input_${n} = base64.b64encode(download_${n}.content).decode("ascii")`
  ]
}

function pythonFileMime(file: InputFile): string[] {
  const { index: n, sourceUrl, path } = file
  if (sourceUrl)
    return [`mime_${n} = download_${n}.headers["content-type"].split(";")[0]`]
  return [
    `mime_${n} = mimetypes.guess_type(${JSON.stringify(path)})[0]`,
    `if not mime_${n}: raise ValueError("Cannot determine the input file's MIME type")`
  ]
}

function pythonFile(file: InputFile): string[] {
  return [
    ...(file.url ? pythonFileUrl(file) : []),
    ...(file.base64 ? pythonFileBytes(file) : []),
    ...(file.mime ? pythonFileMime(file) : [])
  ]
}

function pythonImports(needs: {
  sdk: boolean
  base64: boolean
  mime: boolean
  http: boolean
  binary: boolean
}): string[] {
  return [
    '# Python 3.10+: pip install comfy-sdk==0.2.0',
    'import asyncio',
    'import os',
    ...(needs.sdk ? ['from comfy_sdk import AsyncComfy'] : []),
    ...(needs.base64 ? ['import base64'] : []),
    ...(needs.binary || needs.base64 ? ['from pathlib import Path'] : []),
    ...(needs.mime ? ['import mimetypes'] : []),
    ...(needs.http ? ['import httpx'] : []),
    ...(needs.binary ? ['from uuid import uuid4'] : [])
  ]
}

function pythonContexts(
  sdk: boolean,
  binary: boolean,
  downloads: boolean
): string[] {
  return [
    ...(sdk ? ['AsyncComfy(api_key=api_key) as client'] : []),
    ...(binary || downloads
      ? [`httpx.AsyncClient(timeout=${binary ? 660 : 120}) as http`]
      : [])
  ]
}

function pythonSnippet(
  routerId: string,
  body: Readonly<Record<string, unknown>>,
  options: SnippetOptions
) {
  const files = options.files ?? []
  const uses = fileUses(body, files)
  const binary = options.output === 'binary'
  const uploads = uses.some(
    (use, index) => use.url && (!files[index].sourceUrl || files[index].rehost)
  )
  const downloads = uses.some(
    (use, index) => use.base64 && files[index].sourceUrl
  )
  const hasSdk = !binary || uploads
  const operation = binary
    ? [
        '# This endpoint can return binary data, which SDK 0.2 cannot decode.',
        'idempotency_key = str(uuid4())',
        `response = await http.post(os.environ["COMFY_ROUTER_BASE_URL"] + ${JSON.stringify('/v2/models/' + routerId.split('/').map(encodeURIComponent).join('/'))},`,
        '    headers={"X-API-Key": api_key, "Idempotency-Key": idempotency_key}, json=parameters)',
        'response.raise_for_status()',
        'if "json" in response.headers.get("content-type", ""):',
        '    print(response.json())',
        'else:',
        '    Path("output.bin").write_bytes(response.content)'
      ]
    : [
        `result = await client.models.run(${JSON.stringify(routerId)}, parameters)`,
        'print(result)'
      ]
  return [
    ...pythonImports({
      sdk: hasSdk,
      base64: uses.some((use) => use.base64),
      mime: uses.some((use) => use.mime),
      http: binary || downloads,
      binary
    }),
    '',
    'api_key = os.environ.get("COMFY_API_KEY", "").strip()',
    'if not api_key: raise RuntimeError("Set COMFY_API_KEY")',
    `os.environ.setdefault("COMFY_ROUTER_BASE_URL", ${JSON.stringify(WORKSHOP_ROUTER_BASE_URL)})`,
    ...(uploads
      ? [
          `os.environ.setdefault("COMFY_BASE_URL", ${JSON.stringify(WORKSHOP_CLOUD_BASE_URL)})`
        ]
      : []),
    '',
    'async def main():',
    `    async with ${pythonContexts(hasSdk, binary, downloads).join(', ')}:`,
    ...[
      ...inputFiles(body, files).flatMap(pythonFile),
      `parameters = ${renderInput(body, 'python', files)}`,
      ...operation
    ].flatMap((line) => line.split('\n').map((part) => '        ' + part)),
    '',
    'asyncio.run(main())'
  ].join('\n')
}

function typescriptFileUrl(file: InputFile): string[] {
  const { index: n, sourceUrl, path, rehost } = file
  if (!sourceUrl)
    return [
      `const { url: url_${n} } = await client.assets.fromFile(${JSON.stringify(path)}).getDownloadUrl()`
    ]
  if (!rehost) return [`const url_${n} = ${JSON.stringify(sourceUrl)}`]
  return [
    `const asset_${n} = await client.assets.fromUrl(${JSON.stringify(sourceUrl)})`,
    `const { url: url_${n} } = await asset_${n}.getDownloadUrl()`
  ]
}

function typescriptFileBytes(file: InputFile): string[] {
  const { index: n, sourceUrl, path } = file
  if (!sourceUrl)
    return [
      `const input_${n} = (await readFile(${JSON.stringify(path)})).toString("base64")`
    ]
  return [
    `const download_${n} = await fetch(${JSON.stringify(sourceUrl)}, { signal: AbortSignal.timeout(120_000) })`,
    `if (!download_${n}.ok) throw new Error("Input download failed")`,
    `const input_${n} = Buffer.from(await download_${n}.arrayBuffer()).toString("base64")`
  ]
}

function typescriptFileMime(file: InputFile): string[] {
  const { index: n, sourceUrl, path } = file
  const value = sourceUrl
    ? `download_${n}.headers.get("content-type")?.split(";")[0]`
    : `lookup(${JSON.stringify(path)})`
  return [
    `const mime_${n} = ${value}`,
    `if (!mime_${n}) throw new Error("Cannot determine the input file's MIME type")`
  ]
}

function typescriptFile(file: InputFile): string[] {
  return [
    ...(file.url ? typescriptFileUrl(file) : []),
    ...(file.base64 ? typescriptFileBytes(file) : []),
    ...(file.mime ? typescriptFileMime(file) : [])
  ]
}

function typescriptImports(
  sdkImports: readonly string[],
  fsImports: readonly string[],
  mime: boolean,
  binary: boolean
): string[] {
  const packages = [
    ...(sdkImports.length ? ['@comfyorg/sdk@0.2.0'] : []),
    ...(mime ? ['mime-types'] : [])
  ]
  return [
    `// Node 22+${packages.length ? ': npm install ' + packages.join(' ') : ''}`,
    ...(sdkImports.length
      ? [`import { ${sdkImports.join(', ')} } from "@comfyorg/sdk"`]
      : []),
    ...(fsImports.length
      ? [`import { ${fsImports.join(', ')} } from "node:fs/promises"`]
      : []),
    ...(mime ? ['import { lookup } from "mime-types"'] : []),
    ...(binary ? ['import { randomUUID } from "node:crypto"'] : [])
  ]
}

function typescriptSnippet(
  routerId: string,
  body: Readonly<Record<string, unknown>>,
  options: SnippetOptions
) {
  const files = options.files ?? []
  const uses = fileUses(body, files)
  const binary = options.output === 'binary'
  const uploads = uses.some(
    (use, index) => use.url && (!files[index].sourceUrl || files[index].rehost)
  )
  const mime = uses.some((use, index) => use.mime && !files[index].sourceUrl)
  const sdkImports = [
    ...(uploads ? ['Comfy'] : []),
    ...(!binary ? ['comfy'] : [])
  ]
  const operation = binary
    ? [
        '// This endpoint can return binary data, which SDK 0.2 cannot decode.',
        'const idempotencyKey = randomUUID()',
        `const response = await fetch(routerBaseUrl + ${JSON.stringify('/v2/models/' + routerId.split('/').map(encodeURIComponent).join('/'))}, {`,
        '  method: "POST",',
        '  headers: {"X-API-Key": apiKey, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey},',
        '  body: JSON.stringify(parameters), signal: AbortSignal.timeout(660_000)',
        '})',
        'if (!response.ok) throw new Error(await response.text())',
        'if (response.headers.get("Content-Type")?.includes("json")) {',
        '  console.log(await response.json())',
        '} else {',
        '  await writeFile("output.bin", new Uint8Array(await response.arrayBuffer()))',
        '}'
      ]
    : [
        'comfy.config({ credentials: apiKey, baseUrl: routerBaseUrl })',
        `const { data, requestId } = await comfy.models.run(${JSON.stringify(routerId)}, parameters)`,
        'console.log({ requestId, data })'
      ]
  const fsImports = [
    ...(uses.some((use, index) => use.base64 && !files[index].sourceUrl)
      ? ['readFile']
      : []),
    ...(binary ? ['writeFile'] : [])
  ]
  return [
    ...typescriptImports(sdkImports, fsImports, mime, binary),
    '',
    'const apiKey = process.env.COMFY_API_KEY?.trim()',
    'if (!apiKey) throw new Error("Set COMFY_API_KEY")',
    `const routerBaseUrl = process.env.COMFY_ROUTER_BASE_URL ?? ${JSON.stringify(WORKSHOP_ROUTER_BASE_URL)}`,
    ...(uploads
      ? [
          `process.env.COMFY_BASE_URL ??= ${JSON.stringify(WORKSHOP_CLOUD_BASE_URL)}`,
          'const client = new Comfy({ apiKey })'
        ]
      : []),
    ...inputFiles(body, files).flatMap(typescriptFile),
    `const parameters = ${renderInput(body, 'typescript', files)}`,
    ...operation
  ].join('\n')
}

function curlSnippet(
  routerId: string,
  body: Readonly<Record<string, unknown>>,
  files: readonly SnippetFile[]
) {
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
  return [
    ': "${COMFY_API_KEY:?Set COMFY_API_KEY}"',
    "IDEMPOTENCY_KEY=$(python3 -c 'import uuid; print(uuid.uuid4())') || exit",
    '# A fresh key starts a new generation. For a retry, reuse the prepared body and key.',
    ...(hasOmittedCurlFiles(body, files)
      ? [
          '# Uploaded files are omitted. This request may be incomplete.',
          '# Use Python or TypeScript to include local files.'
        ]
      : []),
    '# To save a binary response, add --output output.bin to the command.',
    `curl --fail-with-body --max-time 660 --request POST ${quote(WORKSHOP_ROUTER_BASE_URL + '/v2/models/' + routerId.split('/').map(encodeURIComponent).join('/'))} \\`,
    '  --header "X-API-Key: $COMFY_API_KEY" \\',
    '  --header "Content-Type: application/json" \\',
    '  --header "Idempotency-Key: $IDEMPOTENCY_KEY" \\',
    `  --data ${quote(JSON.stringify(omitFiles(body, files, true) ?? {}, null, 2))}`
  ].join('\n')
}

export function buildSnippet(
  language: SnippetLanguage,
  routerId: string,
  body: Readonly<Record<string, unknown>>,
  options: SnippetOptions = {}
): string {
  if (language === 'python') return pythonSnippet(routerId, body, options)
  if (language === 'typescript')
    return typescriptSnippet(routerId, body, options)
  return curlSnippet(routerId, body, options.files ?? [])
}
