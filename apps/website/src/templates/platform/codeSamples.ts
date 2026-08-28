import type { CodeTab } from './CodeTabs.vue'

// Cycling segments are index-synced: the model id, prompt, and output
// filename switch together (Seedance video → GPT-Image-2 image).
const MODELS = ['seedance/v2-pro', 'openai/gpt-image-2']
const PROMPTS = [
  'aerial dolly shot over a neon reef',
  'a holographic sticker of a koi fish'
]
const OUTPUTS = ['reef.mp4', 'koi.png']

export const modelsApiCodeTabs: Record<string, CodeTab> = {
  python: {
    name: 'Python',
    segments: [
      'result = comfy.models.run(\n    "',
      { values: MODELS, highlight: true },
      '",\n    prompt="',
      { values: PROMPTS },
      '",\n)\nresult.to_file("',
      { values: OUTPUTS },
      '")'
    ]
  },
  typescript: {
    name: 'TypeScript',
    segments: [
      "const result = await comfy.models.run('",
      { values: MODELS, highlight: true },
      "', {\n  prompt: '",
      { values: PROMPTS },
      "'\n})\nawait result.toFile('",
      { values: OUTPUTS },
      "')"
    ]
  },
  // Models API run route — POST /v1/models/{provider}/{model}: native JSON in, native JSON out
  // (services/comfy-api/docs/router-quickstart.mdx in Comfy-Org/cloud).
  curl: {
    name: 'cURL',
    segments: [
      'curl -X POST https://api.comfy.org/v1/models/',
      { values: MODELS, highlight: true },
      ' \\\n  -H "X-API-Key: $COMFY_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"prompt": "',
      { values: PROMPTS },
      '"}\''
    ]
  },
  cli: {
    name: 'comfy-cli',
    segments: [
      '$ comfy generate --model ',
      { values: MODELS, highlight: true },
      ' \\\n    --prompt "',
      { values: PROMPTS },
      '" \\\n    --output ',
      { values: OUTPUTS }
    ]
  }
}

const ENDPOINT_URL = 'https://your-build.run.comfy.app'

export const endpointCodeTabs: Record<string, CodeTab> = {
  python: {
    name: 'Python',
    segments: [
      `# pip install comfy-sdk
import os
from comfy_sdk import Comfy

os.environ["COMFY_BASE_URL"] = "${ENDPOINT_URL}"
client = Comfy(api_key=os.environ["COMFY_API_KEY"])

wf = client.workflows.from_file("workflow_api.json")
job = client.run(wf)
job.outputs[0].to_file("output.png")`
    ]
  },
  javascript: {
    name: 'JavaScript',
    segments: [
      `// npm install comfy-sdk
import { Comfy } from 'comfy-sdk'

const client = new Comfy({
  apiKey: process.env.COMFY_API_KEY,
  baseUrl: '${ENDPOINT_URL}'
})

const wf = await client.workflows.fromFile('workflow_api.json')
const job = await client.run(wf)
await job.outputs[0].toFile('output.png')`
    ]
  },
  curl: {
    name: 'cURL',
    segments: [
      `curl -X POST ${ENDPOINT_URL} \\
  -H "X-API-Key: $COMFY_API_KEY" \\
  -H "Content-Type: application/json" \\
  --data @workflow_api.json \\
  --output output.png`
    ]
  }
}
