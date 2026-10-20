import type { SnippetLanguage } from '@/config/models-snippets'
import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'

const API_GRAPH_FILE = 'workflow_api.json'
const literal = (value: string) => JSON.stringify(value)

function curlSnippet(): string {
  return [
    '# Set COMFY_API_KEY first. Partner nodes read it from extra_data too.',
    `curl --fail-with-body --request POST '${WORKSHOP_CLOUD_BASE_URL}/api/prompt' \\`,
    `  --header "X-API-Key: $COMFY_API_KEY" \\`,
    `  --header 'Content-Type: application/json' \\`,
    `  --data "$(jq --arg key "$COMFY_API_KEY" '{prompt: ., extra_data: {api_key_comfy_org: $key}}' ${API_GRAPH_FILE})"`
  ].join('\n')
}

function pythonSnippet(): string {
  return [
    '# Python 3.10+: pip install comfy-sdk==0.4.0',
    'import json',
    'import os',
    '',
    'from comfy_sdk import Comfy',
    '',
    'api_key = os.environ.get("COMFY_API_KEY", "").strip()',
    'if not api_key: raise RuntimeError("Set COMFY_API_KEY")',
    `os.environ.setdefault("COMFY_BASE_URL", ${literal(WORKSHOP_CLOUD_BASE_URL)})`,
    'client = Comfy(api_key=api_key)',
    `with open(${literal(API_GRAPH_FILE)}, encoding="utf-8") as file:`,
    '    workflow = client.workflows.from_json(json.load(file))',
    '',
    'job = client.run(workflow, api_key=api_key)',
    '# Use the id of the save node in your exported graph.',
    'for output in job.get_outputs("<output-node-id>"):',
    '    output.to_file(output.name)'
  ].join('\n')
}

function typeScriptSnippet(): string {
  return [
    '// Node 22+: npm install @comfyorg/sdk@0.4.0',
    "import { readFile } from 'node:fs/promises'",
    "import { Comfy } from '@comfyorg/sdk'",
    '',
    'const apiKey = process.env.COMFY_API_KEY?.trim()',
    'if (!apiKey) throw new Error("Set COMFY_API_KEY")',
    `process.env.COMFY_BASE_URL ??= ${literal(WORKSHOP_CLOUD_BASE_URL)}`,
    'const client = new Comfy({ apiKey })',
    'const workflow = client.workflows.fromJson(',
    `  JSON.parse(await readFile(${literal(API_GRAPH_FILE)}, 'utf8'))`,
    ')',
    '',
    'const job = await client.run(workflow, { apiKey })',
    '// Use the id of the save node in your exported graph.',
    "for (const output of job.getOutputs('<output-node-id>'))",
    '  await output.toFile(output.name)'
  ].join('\n')
}

const snippetBuilders: Record<SnippetLanguage, () => string> = {
  curl: curlSnippet,
  python: pythonSnippet,
  typescript: typeScriptSnippet
}

/** Code that runs an exported API graph on Comfy Cloud. */
export function nodeGraphSnippet(language: SnippetLanguage): string {
  return snippetBuilders[language]()
}
