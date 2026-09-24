import type { WorkflowField } from './workflow-fields'
import type { WorkflowGraph } from './workflow-execution'
import type { SnippetLanguage } from './models-snippets'

/**
 * What a developer needs to call one workflow themselves. Brought over from
 * the workflow prototype, with the curated record it was written against
 * replaced by the bindings this branch already carries.
 *
 * A workflow with a server of its own reads COMFY_BASE_URL from the
 * environment rather than naming Cloud, so the snippet is what they would
 * run against their own deployment and never our address.
 */
export interface SnippetWorkflow {
  readonly fields: readonly WorkflowField[]
  /** Names the file the snippet loads the graph from. */
  readonly slug: string
  readonly ownDeployment: boolean
}

export const WORKFLOW_API_BASE = 'https://cloud.comfy.org'
export const WORKFLOW_JOB_PATH = '/api/v2/jobs'

export function workflowInputs(
  workflow: SnippetWorkflow,
  graph: WorkflowGraph,
  values: Readonly<Record<string, string | number>> = {}
) {
  return workflow.fields.map((field) => {
    const key = `${field.node}.${field.input}`
    const media = ['image', 'video', 'audio'].includes(field.kind)
    const value = values[key] ?? graph[field.node].inputs[field.input]
    const filename = media
      ? String(
          value ||
            `${field.input}.${field.kind === 'image' ? 'png' : field.kind === 'video' ? 'mp4' : 'mp3'}`
        )
          .split(/[\\/]/)
          .at(-1)!
      : undefined
    return {
      ...field,
      value: field.kind === 'number' ? Number(value) : String(value),
      filename
    }
  })
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`
}

export function buildWorkflowSnippet(
  language: SnippetLanguage,
  workflow: SnippetWorkflow,
  graph: WorkflowGraph,
  values: Readonly<Record<string, string | number>> = {}
): string {
  const inputs = workflowInputs(workflow, graph, values)
  const file = `${workflow.slug}.api.json`
  const deployed = workflow.ownDeployment
  if (language === 'python') {
    const bindings = inputs
      .map(
        ({ node, input, value, filename }) =>
          `workflow.set_input(${JSON.stringify(node)}, ${JSON.stringify(input)}, ${filename ? `client.assets.from_file(${JSON.stringify(filename)})` : JSON.stringify(value)})`
      )
      .join('\n')
    return `import os
from pathlib import Path
from comfy_sdk import Comfy

${deployed ? 'if not os.environ.get("COMFY_BASE_URL"):\n    raise ValueError("Set COMFY_BASE_URL to your active deployment URL")' : `os.environ["COMFY_BASE_URL"] = "${WORKFLOW_API_BASE}"`}
api_key = os.environ["COMFY_API_KEY"]
client = Comfy(api_key=api_key)
workflow = client.workflows.from_file(${JSON.stringify(file)})

${bindings}

job = client.submit(workflow, api_key=api_key)
print("Job ID:", job.id)
job.result()
Path("results").mkdir(exist_ok=True)
for index, output in enumerate(job.outputs):
    output.to_file(str(Path("results") / f"{index}-{Path(output.name).name}"))`
  }
  if (language === 'typescript') {
    const bindings = inputs
      .map(
        ({ node, input, value, filename }) =>
          `workflow.setInput(${JSON.stringify(node)}, ${JSON.stringify(input)}, ${filename ? `client.assets.fromFile(${JSON.stringify(filename)})` : JSON.stringify(value)});`
      )
      .join('\n')
    return `import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { Comfy } from "@comfyorg/sdk";

${deployed ? 'if (!process.env.COMFY_BASE_URL) {\n  throw new Error("Set COMFY_BASE_URL to your active deployment URL");\n}' : `process.env.COMFY_BASE_URL = "${WORKFLOW_API_BASE}";`}
const apiKey = process.env.COMFY_API_KEY;
if (!apiKey) throw new Error("Set COMFY_API_KEY");
const client = new Comfy({ apiKey });
const workflow = await client.workflows.fromFile(${JSON.stringify(file)});

${bindings}

const job = await client.submit(workflow, { apiKey });
console.log("Job ID:", job.id);
await job.result();
await mkdir("results", { recursive: true });
for (const [index, output] of job.outputs.entries()) {
  await output.toFile(join("results", String(index) + "-" + basename(output.name)));
}`
  }
  const uploads = inputs
    .flatMap(({ node, input, filename, value }, index) => {
      const path = `[${JSON.stringify(node)}].inputs[${JSON.stringify(input)}]`
      if (!filename)
        return [
          `WORKFLOW=$(printf '%s' "$WORKFLOW" | jq --argjson value ${shellQuote(JSON.stringify(value))} ${shellQuote(`.${path} = $value`)})`
        ]
      const extension = filename.split('.').at(-1)?.toLowerCase()
      const mimeTypes: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        mp4: 'video/mp4',
        webm: 'video/webm',
        mov: 'video/quicktime',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        flac: 'audio/flac'
      }
      return [
        `ASSET_${index}=$(curl --fail-with-body --silent --show-error "$BASE_URL/api/v2/assets" \\
  -H "Authorization: Bearer $COMFY_API_KEY" \\
  -F ${shellQuote(`file=@${filename}`)} \\
  --form-string ${shellQuote(`file_path=${filename}`)} \\
  --form-string ${shellQuote(`content_type=${mimeTypes[extension ?? ''] ?? 'application/octet-stream'}`)} | jq -er '.id')
WORKFLOW=$(printf '%s' "$WORKFLOW" | jq --arg id "$ASSET_${index}" ${shellQuote(`.${path} = {"__type":"core/ASSET","info":{"id":$id}}`)})`
      ]
    })
    .join('\n\n')
  return `set -euo pipefail
: "\${COMFY_API_KEY:?Set COMFY_API_KEY}"
${deployed ? ': "${COMFY_BASE_URL:?Set COMFY_BASE_URL to your active deployment URL}"\nBASE_URL="${COMFY_BASE_URL%/}"' : `BASE_URL="${WORKFLOW_API_BASE}"`}
WORKFLOW=$(cat ${shellQuote(file)})

${uploads}

KEY=$(uuidgen)
printf '%s' "$WORKFLOW" | jq --arg key "$COMFY_API_KEY" \\
  '{workflow: ., extra_data: {api_key_comfy_org: $key}}' | \\
curl --fail-with-body --silent --show-error "$BASE_URL${WORKFLOW_JOB_PATH}" \\
  -H "Authorization: Bearer $COMFY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $KEY" \\
  --data-binary @- > job.json

jq '{id, status, urls}' job.json
JOB_URL=$(jq -er '.urls.self' job.json)
case "$JOB_URL" in
  /*) JOB_URL="$BASE_URL$JOB_URL" ;;
  "$BASE_URL"/*) ;;
  *) echo "Unexpected job URL" >&2; exit 1 ;;
esac
curl --fail-with-body --silent --show-error \\
  -H "Authorization: Bearer $COMFY_API_KEY" "$JOB_URL" | jq .`
}
