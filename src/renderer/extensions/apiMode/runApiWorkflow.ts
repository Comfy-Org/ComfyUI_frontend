/**
 * Helpers for executing an API-mode workflow from a Swagger "Execute" request.
 *
 * The Swagger spec is generated from the workflow's `linearData`, so the request
 * payload's fields map back onto specific node widgets. To actually run it we:
 *   1. take the current graph as an API prompt (`app.graphToPrompt`),
 *   2. override the promoted inputs with the request payload values,
 *   3. queue it to ComfyUI's `/prompt` endpoint,
 *   4. poll `/history/{prompt_id}` until outputs are produced,
 *   5. return the outputs with `/view` URLs for the generated assets.
 */

import type { ApiInputFieldTarget } from './useApiSpec'

/** A single API prompt node: `{ inputs, class_type, ... }`. */
type PromptNode = { inputs: Record<string, unknown> }
export type ApiPrompt = Record<string, PromptNode>

export interface ApiOutputAsset {
  filename: string
  subfolder: string
  type: string
  /** Absolute URL that streams the generated asset. */
  url: string
}

export interface ApiRunResult {
  prompt_id: string
  outputs: Record<string, ApiOutputAsset[]>
}

/**
 * Apply request payload values onto the API prompt's node inputs, using the
 * field→graph mapping derived from `linearData`.
 */
export function applyInputOverrides(
  output: ApiPrompt,
  payload: Record<string, unknown>,
  fieldMap: Record<string, ApiInputFieldTarget>
): void {
  for (const [field, value] of Object.entries(payload)) {
    if (value === undefined) continue
    const target = fieldMap[field]
    if (!target) continue
    const node = output[target.nodeId]
    if (node?.inputs) node.inputs[target.widgetName] = value
  }
}

type HistoryOutputs = Record<string, Record<string, unknown>>

/**
 * Poll `/history/{prompt_id}` until the prompt has produced outputs, surfacing
 * execution errors and a timeout.
 */
export async function waitForPromptOutputs(
  promptId: string,
  fetchApi: (route: string) => Promise<Response>,
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<HistoryOutputs> {
  const { timeoutMs = 300_000, intervalMs = 1_000 } = options
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const res = await fetchApi(`/history/${promptId}`)
    if (res.ok) {
      const history = (await res.json()) as Record<
        string,
        { outputs?: HistoryOutputs; status?: { status_str?: string } }
      >
      const entry = history?.[promptId]
      if (entry?.status?.status_str === 'error') {
        throw new Error('Workflow execution failed')
      }
      if (entry?.outputs && Object.keys(entry.outputs).length > 0) {
        return entry.outputs
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error('Timed out waiting for the workflow result')
}

/** Output collections that contain file references in a history entry. */
const ASSET_KEYS = ['images', 'gifs', 'audio', 'video'] as const

/**
 * Convert history outputs into `{ nodeId: [{ ...asset, url }] }`, limited to the
 * selected output nodes (or all output nodes when none are selected).
 */
export function buildOutputAssets(
  historyOutputs: HistoryOutputs,
  selectedOutputs: string[],
  viewUrl: (filename: string, subfolder: string, type: string) => string
): Record<string, ApiOutputAsset[]> {
  const nodeIds = selectedOutputs.length
    ? selectedOutputs
    : Object.keys(historyOutputs)
  const result: Record<string, ApiOutputAsset[]> = {}

  for (const nodeId of nodeIds) {
    const nodeOutput = historyOutputs[nodeId]
    if (!nodeOutput) continue
    const assets: ApiOutputAsset[] = []
    for (const key of ASSET_KEYS) {
      const items = nodeOutput[key]
      if (!Array.isArray(items)) continue
      for (const item of items) {
        const filename = item?.filename
        if (typeof filename !== 'string') continue
        const subfolder =
          typeof item.subfolder === 'string' ? item.subfolder : ''
        const type = typeof item.type === 'string' ? item.type : 'output'
        assets.push({
          filename,
          subfolder,
          type,
          url: viewUrl(filename, subfolder, type)
        })
      }
    }
    if (assets.length) result[nodeId] = assets
  }
  return result
}
