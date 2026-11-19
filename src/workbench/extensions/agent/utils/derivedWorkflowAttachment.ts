import { getWorkflowDataFromFile } from '@/scripts/metadata/parser'
import { parseJsonWithNonFinite } from '@/utils/jsonUtil'

// A workflow-bearing image is two things at once: something to look at and a
// graph to edit. The agent's tools can only reach a graph that arrived as an
// attachment of its own, so the embedded workflow is lifted out here and staged
// beside the image as a derived `.json`. Cloud's shipped attached-workflow
// reader (services/agent/server/workflow_attachment.go) then imports it exactly
// as it imports a hand-attached workflow file, which is why this needs no
// backend change at all.
//
// Named with a filename suffix rather than a translated label on purpose:
// `src/locales/en/main.json` is deliberately unowned and shared by every
// feature, so a key there would pull this change outside the Agent-owned paths
// and cost it the automated review route.
const DERIVED_SUFFIX = '.workflow.json'

/**
 * Marks a staged attachment as one this module derived. The dedupe key is built
 * from the SOURCE file, so re-attaching the same image cannot mint a second
 * copy of its workflow.
 */
export const DERIVED_WORKFLOW_SOURCE_PREFIX = 'derived-workflow:'

function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, '') || name
}

export function derivedWorkflowName(sourceName: string): string {
  return `${stripExtension(sourceName)}${DERIVED_SUFFIX}`
}

// `.json` is already the case the backend reader handles directly, and skipping
// it is also what stops a derived file from deriving another one.
function carriesOwnWorkflow(file: File): boolean {
  return /\.json$/i.test(file.name)
}

// Deliberately the weakest check that avoids uploading obvious non-graphs:
// anything with nodes. Cloud's `decodeAttachedWorkflow` is the authority on what
// counts as an importable workflow, and replicating its node/type/link rules
// here would create exactly the two-implementations drift this design was chosen
// to avoid. A graph that passes here and fails there simply attaches as text.
function looksLikeEditorWorkflow(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const nodes = (value as { nodes?: unknown }).nodes
  return Array.isArray(nodes) && nodes.length > 0
}

/**
 * Lifts an embedded editor workflow out of `file`, as a `.json` File ready to be
 * staged as its own attachment.
 *
 * Returns undefined whenever there is nothing to lift — no metadata, an
 * API-format `prompt` with no editor graph (BE-4259 owns that fallback and it
 * needs product sign-off), unreadable bytes, or a container the parsers do not
 * recognise. Every failure is silent by design: the image itself must still
 * attach, so this can never be the reason an attachment fails.
 */
export async function deriveWorkflowFile(
  file: File
): Promise<File | undefined> {
  if (carriesOwnWorkflow(file)) return undefined

  let metadata
  try {
    metadata = await getWorkflowDataFromFile(file)
  } catch {
    return undefined
  }

  // Falsy covers every "nothing here" shape the parsers produce — absent, an
  // empty chunk, an empty object key — without asserting a null the metadata
  // types say cannot occur.
  const raw = metadata?.workflow
  if (!raw) return undefined

  let workflow: unknown
  try {
    // PNG/WebP hand back the chunk verbatim as a JSON string; the video and
    // JSON paths hand back an object already. `parseJsonWithNonFinite` is the
    // same tolerant reader the canvas drop path uses, so a graph carrying bare
    // NaN/Infinity tokens survives here too.
    workflow = typeof raw === 'string' ? parseJsonWithNonFinite(raw) : raw
  } catch {
    return undefined
  }
  if (!looksLikeEditorWorkflow(workflow)) return undefined

  let serialized: string
  try {
    serialized = JSON.stringify(workflow)
  } catch {
    return undefined
  }

  return new File([serialized], derivedWorkflowName(file.name), {
    type: 'application/json'
  })
}
