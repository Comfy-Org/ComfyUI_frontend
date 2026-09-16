import { zUploadImageResponse } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import type {
  ComfyNode,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'

import { zTemplateInput } from '../schemas/templateSchema'

const INPUT_BASE =
  'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/'
const INPUT_WIDGETS: Readonly<Record<string, string>> = {
  LoadImage: 'image',
  LoadImageMask: 'image',
  LoadVideo: 'file',
  LoadAudio: 'audio'
}
const zValues = z.union([z.array(z.unknown()), z.record(z.unknown())])
const zNamedValues = z.record(z.unknown())

type PreparationResult = {
  workflow: ComfyWorkflowJSON
  errors: unknown[]
}

function getInputBinding(node: ComfyNode) {
  const widget = INPUT_WIDGETS[node.type]
  if (!widget) return
  const values = zValues.parse(node.widgets_values ?? [])
  const named = zNamedValues.optional().parse(node.widgets_values_named)
  const file =
    named?.[widget] ?? (Array.isArray(values) ? values[0] : values[widget])
  if (typeof file !== 'string') return
  return { node, widget, file, values, named }
}

function isSampleFilename(file: string): boolean {
  return file === file.trim() && !file.includes('..') && !/[\\/:%?#]/.test(file)
}

async function uploadTemplateInput(
  file: string,
  sourceRevision: string,
  signal: AbortSignal
): Promise<{ ok: true; path: string } | { ok: false; error: unknown }> {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(120_000)])
  const response = await fetch(
    `${INPUT_BASE}${sourceRevision}/input/${encodeURIComponent(file)}`,
    { signal: requestSignal }
  )
  if (!response.ok)
    return {
      ok: false,
      error: new Error(`Sample download failed: ${response.status}`)
    }
  const bytes = await response.arrayBuffer()
  requestSignal.throwIfAborted()
  const body = new FormData()
  body.append('image', new File([bytes], file))
  body.append('type', 'input')
  const uploaded = await api.fetchApi('/upload/image', {
    method: 'POST',
    body,
    signal: requestSignal
  })
  if (!uploaded.ok)
    return {
      ok: false,
      error: new Error(`Sample upload failed: ${uploaded.status}`)
    }
  const result = zUploadImageResponse.parse(await uploaded.json())
  if (!result.name)
    return { ok: false, error: new Error('Sample upload returned no filename') }
  const path = result.subfolder
    ? `${result.subfolder}/${result.name}`
    : result.name
  return { ok: true, path }
}

function getTemplateInputFiles(
  inputs: unknown,
  bindings: NonNullable<ReturnType<typeof getInputBinding>>[],
  errors: unknown[]
) {
  const files = new Map<string, string>()
  const entries = z.array(z.unknown()).safeParse(inputs)
  if (!entries.success) {
    errors.push(entries.error)
    return files
  }
  for (const entry of entries.data) {
    const parsed = zTemplateInput.safeParse(entry)
    if (!parsed.success) {
      errors.push(parsed.error)
      continue
    }
    const input = parsed.data
    if (!input.sourceRevision) continue
    if (
      !bindings.some(
        ({ node, file }) =>
          node.id === input.nodeId &&
          node.type === input.nodeType &&
          file === input.file
      )
    )
      continue
    if (!isSampleFilename(input.file)) {
      errors.push(
        new Error(`Unsupported template input filename: ${input.file}`)
      )
      continue
    }
    files.set(input.file, input.sourceRevision)
  }
  return files
}

export async function prepareTemplateInputs(
  workflow: ComfyWorkflowJSON,
  inputs: unknown,
  signal: AbortSignal,
  onStart?: () => void
): Promise<PreparationResult> {
  const errors: unknown[] = []
  const prepared = structuredClone(workflow)
  const bindings = prepared.nodes.flatMap((node) => {
    try {
      const binding = getInputBinding(node)
      return binding ? [binding] : []
    } catch (error) {
      errors.push(error)
      return []
    }
  })
  const files = getTemplateInputFiles(inputs, bindings, errors)
  signal.throwIfAborted()
  if (!files.size) return { workflow, errors }
  onStart?.()
  let resultWorkflow = workflow
  for (const [file, sourceRevision] of files) {
    signal.throwIfAborted()
    try {
      const uploaded = await uploadTemplateInput(file, sourceRevision, signal)
      signal.throwIfAborted()
      if (!uploaded.ok) {
        errors.push(uploaded.error)
        continue
      }
      const path = uploaded.path
      for (const { node, widget, values, named } of bindings.filter(
        (binding) => binding.file === file
      )) {
        node.widgets_values = Array.isArray(values)
          ? [path, ...values.slice(1)]
          : { ...values, [widget]: path }
        if (named) node.widgets_values_named = { ...named, [widget]: path }
      }
      resultWorkflow = prepared
    } catch (error) {
      signal.throwIfAborted()
      errors.push(error)
    }
  }
  return { workflow: resultWorkflow, errors }
}
