import type {
  ComfyNodeDef,
  ComfyInputsSpec,
  InputSpec,
  ComboInputSpec,
  ComboInputSpecV2
} from '../schemas/nodeDefSchema'
import {
  isComboInputSpecV1,
  isComboInputSpecV2
} from '../schemas/nodeDefSchema'

const USER_CONTENT_REGEX =
  /\.(png|jpe?g|webp|gif|mp4|mov|webm|wav|mp3|flac|ogg|safetensors|ckpt|pt)$/i

const KNOWN_USER_UPLOAD_NODES = new Set([
  'LoadImage',
  'LoadImageMask',
  'LoadImageOutput',
  'LoadVideo',
  'LoadAudio'
])

export function sanitizeUserContent(
  defs: Record<string, ComfyNodeDef>
): Record<string, ComfyNodeDef> {
  const nextEntries = Object.entries(defs).map(([className, def]) => [
    className,
    sanitizeNode(def)
  ])
  return Object.fromEntries(nextEntries) as Record<string, ComfyNodeDef>
}

function sanitizeNode(def: ComfyNodeDef): ComfyNodeDef {
  if (!def.input) return def

  const shouldClearAllComboOptions =
    def.python_module === 'nodes' && KNOWN_USER_UPLOAD_NODES.has(def.name)

  return {
    ...def,
    input: {
      ...def.input,
      required: sanitizeInputSpecSection(
        def.input.required,
        shouldClearAllComboOptions
      ),
      optional: sanitizeInputSpecSection(
        def.input.optional,
        shouldClearAllComboOptions
      ),
      hidden: sanitizeHiddenSection(
        def.input.hidden,
        shouldClearAllComboOptions
      )
    }
  }
}

function sanitizeInputSpecSection(
  section: ComfyInputsSpec['required'] | ComfyInputsSpec['optional'],
  forceEmpty: boolean
): ComfyInputsSpec['required'] | ComfyInputsSpec['optional'] {
  if (!section) return section

  const nextEntries = Object.entries(section).map(([key, value]) => {
    const sanitized = sanitizeInputSpec(value, forceEmpty) as InputSpec
    return [key, sanitized] as const
  })

  return Object.fromEntries(nextEntries)
}

function sanitizeHiddenSection(
  section: ComfyInputsSpec['hidden'],
  forceEmpty: boolean
): ComfyInputsSpec['hidden'] {
  if (!section) return section

  const nextEntries = Object.entries(section).map(([key, value]) => [
    key,
    sanitizeInputSpec(value, forceEmpty)
  ])

  return Object.fromEntries(nextEntries)
}

function sanitizeInputSpec(inputSpec: unknown, forceEmpty: boolean): unknown {
  if (!Array.isArray(inputSpec)) {
    return inputSpec
  }

  if (isComboInputSpecV1(inputSpec as InputSpec)) {
    return sanitizeComboInputSpecV1(inputSpec as ComboInputSpec, forceEmpty)
  }

  if (isComboInputSpecV2(inputSpec as InputSpec)) {
    return sanitizeComboInputSpecV2(inputSpec as ComboInputSpecV2, forceEmpty)
  }

  return inputSpec
}

function sanitizeComboInputSpecV1(
  inputSpec: ComboInputSpec,
  forceEmpty: boolean
): ComboInputSpec {
  const [comboValues, options] = inputSpec
  const sanitizedValues = forceEmpty ? [] : filterComboValues(comboValues)
  return [sanitizedValues, options]
}

function sanitizeComboInputSpecV2(
  inputSpec: ComboInputSpecV2,
  forceEmpty: boolean
): ComboInputSpecV2 {
  const [comboTag, options] = inputSpec
  if (!options?.options) {
    return inputSpec
  }

  const nextOptions = {
    ...options,
    options: forceEmpty ? [] : filterComboValues(options.options)
  }

  return [comboTag, nextOptions]
}

function filterComboValues(values: (number | string)[]): (number | string)[] {
  return values.filter((value) =>
    typeof value === 'string' ? !USER_CONTENT_REGEX.test(value) : true
  )
}
