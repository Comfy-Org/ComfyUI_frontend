import { api } from '@/scripts/api'

import type { Command, CommandRegistry } from '../types'
import { emptyIter, stringIter } from '../types'

/**
 * validate <filename> [<prompt-text...>]
 *
 * Send an image (from ComfyUI's output/ folder) through the cloud
 * GeminiNode (gemini-3-1-pro) to get a visual quality assessment. Use
 * after any SaveImage to confirm the result matches user intent before
 * moving on to expensive next-phase work (e.g. image-to-3D).
 *
 * If no prompt is given, asks Gemini for a concise 1-5 rating and
 * description. Requires Comfy Cloud auth (same as other api_* nodes).
 */
const validate: Command = async (ctx) => {
  const args = ctx.argv.slice(1)
  if (args.length === 0) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr:
        'usage: validate <filename_in_output> [<question...>]\n' +
        '  hint: `latest-output-name` gives the most recent filename'
    }
  }
  const filename = args[0]
  const question =
    args.slice(1).join(' ').trim() ||
    'Describe this image in one short sentence. Then rate its overall quality from 1-5. Format: "<description> | rating: N/5"'

  // Minimal workflow: LoadImage (from output/) → GeminiNode → (implicit
  // return in /history). We use type=output because SaveImage writes there.
  // LoadImage reads from input/, so copy via the existing /upload/image
  // path first — keeps this command side-effect-free on input/ by using
  // subfolder='validate-staging'.
  try {
    const viewRes = await fetch(
      api.apiURL(`/view?filename=${encodeURIComponent(filename)}&type=output`)
    )
    if (!viewRes.ok) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: `validate: cannot read output/${filename} (${viewRes.status})`
      }
    }
    const blob = await viewRes.blob()
    const form = new FormData()
    form.append('image', blob, filename)
    form.append('subfolder', 'agent-validate')
    form.append('overwrite', 'true')
    const up = await fetch(api.apiURL('/upload/image'), {
      method: 'POST',
      body: form
    })
    if (!up.ok) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: `validate: upload-to-input failed (${up.status})`
      }
    }
    const upJson = (await up.json()) as { name?: string; subfolder?: string }
    const stagedName = upJson.subfolder
      ? `${upJson.subfolder}/${upJson.name}`
      : (upJson.name ?? filename)

    const prompt = {
      prompt: {
        '1': {
          class_type: 'LoadImage',
          inputs: { image: stagedName }
        },
        '2': {
          class_type: 'GeminiNode',
          inputs: {
            prompt: question,
            model: 'gemini-3-1-pro',
            seed: 1,
            images: ['1', 0]
          }
        },
        // PreviewAny is an OUTPUT_NODE — without it ComfyUI's executor
        // culls the Gemini call as a dead branch (no consumer of its
        // STRING output) and returns success without invoking the API.
        '3': {
          class_type: 'PreviewAny',
          inputs: { source: ['2', 0] }
        }
      },
      client_id: 'sno-agent-validate'
    }

    const queueRes = await fetch(api.apiURL('/prompt'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompt)
    })
    if (!queueRes.ok) {
      const text = await queueRes.text().catch(() => '')
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: `validate: queue rejected (${queueRes.status}) ${text.slice(0, 300)}`
      }
    }
    const queued = (await queueRes.json()) as { prompt_id?: string }
    const pid = queued.prompt_id
    if (!pid) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: 'validate: queue did not return a prompt_id'
      }
    }

    // Poll history for completion. Gemini API round-trips in seconds.
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      const hRes = await fetch(api.apiURL(`/history/${pid}`))
      if (hRes.ok) {
        const hJson = (await hRes.json()) as Record<
          string,
          {
            status?: { completed?: boolean }
            outputs?: Record<string, { text?: string[] }>
          }
        >
        const entry = hJson[pid]
        if (entry?.status?.completed) {
          const outputs = entry.outputs ?? {}
          const texts: string[] = []
          for (const node of Object.values(outputs)) {
            if (Array.isArray(node.text)) texts.push(...node.text)
          }
          if (texts.length === 0) {
            return {
              stdout: stringIter('(validate: no text output)\n'),
              exitCode: 0
            }
          }
          return {
            stdout: stringIter(texts.join('\n') + '\n'),
            exitCode: 0
          }
        }
      }
      await new Promise((r) => setTimeout(r, 1500))
    }
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: `validate: timed out waiting for Gemini (prompt_id=${pid})`
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const hint = /Failed to fetch/i.test(msg)
      ? '\n  hint: requires Comfy Cloud sign-in (menu → Sign In).'
      : ''
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: msg + hint
    }
  }
}

export function registerValidateCommands(registry: CommandRegistry): void {
  registry.register('validate', validate)
}
