import { resolveObjectURL } from 'node:buffer'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { RunOutput } from '../src/config/workshop-run'

export async function captureRouterOutputs(
  outputs: readonly RunOutput[],
  directory: string,
  token: string,
  maxBytes: number
): Promise<void> {
  const secrets = token
    ? new Set([
        token,
        JSON.stringify(token).slice(1, -1),
        encodeURIComponent(token)
      ])
    : new Set<string>()
  function redact(value: string): string {
    for (const secret of secrets) value = value.replaceAll(secret, '[redacted]')
    return value
  }
  const entries = outputs.map((output, index) => ({
    ...output,
    ...(output.kind === 'text' && output.url.startsWith('blob:')
      ? {
          responseFile: `response-${index + 1}.${output.fileName.endsWith('.json') ? 'json' : 'txt'}`
        }
      : {})
  }))
  await writeFile(
    join(directory, 'outputs.json'),
    JSON.stringify(
      entries,
      (_key, value: unknown) =>
        typeof value === 'string' ? redact(value) : value,
      2
    ),
    { flag: 'wx', mode: 0o600 }
  )
  for (const output of entries) {
    if (!output.responseFile) continue
    const blob = resolveObjectURL(output.url)
    if (!blob) throw new Error('Response attachment is no longer available')
    if (blob.size > maxBytes)
      throw new Error('Response attachment exceeds byte limit')
    await writeFile(
      join(directory, output.responseFile),
      redact(await blob.text()),
      { flag: 'wx', mode: 0o600 }
    )
  }
}
