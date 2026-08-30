import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CodePanel from './CodePanel.vue'
import type { CodeEnv } from './CodePanel.vue'

const PYTHON_CODE = `# pip install comfy-sdk
import os
from comfy_sdk import Comfy

os.environ["COMFY_BASE_URL"] = "https://cloud.comfy.org"
client = Comfy(api_key=os.environ["COMFY_API_KEY"])
wf = client.workflows.from_file("workflow_api.json")
job = client.run(wf)  # submit, then poll to a terminal state
job.outputs[0].to_file("output.png")`

// Stand-in for the build-time Shiki output the real page passes in. Colors are
// the one-dark-pro palette the design uses.
const PYTHON_HTML = `<span style="color:#6b6b6b"># pip install comfy-sdk</span>
<span style="color:#c678dd">import</span> os
<span style="color:#c678dd">from</span> comfy_sdk <span style="color:#c678dd">import</span> Comfy

os.environ[<span style="color:#e5c07b">"COMFY_BASE_URL"</span>] = <span style="color:#61afef">"https://cloud.comfy.org"</span>
client = Comfy(api_key=os.environ[<span style="color:#e5c07b">"COMFY_API_KEY"</span>])
wf = client.workflows.from_file(<span style="color:#98c379">"workflow_api.json"</span>)
job = client.run(wf)  <span style="color:#6b6b6b"># submit, then poll to a terminal state</span>
job.outputs[0].to_file(<span style="color:#98c379">"output.png"</span>)`

const JS_CODE = `// npm install @comfyorg/sdk
import { Comfy } from '@comfyorg/sdk'

const client = new Comfy({ apiKey: process.env.COMFY_API_KEY })
const wf = await client.workflows.fromFile('workflow_api.json')
const job = await client.run(wf)
await job.outputs[0].toFile('output.png')`

const CURL_CODE = `curl -X POST https://cloud.comfy.org/api/v1/run \\
  -H "Authorization: Bearer $COMFY_API_KEY" \\
  -H "Content-Type: application/json" \\
  --data @workflow_api.json`

function languagesFor(baseUrl: string) {
  return [
    {
      id: 'python',
      label: 'Python',
      code: PYTHON_CODE.replace('https://cloud.comfy.org', baseUrl),
      html: PYTHON_HTML.replace('https://cloud.comfy.org', baseUrl)
    },
    { id: 'javascript', label: 'JavaScript', code: JS_CODE },
    {
      id: 'curl',
      label: 'cURL',
      code: CURL_CODE.replace('https://cloud.comfy.org', baseUrl)
    }
  ]
}

const envs: CodeEnv[] = [
  {
    id: 'cloud',
    label: 'Comfy Cloud',
    languages: languagesFor('https://cloud.comfy.org')
  },
  {
    id: 'local',
    label: 'Local',
    languages: languagesFor('http://127.0.0.1:8188')
  },
  {
    id: 'serverless',
    label: 'Serverless',
    languages: languagesFor('https://your-deployment.example.com')
  }
]

const meta: Meta<typeof CodePanel> = {
  title: 'Website/Common/CodePanel',
  component: CodePanel,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template:
        '<div class="bg-primary-warm-white p-8"><div class="max-w-xl"><story /></div></div>'
    })
  ],
  args: {
    title: 'Make your first call',
    subtitle:
      'Uses the Comfy SDK. The cURL tab is the same call over raw HTTP.',
    envs,
    copyLabel: 'Copy',
    copiedLabel: 'Copied'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** No `html` on any snippet — the panel falls back to plain, unhighlighted text. */
export const PlainText: Story = {
  args: {
    envs: envs.map((env) => ({
      ...env,
      languages: env.languages.map(({ html: _html, ...rest }) => rest)
    }))
  }
}

/** A single environment still renders its env tab, so the surface stays consistent. */
export const SingleEnv: Story = {
  args: { envs: [envs[0]], subtitle: undefined }
}
