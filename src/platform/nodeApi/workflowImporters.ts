import { reportError } from '@comfyorg/telemetry/reportError'

import { ComfyApiError } from './errors'

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface WorkflowImportContext {
  readonly name: string
  readonly type: string
}

export type WorkflowImportResult =
  | { readonly workflow: Readonly<Record<string, unknown>> | string }
  | { readonly prompt: Readonly<Record<string, unknown>> | string }

/** Reads a workflow or prompt out of a file the host cannot read itself. */
export interface WorkflowImporter {
  /** Namespaced; names the importer in diagnostics. */
  readonly id: string
  /** Offered a file matching a type or an extension; every file if neither is given. */
  readonly mimeTypes?: readonly string[]
  readonly extensions?: readonly string[]
  /** Larger files are not offered. The host never offers more than 16 MiB. */
  readonly maxBytes: number
  enabled?(): boolean | Promise<boolean>
  /** Returns nothing to decline the file. */
  parse(
    bytes: Uint8Array,
    context: WorkflowImportContext
  ):
    | WorkflowImportResult
    | null
    | undefined
    | Promise<WorkflowImportResult | null | undefined>
}

const MAX_IMPORT_BYTES = 16 * 1024 * 1024

const registrations = new Set<{ readonly importer: WorkflowImporter }>()

export function registerWorkflowImporter(
  importer: WorkflowImporter
): () => boolean {
  if (typeof importer.id !== 'string' || !importer.id) {
    throw new ComfyApiError('A workflow importer needs an id.')
  }
  if (typeof importer.parse !== 'function') {
    throw new ComfyApiError(
      `Workflow importer '${importer.id}' needs a parse function.`
    )
  }
  if (!Number.isFinite(importer.maxBytes) || importer.maxBytes <= 0) {
    throw new ComfyApiError(
      `Workflow importer '${importer.id}' needs a positive maxBytes.`
    )
  }
  const registration = { importer }
  registrations.add(registration)
  return () => registrations.delete(registration)
}

function accepts(importer: WorkflowImporter, file: File): boolean {
  if (file.size > Math.min(importer.maxBytes, MAX_IMPORT_BYTES)) return false
  const { mimeTypes, extensions } = importer
  if (!mimeTypes && !extensions) return true
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return (
    (mimeTypes?.includes(file.type) ?? false) ||
    (extensions?.some(
      (candidate) => candidate.replace(/^\./, '').toLowerCase() === extension
    ) ??
      false)
  )
}

function toImportResult(value: unknown): WorkflowImportResult | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const { workflow, prompt } = value as Record<string, unknown>
  if (isImported(workflow)) return { workflow }
  if (isImported(prompt)) return { prompt }
  return undefined
}

function isImported(
  value: unknown
): value is Readonly<Record<string, unknown>> | string {
  return (
    typeof value === 'string' ||
    (value !== null && typeof value === 'object' && !Array.isArray(value))
  )
}

/**
 * Offers a file to each registered importer in registration order and returns
 * the first workflow or prompt one of them reads from it.
 */
export async function importWorkflowFile(
  file: File
): Promise<WorkflowImportResult | undefined> {
  const candidates = [...registrations].filter(({ importer }) =>
    accepts(importer, file)
  )
  if (!candidates.length) return undefined
  const bytes = new Uint8Array(await file.arrayBuffer())
  const context = Object.freeze({ name: file.name, type: file.type })
  for (const { importer } of candidates) {
    try {
      if (importer.enabled && !(await importer.enabled())) continue
      const result = toImportResult(
        await importer.parse(bytes.slice(), context)
      )
      if (result) return result
    } catch (error) {
      reportError(error, {
        errorType: 'node_api_workflow_importer_failure',
        surface: 'graph',
        tags: { importer: importer.id }
      })
    }
  }
  return undefined
}
