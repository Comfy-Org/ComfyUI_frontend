import type { ApiParameter, ApiSpec } from './apiSpec'
import {
  exampleRequestBody,
  exampleResponseBody,
  isMediaParameter
} from './apiSpec'
import { buildSnippet } from './apiSnippets'

function parameterBlock(parameter: ApiParameter): string {
  const requirement = parameter.required ? '_required_' : '_optional_'
  const heading = `- **\`${parameter.name}\`** (\`${parameter.type}\`, ${requirement})`
  const lines = [
    parameter.nodeTitle ? `${heading}: ${parameter.nodeTitle}` : heading
  ]
  if (isMediaParameter(parameter)) {
    lines.push('  - Accepts: an HTTPS URL or a base64 data URI')
  }
  if (parameter.defaultValue !== undefined) {
    lines.push(`  - Default: \`${JSON.stringify(parameter.defaultValue)}\``)
  }
  if (parameter.minimum !== undefined && parameter.maximum !== undefined) {
    lines.push(
      `  - Range: \`${parameter.minimum}\` to \`${parameter.maximum}\``
    )
  } else if (parameter.minimum !== undefined) {
    lines.push(`  - Min: \`${parameter.minimum}\``)
  } else if (parameter.maximum !== undefined) {
    lines.push(`  - Max: \`${parameter.maximum}\``)
  }
  if (parameter.enumValues?.length) {
    lines.push(
      `  - Options: ${parameter.enumValues.map((value) => `\`"${value}"\``).join(', ')}`
    )
  }
  return lines.join('\n')
}

function inputSchemaSection(spec: ApiSpec): string {
  if (!spec.parameters.length) return '_This API takes no parameters._'

  const blocks = spec.parameters.map(parameterBlock).join('\n\n')

  const requiredExample = spec.parameters.some((p) => p.required)
    ? `

**Required Parameters Example**:

\`\`\`json
${JSON.stringify(exampleRequestBody(spec, true), null, 2)}
\`\`\``
    : ''

  return `The API accepts the following input parameters:

${blocks}${requiredExample}

**Full Example**:

\`\`\`json
${JSON.stringify(exampleRequestBody(spec), null, 2)}
\`\`\``
}

function outputSchemaSection(spec: ApiSpec): string {
  const outputLines = spec.outputs
    .map(
      (output) => `- **\`${output.key}\`** (\`list<Asset>\`): ${output.title}`
    )
    .join('\n')

  return `When the job completes, \`outputs\` contains one key per workflow
output; each is a list of \`{ "filename", "url" }\` assets.

${outputLines}

**Example Response**:

\`\`\`json
${JSON.stringify(exampleResponseBody(spec), null, 2)}
\`\`\``
}

function optionalFeaturesSection(spec: ApiSpec): string {
  const lines = [
    '- **Webhook** — include `webhook_url` when submitting (`webhookUrl` in the JavaScript client) to receive a POST callback when the job completes, instead of polling.'
  ]
  if (spec.parameters.some(isMediaParameter)) {
    lines.push(
      '- **Media uploads** — media inputs accept any HTTPS URL or base64 data URI; the clients also provide an upload helper (`comfy.storage.upload(file)` / `comfy_client.upload_file(path)`) that returns a hosted URL.'
    )
  }
  return lines.join('\n')
}

export function buildLlmSummary(spec: ApiSpec): string {
  return `# ${spec.title}

> A ComfyUI workflow exposed as an HTTP API: submit a job with the typed
> inputs below and receive generated assets.

## Overview

- **Endpoint**: \`POST ${spec.submitUrl}\`
- **Workflow ID**: \`${spec.workflowId}\`
- **Execution**: async queue — submitting returns a \`job_id\`; poll
  \`GET ${spec.jobUrl}\` until \`status\` is \`completed\`.
- **Authentication**: send \`Authorization: Bearer <COMFY_API_KEY>\` on every
  request. The client libraries read \`COMFY_API_KEY\` from the environment.

## Input Schema

${inputSchemaSection(spec)}

## Output Schema

${outputSchemaSection(spec)}

## Optional Features

${optionalFeaturesSection(spec)}

## Usage Examples

### JavaScript

\`\`\`javascript
${buildSnippet('javascript', spec)}
\`\`\`

### Python

\`\`\`python
${buildSnippet('python', spec)}
\`\`\`

### cURL

\`\`\`bash
${buildSnippet('curl', spec)}
\`\`\`
`
}
