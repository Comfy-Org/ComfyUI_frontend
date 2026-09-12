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
  // Comfy Router run route — POST /v1/models/{provider}/{model}: native JSON in, native JSON out
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
