import type { ApiSpec } from './apiSpec'
import { exampleRequestBody, isMediaParameter } from './apiSpec'

export const SNIPPET_LANGUAGES = ['javascript', 'python', 'curl'] as const

export type SnippetLanguage = (typeof SNIPPET_LANGUAGES)[number]

function indentBlock(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((line, index) => (index === 0 ? line : pad + line))
    .join('\n')
}

function jsonBody(spec: ApiSpec): string {
  return JSON.stringify(exampleRequestBody(spec), null, 2)
}

function pythonLiteral(value: string | number | boolean): string {
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  return JSON.stringify(value)
}

function pythonBody(spec: ApiSpec): string {
  const entries = Object.entries(exampleRequestBody(spec))
  if (!entries.length) return '{}'
  const lines = entries.map(
    ([name, value]) => `    ${JSON.stringify(name)}: ${pythonLiteral(value)},`
  )
  return `{\n${lines.join('\n')}\n}`
}

function hasMediaInput(spec: ApiSpec): boolean {
  return spec.parameters.some(isMediaParameter)
}

function curlSnippet(spec: ApiSpec): string {
  return `# Submit a job
# Optional: add "webhook_url": "https://your.app/comfy-webhook" to the body
# to be called back on completion instead of polling.
curl -X POST "${spec.submitUrl}" \\
  -H "Authorization: Bearer $COMFY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${jsonBody(spec)}'

# Poll for the result (response includes job_id)
curl "${spec.jobUrl}" \\
  -H "Authorization: Bearer $COMFY_API_KEY"`
}

function javascriptSnippet(spec: ApiSpec): string {
  const uploadHint = hasMediaInput(spec)
    ? `// Optional: upload a local file and use the returned URL as a media input
// const imageUrl = await comfy.storage.upload(file)

`
    : ''
  return `// npm install @comfyorg/client — reads COMFY_API_KEY from your environment
import { comfy } from '@comfyorg/client'

${uploadHint}const result = await comfy.subscribe('${spec.workflowId}', {
  input: ${indentBlock(jsonBody(spec), 2)},
  onQueueUpdate: (update) => console.log(update.status)
  // webhookUrl: 'https://your.app/comfy-webhook' — optional completion callback
})

console.log(result.outputs)`
}

function pythonSnippet(spec: ApiSpec): string {
  const uploadHint = hasMediaInput(spec)
    ? `# Optional: upload a local file and use the returned URL as a media input
# image_url = comfy_client.upload_file("input.png")

`
    : ''
  return `# pip install comfy-client — reads COMFY_API_KEY from your environment
import comfy_client

${uploadHint}result = comfy_client.subscribe(
    "${spec.workflowId}",
    arguments=${indentBlock(pythonBody(spec), 4)},
    # webhook_url="https://your.app/comfy-webhook",  # optional completion callback
)

print(result["outputs"])`
}

export function buildSnippet(language: SnippetLanguage, spec: ApiSpec): string {
  switch (language) {
    case 'curl':
      return curlSnippet(spec)
    case 'javascript':
      return javascriptSnippet(spec)
    case 'python':
      return pythonSnippet(spec)
  }
}
