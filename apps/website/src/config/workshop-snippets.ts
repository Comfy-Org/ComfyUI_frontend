import type { FormValues } from './workshop-playground'

export type SnippetLanguage = 'python' | 'typescript' | 'curl'

export const SNIPPET_LANGUAGES: readonly SnippetLanguage[] = [
  'python',
  'typescript',
  'curl'
]

const ROUTER_API = 'https://api.comfy.org'

function serializableInput(
  values: FormValues
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(values).flatMap(([key, value]) => {
      if (value === undefined) return []
      if (typeof value === 'object') return [[key, `<${value.name}>`]]
      return [[key, value]]
    })
  )
}

// The router takes the release name in the body and the full id in the path,
// so `openai/gpt-image` posts `"model": "gpt-image"`. A model whose schema
// names its own release keeps that name.
function requestBody(
  routerId: string,
  values: FormValues
): Record<string, string | number | boolean> {
  return {
    model: routerId.split('/').at(-1) ?? routerId,
    ...serializableInput(values)
  }
}

function indent(json: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return json
    .split('\n')
    .map((line, index) => (index === 0 ? line : pad + line))
    .join('\n')
}

// One synchronous POST per run, the same call the Playground makes. The
// idempotency key is what makes a retry safe: a dropped connection re-sends
// the same key and collects the original result instead of paying twice.
export function buildSnippet(
  language: SnippetLanguage,
  routerId: string,
  values: FormValues
): string {
  const body = requestBody(routerId, values)
  const json = JSON.stringify(body, null, 2)
  const endpoint = `${ROUTER_API}/v2/models/${routerId}`
  switch (language) {
    case 'python':
      return [
        'import os',
        'import uuid',
        '',
        'import requests',
        '',
        `response = requests.post(`,
        `    "${endpoint}",`,
        '    headers={',
        '        "Authorization": f"Bearer {os.environ[\'COMFY_API_KEY\']}",',
        '        "Content-Type": "application/json",',
        '        "Idempotency-Key": str(uuid.uuid4()),',
        '    },',
        `    json=${indent(json, 4)},`,
        '    timeout=600,',
        ')',
        'response.raise_for_status()',
        '',
        'for output in response.json()["outputs"]:',
        '    print(output["url"])'
      ].join('\n')
    case 'typescript':
      return [
        `const response = await fetch(`,
        `  '${endpoint}',`,
        '  {',
        "    method: 'POST',",
        '    headers: {',
        '      Authorization: `Bearer ${process.env.COMFY_API_KEY}`,',
        "      'Content-Type': 'application/json',",
        "      'Idempotency-Key': crypto.randomUUID()",
        '    },',
        `    body: JSON.stringify(${indent(json, 4)})`,
        '  }',
        ')',
        '',
        'if (!response.ok) throw new Error(await response.text())',
        '',
        'const { outputs } = await response.json()',
        'for (const output of outputs) console.log(output.url)'
      ].join('\n')
    case 'curl':
      return [
        `curl -X POST ${endpoint} \\`,
        '  -H "Authorization: Bearer $COMFY_API_KEY" \\',
        '  -H "Content-Type: application/json" \\',
        '  -H "Idempotency-Key: $(uuidgen)" \\',
        `  -d '${json}'`
      ].join('\n')
  }
}
