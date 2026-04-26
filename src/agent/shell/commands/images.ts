import { api } from '@/scripts/api'

import type { Command, CommandRegistry } from '../types'
import { emptyIter, stringIter } from '../types'

/**
 * copy-to-input <output_filename> [as <input_filename>]
 *
 * Copies a file from the output/ directory into input/ so it can be used
 * as a LoadImage source in the NEXT workflow. Unlocks multi-phase pipelines
 * (e.g. T2I generates image → image-to-3D consumes it) in pure natural
 * language via the agent.
 *
 * Fetches via /view?type=output, re-uploads via /upload/image.
 */
const copyToInput: Command = async (ctx) => {
  const args = ctx.argv.slice(1)
  if (args.length === 0) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr:
        'usage: copy-to-input <output_filename> [as <input_filename>]\n' +
        '  copies output/<src> → input/<dst> (defaults dst = src)'
    }
  }
  const src = args[0]
  let dst = src
  const asIdx = args.indexOf('as')
  if (asIdx >= 0 && args[asIdx + 1]) {
    dst = args[asIdx + 1]
  }

  try {
    // Fetch the image from ComfyUI's output folder.
    const viewUrl = api.apiURL(
      `/view?filename=${encodeURIComponent(src)}&type=output`
    )
    const imgRes = await fetch(viewUrl)
    if (!imgRes.ok) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: `copy-to-input: cannot read output/${src} (HTTP ${imgRes.status})`
      }
    }
    const blob = await imgRes.blob()

    // Upload into input/.
    const form = new FormData()
    form.append('image', blob, dst)
    form.append('overwrite', 'true')
    const uploadRes = await fetch(api.apiURL('/upload/image'), {
      method: 'POST',
      body: form
    })
    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => '')
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: `copy-to-input: upload failed (${uploadRes.status}) ${text.slice(0, 200)}`
      }
    }
    const out = (await uploadRes.json()) as { name?: string }
    return {
      stdout: stringIter(`copied output/${src} → input/${out.name ?? dst}\n`),
      exitCode: 0
    }
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * latest-output-name — print the filename of the most recent SaveImage
 * output. Convenience wrapper around latest-output so the LLM can grab
 * just the name and pipe it into copy-to-input.
 */
const latestOutputName: Command = async () => {
  try {
    const res = await fetch(api.apiURL('/history'))
    if (!res.ok) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: `latest-output-name: /history ${res.status}`
      }
    }
    const history = (await res.json()) as Record<
      string,
      {
        outputs?: Record<
          string,
          {
            images?: Array<{
              filename: string
              subfolder?: string
              type?: string
            }>
          }
        >
      }
    >
    const entries = Object.values(history)
    for (const entry of entries.reverse()) {
      const outs = entry.outputs ?? {}
      for (const nodeOut of Object.values(outs)) {
        const img = nodeOut.images?.[0]
        if (img?.filename) {
          const sub = img.subfolder ? img.subfolder + '/' : ''
          return {
            stdout: stringIter(sub + img.filename + '\n'),
            exitCode: 0
          }
        }
      }
    }
    return {
      stdout: stringIter(''),
      exitCode: 0,
      stderr: '(no outputs in history)'
    }
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
}

export function registerImageCommands(registry: CommandRegistry): void {
  registry.register('copy-to-input', copyToInput)
  registry.register('latest-output-name', latestOutputName)
}
