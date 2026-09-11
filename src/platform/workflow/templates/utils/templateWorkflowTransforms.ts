import { z } from 'zod'

import type { ResultItem } from '@/schemas/apiSchema'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'

import type { TemplateInfo } from '../types/template'

const nodeIdSchema = z.union([z.number().finite(), z.string().min(1)])
const declaredInputsSchema = z.array(
  z.object({
    mediaType: z.string().optional(),
    nodeId: nodeIdSchema.optional(),
    nodeType: z.string().optional()
  })
)
const workflowSchema = z.object({
  nodes: z.array(z.object({ id: nodeIdSchema, type: z.string() }))
})
const namedWidgetsSchema = z.object({ image: z.string() }).passthrough()
const legacyNamedWidgetsSchema = z
  .object({
    image: z.string(),
    upload: z.string().optional()
  })
  .strict()
const nodeInputsSchema = z.array(
  z.object({ name: z.string(), link: z.unknown().optional() })
)

interface TransformableNode {
  id: string | number
  type: string
  widgets_values?: unknown
  widgets_values_named?: unknown
  inputs?: unknown
}

interface TransformableWorkflow {
  nodes: TransformableNode[]
}

type TemplateTransformResult<T> =
  | { ok: true; value: T }
  | {
      ok: false
      error: string
      failureCategory: 'template_metadata'
      reason: 'invalid_workflow' | 'missing_image_input' | 'invalid_image_input'
    }
  | {
      ok: false
      error: string
      failureCategory: 'semantic_binding'
      reason:
        | 'missing_output_filename'
        | 'input_node_missing'
        | 'input_node_ambiguous'
        | 'input_widget_linked'
        | 'missing_widget_values'
        | 'widget_value_missing'
    }

function imageBinding(template: TemplateInfo) {
  const parsed = declaredInputsSchema.safeParse(template.io?.inputs ?? [])
  if (!parsed.success) return null
  const inputs = parsed.data.filter(({ mediaType }) => mediaType === 'image')
  if (inputs.length !== 1) return null
  const input = inputs[0]
  return input.nodeId !== undefined && input.nodeType === 'LoadImage'
    ? { nodeId: input.nodeId, nodeType: input.nodeType }
    : null
}

export function acceptsTemplateImageInput(template: TemplateInfo): boolean {
  return imageBinding(template) !== null
}

function replaceImageWidget(
  values: unknown,
  imagePath: string
): TemplateTransformResult<{
  widgets_values: unknown[]
  widgets_values_named?: Record<string, unknown>
}> {
  if (Array.isArray(values)) {
    if (typeof values[0] === 'string')
      return {
        ok: true,
        value: { widgets_values: [imagePath, ...values.slice(1)] }
      }
  } else if (typeof values === 'object' && values !== null) {
    const named = legacyNamedWidgetsSchema.safeParse(values)
    if (named.success)
      return {
        ok: true,
        value: {
          widgets_values: [
            imagePath,
            ...(named.data.upload === undefined ? [] : [named.data.upload])
          ],
          widgets_values_named: { ...named.data, image: imagePath }
        }
      }
  } else {
    return {
      ok: false,
      error: 'Template input node has no configurable widgets',
      failureCategory: 'semantic_binding',
      reason: 'missing_widget_values'
    }
  }
  return {
    ok: false,
    error: 'LoadImage has no serialized image widget',
    failureCategory: 'semantic_binding',
    reason: 'widget_value_missing'
  }
}

export function replaceTemplateImageInput<T extends TransformableWorkflow>(
  workflow: T,
  template: TemplateInfo,
  image: ResultItem
): TemplateTransformResult<T> {
  if (!image.filename)
    return {
      ok: false,
      error: 'Image output has no filename',
      failureCategory: 'semantic_binding',
      reason: 'missing_output_filename'
    }

  const input = imageBinding(template)
  if (!input) {
    const parsed = declaredInputsSchema.safeParse(template.io?.inputs ?? [])
    const missing =
      parsed.success &&
      !parsed.data.some(({ mediaType }) => mediaType === 'image')
    return {
      ok: false,
      error: missing
        ? 'Template has no declared image input'
        : 'Template image input declaration is invalid',
      failureCategory: 'template_metadata',
      reason: missing ? 'missing_image_input' : 'invalid_image_input'
    }
  }
  if (!workflowSchema.safeParse(workflow).success)
    return {
      ok: false,
      error: 'Template workflow has invalid nodes',
      failureCategory: 'template_metadata',
      reason: 'invalid_workflow'
    }

  const matches = workflow.nodes.filter(
    ({ id }) => String(id) === String(input.nodeId)
  )
  if (matches.length !== 1 || matches[0].type !== input.nodeType)
    return {
      ok: false,
      error: 'Expected one matching template node',
      failureCategory: 'semantic_binding',
      reason: matches.length > 1 ? 'input_node_ambiguous' : 'input_node_missing'
    }

  const target = matches[0]
  const slots = nodeInputsSchema.safeParse(target.inputs ?? [])
  if (
    !slots.success ||
    slots.data.some(({ name, link }) => name === 'image' && link != null)
  )
    return {
      ok: false,
      error: 'LoadImage image input must be an unlinked widget',
      failureCategory: 'semantic_binding',
      reason: 'input_widget_linked'
    }
  const imagePath = createAnnotatedPath({
    ...image,
    type: image.type ?? 'output'
  })
  const named =
    target.widgets_values_named === undefined
      ? undefined
      : namedWidgetsSchema.safeParse(target.widgets_values_named)
  if (named && !named.success)
    return {
      ok: false,
      error: 'LoadImage has no serialized image widget',
      failureCategory: 'semantic_binding',
      reason: 'widget_value_missing'
    }
  const replaced = replaceImageWidget(target.widgets_values, imagePath)
  if (!replaced.ok) return replaced
  return {
    ok: true,
    value: {
      ...workflow,
      nodes: workflow.nodes.map((node) =>
        node === target
          ? {
              ...node,
              ...replaced.value,
              ...(named && {
                widgets_values_named: { ...named.data, image: imagePath }
              })
            }
          : node
      )
    }
  }
}
