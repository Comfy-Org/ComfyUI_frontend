import type { FormValues } from './workshop-playground'

export type SnippetLanguage = 'python' | 'typescript' | 'http'

export const SNIPPET_LANGUAGES: readonly SnippetLanguage[] = [
  'python',
  'typescript',
  'http'
]

function serializableInput(
  values: FormValues
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(values).flatMap(([key, value]) => {
      if (value === undefined) return []
      if (typeof value === 'object') return [[key, `<${value.name}>`]]
      return [[key, value]]
    })
  )
}

function indent(json: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return json
    .split('\n')
    .map((line, index) => (index === 0 ? line : pad + line))
    .join('\n')
}

// Illustrative shapes. The final calls come from the Router SDK docs once
// the TDD settles which client the snippets teach.
export function buildSnippet(
  language: SnippetLanguage,
  routerId: string,
  values: FormValues
): string {
  const input = JSON.stringify(serializableInput(values), null, 2)
  switch (language) {
    case 'python':
      return [
        'from comfy_router import Router',
        '',
        'router = Router(api_key="YOUR_API_KEY")',
        `result = router.run(`,
        `    "${routerId}",`,
        `    input=${indent(input, 4)},`,
        ')',
        'result.save("output")'
      ].join('\n')
    case 'typescript':
      return [
        "import { Router } from '@comfyorg/router'",
        '',
        'const router = new Router({ apiKey: process.env.COMFY_API_KEY })',
        `const result = await router.run('${routerId}', {`,
        `  input: ${indent(input, 2)}`,
        '})',
        "await result.save('output')"
      ].join('\n')
    case 'http':
      return [
        `POST https://api.comfy.org/v1/models/${routerId}/run`,
        'Authorization: Bearer YOUR_API_KEY',
        'Content-Type: application/json',
        '',
        JSON.stringify({ input: serializableInput(values) }, null, 2)
      ].join('\n')
  }
}
