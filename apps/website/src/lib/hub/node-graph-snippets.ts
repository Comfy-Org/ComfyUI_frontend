import type { SnippetLanguage } from '@/config/models-snippets'
import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'

/** The default address of a ComfyUI running on the reader's own machine. */
export const LOCAL_COMFY_BASE_URL = 'http://127.0.0.1:8188'

const API_GRAPH_FILE = 'workflow_api.json'
const literal = (value: string) => JSON.stringify(value)

function curlSnippet(baseUrl: string, cloud: boolean): string {
  return [
    ...(cloud ? ['# Replace YOUR_API_KEY with a key from your account.'] : []),
    `curl --fail-with-body --request POST '${baseUrl}/api/prompt' \\`,
    ...(cloud ? [`  --header 'X-API-Key: YOUR_API_KEY' \\`] : []),
    `  --header 'Content-Type: application/json' \\`,
    `  --data "$(jq '{prompt: .}' ${API_GRAPH_FILE})"`
  ].join('\n')
}

function pythonSnippet(baseUrl: string, cloud: boolean): string {
  const keyLines = [
    'api_key = os.environ.get("COMFY_API_KEY", "").strip()',
    'if not api_key: raise RuntimeError("Set COMFY_API_KEY")'
  ]
  return [
    '# Python 3.10+: pip install comfy-sdk==0.4.0',
    'import json',
    'import os',
    '',
    'from comfy_sdk import Comfy',
    '',
    ...(cloud ? keyLines : []),
    `os.environ.setdefault("COMFY_BASE_URL", ${literal(baseUrl)})`,
    cloud ? 'client = Comfy(api_key=api_key)' : 'client = Comfy()',
    `with open(${literal(API_GRAPH_FILE)}) as file:`,
    '    workflow = client.workflows.from_json(json.load(file))',
    '',
    cloud
      ? 'job = client.run(workflow, api_key=api_key)'
      : 'job = client.run(workflow)',
    '# Use the id of the save node in your exported graph.',
    'for output in job.get_outputs("<output-node-id>"):',
    '    output.to_file(output.name)'
  ].join('\n')
}

function typeScriptSnippet(baseUrl: string, cloud: boolean): string {
  const keyLines = [
    'const apiKey = process.env.COMFY_API_KEY?.trim()',
    'if (!apiKey) throw new Error("Set COMFY_API_KEY")'
  ]
  return [
    '// Node 22+: npm install @comfyorg/sdk@0.4.0',
    "import { readFile } from 'node:fs/promises'",
    "import { Comfy } from '@comfyorg/sdk'",
    '',
    ...(cloud ? keyLines : []),
    `process.env.COMFY_BASE_URL ??= ${literal(baseUrl)}`,
    cloud
      ? 'const client = new Comfy({ apiKey })'
      : 'const client = new Comfy()',
    'const workflow = client.workflows.fromJson(',
    `  JSON.parse(await readFile(${literal(API_GRAPH_FILE)}, 'utf8'))`,
    ')',
    '',
    cloud
      ? 'const job = await client.run(workflow, { apiKey })'
      : 'const job = await client.run(workflow)',
    '// Use the id of the save node in your exported graph.',
    "for (const output of job.getOutputs('<output-node-id>'))",
    '  await output.toFile(output.name)'
  ].join('\n')
}

const snippetBuilders: Record<
  SnippetLanguage,
  (baseUrl: string, cloud: boolean) => string
> = {
  curl: curlSnippet,
  python: pythonSnippet,
  typescript: typeScriptSnippet
}

/** Code that runs an exported API graph on Comfy Cloud or a local ComfyUI. */
export function nodeGraphSnippet(
  language: SnippetLanguage,
  cloud: boolean
): string {
  const baseUrl = cloud ? WORKSHOP_CLOUD_BASE_URL : LOCAL_COMFY_BASE_URL
  return snippetBuilders[language](baseUrl, cloud)
}
