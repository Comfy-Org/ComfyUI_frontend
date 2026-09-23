import type { RouterServingProviderId } from '../../config/router-providers'
import { ROUTER_PROVIDER_COVERAGE } from '../../config/router-providers'
import type { CodeTab } from './CodeTabs.vue'

// Cycling segments are index-synced: the model id, prompt, and output
// filename switch together (Seedance video → GPT-Image-2 image).
const MODELS = ['seedance/v2-pro', 'openai/gpt-image-2']
const PROMPTS = [
  'aerial dolly shot over a neon reef',
  'a holographic sticker of a koi fish'
]
const OUTPUTS = ['reef.mp4', 'koi.png']
const CURL_MODELS = ['byteplus/seedance-1-5-pro-251215', 'openai/gpt-image-2']
const CURL_INPUTS = [
  '{"content":[{"type":"text","text":"aerial dolly shot over a neon reef"}],"resolution":"480p","duration":5,"generate_audio":false}',
  '{"prompt":"a holographic sticker of a koi fish"}'
]

export const modelsApiCodeTabs: Record<string, CodeTab> = {
  python: {
    name: 'Python',
    lang: 'python',
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
    lang: 'typescript',
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
  // Models API run route — POST /v2/models/{provider}/{model}: native JSON in, native JSON out
  // (services/comfy-api/docs/router-quickstart.mdx in Comfy-Org/cloud).
  curl: {
    name: 'cURL',
    lang: 'shell',
    segments: [
      'curl -X POST https://api.comfy.org/v2/models/',
      { values: CURL_MODELS, highlight: true },
      ' \\\n  -H "X-API-Key: $COMFY_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'',
      { values: CURL_INPUTS },
      "'"
    ]
  },
  cli: {
    name: 'comfy-cli',
    lang: 'shell',
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

// Router code block: the model and prompt stay fixed while the provider
// cycles, illustrating that switching providers only changes one argument.
const ROUTER_MODEL = 'openai/gpt-image-2'
const ROUTER_PROMPT = 'aerial view of a neon coral reef at dusk'
export type RouterProvider = 'comfy' | RouterServingProviderId
export const ROUTER_PROVIDERS: readonly RouterProvider[] = [
  'comfy',
  ...(ROUTER_PROVIDER_COVERAGE.find((row) => row.modelId === ROUTER_MODEL)
    ?.providers ?? [])
]

export const routerCodeTabs: Record<string, CodeTab> = {
  python: {
    name: 'Python',
    lang: 'python',
    segments: [
      'from comfy_sdk import Comfy\n\nclient = Comfy(api_key="comfyui-...")\n\nresult = client.models.run(\n    "' +
        ROUTER_MODEL +
        '",\n    arguments={"prompt": "' +
        ROUTER_PROMPT +
        '"},\n    provider="',
      { values: [...ROUTER_PROVIDERS], highlight: true },
      '",\n)'
    ]
  },
  typescript: {
    name: 'TypeScript',
    lang: 'typescript',
    segments: [
      "import { Comfy } from '@comfyorg/sdk'\n\nconst client = new Comfy({ apiKey: 'comfyui-...' })\n\nconst result = await client.models.run('" +
        ROUTER_MODEL +
        "', {\n  arguments: { prompt: '" +
        ROUTER_PROMPT +
        "' },\n  provider: '",
      { values: [...ROUTER_PROVIDERS], highlight: true },
      "',\n})"
    ]
  },
  // Router picks the serving provider from the model_provider query parameter;
  // the route and the model's native body stay the same (docs.comfy.org/development/comfy-router/providers).
  curl: {
    name: 'cURL',
    lang: 'shell',
    wrap: true,
    segments: [
      'curl -X POST "https://api.comfy.org/v2/models/' +
        ROUTER_MODEL +
        '?model_provider=',
      { values: [...ROUTER_PROVIDERS], highlight: true },
      '" \\\n  -H "X-API-Key: $COMFY_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: $(uuidgen)" \\\n  -d \'{"prompt": "' +
        ROUTER_PROMPT +
        '"}\''
    ]
  }
}
