import { api } from '@/scripts/api'

import type { Command, CommandRegistry } from '../types'
import { emptyIter, stringIter } from '../types'

/**
 * see [<question>]
 *
 * Capture the visible canvas (LiteGraph node graph) as a PNG, upload to
 * ComfyUI's input/ folder, and feed to Gemini 3.1 Pro for analysis.
 * Default question asks Gemini to describe what's on the canvas — useful
 * after a workflow run to confirm a Preview3D / PreviewImage actually
 * rendered, or to spot disconnected nodes / red error frames.
 *
 * Returns Gemini's text response. Requires Comfy Cloud auth (validate
 * uses the same auth flow).
 *
 * NOTE: Preview3D / Preview Audio render their own internal canvases,
 * which the main LiteGraph capture does not include. To inspect those,
 * pair `see` with the relevant filename via `validate <file>`.
 */
const see: Command = async (ctx) => {
  const question =
    ctx.argv.slice(1).join(' ').trim() ||
    'Describe what is visible on this ComfyUI canvas: what workflow is loaded, what node types are present, are any nodes showing errors or disconnected sockets, are there any visible image/3D previews?'

  // Find the LiteGraph canvas — the main node-graph rendering surface.
  const canvas = document.querySelector(
    'canvas#graph-canvas, canvas.litegraph, .agent-xterm-panel + * canvas, body > canvas'
  ) as HTMLCanvasElement | null
  const liteCanvas =
    canvas ??
    (Array.from(document.querySelectorAll('canvas')).find(
      (c) => c.width > 200 && c.height > 200
    ) as HTMLCanvasElement | undefined)
  if (!liteCanvas) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: 'see: could not locate the canvas element'
    }
  }

  // Capture as PNG blob.
  const blob = await new Promise<Blob | null>((resolve) =>
    liteCanvas.toBlob((b) => resolve(b), 'image/png')
  )
  if (!blob) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr:
        'see: canvas toBlob returned null (likely tainted by cross-origin content)'
    }
  }

  // Upload to input/ under a stable agent-staging subfolder so we can use
  // it as a LoadImage source for Gemini.
  const ts = Date.now()
  const filename = `agent-see-${ts}.png`
  try {
    const form = new FormData()
    form.append('image', blob, filename)
    form.append('subfolder', 'agent-see')
    form.append('overwrite', 'true')
    const up = await fetch(api.apiURL('/upload/image'), {
      method: 'POST',
      body: form
    })
    if (!up.ok) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: `see: upload failed (${up.status})`
      }
    }
    const upJson = (await up.json()) as { name?: string; subfolder?: string }
    const stagedPath = upJson.subfolder
      ? `${upJson.subfolder}/${upJson.name}`
      : (upJson.name ?? filename)

    // Submit a Gemini-only prompt with PreviewAny so the response isn't
    // culled (GeminiNode is api but not OUTPUT_NODE).
    const prompt = {
      prompt: {
        '1': { class_type: 'LoadImage', inputs: { image: stagedPath } },
        '2': {
          class_type: 'GeminiNode',
          inputs: {
            prompt: question,
            model: 'gemini-3-1-pro',
            seed: 1,
            images: ['1', 0]
          }
        },
        '3': { class_type: 'PreviewAny', inputs: { source: ['2', 0] } }
      },
      client_id: 'sno-agent-see'
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
        stderr: `see: queue failed (${queueRes.status}) ${text.slice(0, 300)}`
      }
    }
    const queued = (await queueRes.json()) as { prompt_id?: string }
    const pid = queued.prompt_id
    if (!pid) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: 'see: queue did not return prompt_id'
      }
    }

    // Poll history (Gemini ~5-10s).
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
          const outs = entry.outputs ?? {}
          const texts: string[] = []
          for (const node of Object.values(outs)) {
            if (Array.isArray(node.text)) texts.push(...node.text)
          }
          return {
            stdout: stringIter(
              (texts.length ? texts.join('\n') : '(no text returned)') +
                '\n\n[saw: input/' +
                stagedPath +
                ']\n'
            ),
            exitCode: 0
          }
        }
      }
      await new Promise((r) => setTimeout(r, 1500))
    }
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: `see: timed out (prompt_id=${pid})`
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const hint = /Failed to fetch/i.test(msg)
      ? '\n  hint: requires Comfy Cloud sign-in.'
      : ''
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: msg + hint
    }
  }
}

export function registerSeeCommands(registry: CommandRegistry): void {
  registry.register('see', see)
}
