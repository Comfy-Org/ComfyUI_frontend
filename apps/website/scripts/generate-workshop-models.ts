// Builds src/config/workshop-models.generated.json from two sibling checkouts:
//   ../../../../workflow_templates  (Comfy-Org/workflow_templates)
//   ../../../../ComfyUI             (Comfy-Org/ComfyUI, comfy_api_nodes/)
// For every partner-node model in generated-models.json it resolves the
// curated templates, the partner node the first template runs, that node's
// input schema straight from its define_schema(), the template's widget
// values as defaults, its price badge and its output modality.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { API_PROVIDER_MAP } from './generate-models'

const TEMPLATES_DIR = fileURLToPath(
  new URL('../../../../workflow_templates/templates', import.meta.url)
)
const API_NODES_DIR = fileURLToPath(
  new URL('../../../../ComfyUI/comfy_api_nodes', import.meta.url)
)
const WORKFLOW_TEMPLATES_BASE =
  'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates'
const OUTPUT = fileURLToPath(
  new URL('../src/config/workshop-models.generated.json', import.meta.url)
)
const EXAMPLES_PER_MODEL = 3

type Modality = 'image' | 'video' | 'audio' | '3d' | 'text'
type Primitive = string | number | boolean

type Field =
  | {
      kind: 'text'
      name: string
      label: string
      hint?: string
      multiline: boolean
      required: boolean
      default?: string
    }
  | {
      kind: 'number'
      name: string
      label: string
      hint?: string
      min: number
      max: number
      step: number
      default: number
    }
  | {
      kind: 'select'
      name: string
      label: string
      hint?: string
      options: string[]
      default: string
    }
  | {
      kind: 'toggle'
      name: string
      label: string
      hint?: string
      default: boolean
    }
  | {
      kind: 'file'
      name: string
      label: string
      hint?: string
      accept: 'image' | 'video' | 'audio'
      required: boolean
    }

// One entry of a node's inputs list. Dynamic combos carry the inputs each
// option reveals, in the order their widget values appear in a workflow.
interface InputDef {
  type: string
  name: string
  args: string
  options?: { label: string; children: InputDef[] }[]
}

interface NodeSchema {
  id: string
  displayName: string
  provider?: string
  modality?: Modality
  priceUsdFrom?: number
  inputs: InputDef[]
  sources: string[]
}

interface TemplateEntry {
  name: string
  title: string
  description?: string
  tags?: string[]
}

interface GeneratedExample {
  name: string
  title: string
  description: string
  tags: string[]
  thumbnailUrl: string
  // Present only when the template runs a different node (or a different
  // dynamic-combo path) than the model's default form.
  node?: { id: string; displayName: string }
  fields?: Field[]
  values: Record<string, Primitive>
}

interface GeneratedModel {
  thumbnailUrl?: string
  provider?: string
  modality?: Modality
  priceUsdFrom?: number
  node?: { id: string; displayName: string; template: string }
  fields: Field[]
  defaults: Record<string, Primitive>
  examples: GeneratedExample[]
}

// ---------- Python source helpers ----------

function sliceBalanced(source: string, openIndex: number): string {
  const open = source[openIndex]
  const close = open === '(' ? ')' : open === '[' ? ']' : '}'
  let depth = 0
  let inString: string | null = null
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i]
    if (inString) {
      if (ch === '\\') i++
      else if (source.startsWith(inString, i)) {
        i += inString.length - 1
        inString = null
      }
      continue
    }
    if (source.startsWith('"""', i)) {
      inString = '"""'
      i += 2
      continue
    }
    if (ch === '"' || ch === "'") {
      inString = ch
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return source.slice(openIndex + 1, i)
    }
  }
  return source.slice(openIndex + 1)
}

function splitTopLevel(body: string): string[] {
  const elements: string[] = []
  let depth = 0
  let inString: string | null = null
  let start = 0
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (inString) {
      if (ch === '\\') i++
      else if (body.startsWith(inString, i)) {
        i += inString.length - 1
        inString = null
      }
      continue
    }
    if (body.startsWith('"""', i)) {
      inString = '"""'
      i += 2
      continue
    }
    if (ch === '"' || ch === "'") inString = ch
    else if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) depth--
    else if (ch === ',' && depth === 0) {
      elements.push(body.slice(start, i))
      start = i + 1
    }
  }
  elements.push(body.slice(start))
  return elements.map((e) => e.trim()).filter(Boolean)
}

function kwarg(args: string, key: string): string | undefined {
  for (const element of splitTopLevel(args)) {
    const match = new RegExp(`^${key}\\s*=\\s*`).exec(element)
    if (match) return element.slice(match[0].length).trim()
  }
  return undefined
}

function positional(args: string, index: number): string | undefined {
  const element = splitTopLevel(args)[index]
  return element && !/^\w+\s*=/.test(element) ? element : undefined
}

function pyString(literal: string | undefined): string | undefined {
  if (!literal) return undefined
  const match =
    /^(?:f?)(?:"""([\s\S]*?)"""|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')$/.exec(
      literal
    )
  if (!match) return undefined
  return (match[1] ?? match[2] ?? match[3] ?? '').replace(/\\n/g, ' ').trim()
}

function pyNumber(literal: string | undefined): number | undefined {
  if (!literal) return undefined
  const value = Number(literal.replace(/_/g, ''))
  return Number.isFinite(value) ? value : undefined
}

function stringItems(listBody: string): string[] {
  return [...listBody.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)].map(
    (m) => m[1] ?? m[2]
  )
}

function resolveOptions(
  literal: string | undefined,
  sources: string[]
): string[] | undefined {
  if (!literal) return undefined
  if (literal.startsWith('[')) {
    const items = stringItems(sliceBalanced(literal, 0))
    return items.length ? items : undefined
  }
  const keysCall = /^list\((\w+)\.keys\(\)\)$/.exec(literal)
  const name = keysCall ? keysCall[1] : /^(\w+)$/.exec(literal)?.[1]
  if (!name) return undefined
  for (const source of sources) {
    const assignment = new RegExp(
      `^${name}\\s*(?::[^=]+)?=\\s*([\\[{(])`,
      'm'
    ).exec(source)
    if (assignment) {
      const body = sliceBalanced(
        source,
        assignment.index + assignment[0].length - 1
      )
      if (keysCall || assignment[1] === '{') {
        const keys = [...body.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)].map(
          (m) => m[1]
        )
        if (keys.length) return keys
      }
      const items = stringItems(body)
      if (items.length) return items
    }
    const enumClass = new RegExp(
      `^class ${name}\\((?:str, )?Enum\\):\\n([\\s\\S]*?)(?=^\\S)`,
      'm'
    ).exec(source)
    if (enumClass) {
      const values = [...enumClass[1].matchAll(/=\s*"((?:[^"\\]|\\.)*)"/g)].map(
        (m) => m[1]
      )
      if (values.length) return values
    }
  }
  return undefined
}

function humanize(name: string): string {
  const text = name.replace(/_/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// ---------- Schema parsing ----------

function parseInputList(listBody: string): InputDef[] {
  const defs: InputDef[] = []
  for (const element of splitTopLevel(listBody)) {
    const match = /^IO\.(\w+)\.Input\(/.exec(element)
    if (!match) continue
    const args = sliceBalanced(element, match[0].length - 1)
    const name = pyString(positional(args, 0))
    if (!name) continue
    const def: InputDef = { type: match[1], name, args }
    if (def.type === 'DynamicCombo') {
      const optionsLiteral = kwarg(args, 'options')
      if (!optionsLiteral?.startsWith('[')) continue
      def.options = splitTopLevel(sliceBalanced(optionsLiteral, 0)).flatMap(
        (option) => {
          const optionMatch = /^IO\.DynamicCombo\.Option\(/.exec(option)
          if (!optionMatch) return []
          const optionArgs = sliceBalanced(option, optionMatch[0].length - 1)
          const label = pyString(positional(optionArgs, 0))
          const childrenLiteral = positional(optionArgs, 1)
          if (!label) return []
          return [
            {
              label,
              children: childrenLiteral?.startsWith('[')
                ? parseInputList(sliceBalanced(childrenLiteral, 0))
                : []
            }
          ]
        }
      )
      if (!def.options.length) continue
    }
    defs.push(def)
  }
  return defs
}

const OUTPUT_MODALITY: Record<string, Modality> = {
  Video: 'video',
  Image: 'image',
  Audio: 'audio',
  File: '3d',
  Mesh: '3d',
  String: 'text'
}

function parseNodeSchemas(): Map<string, NodeSchema> {
  const schemas = new Map<string, NodeSchema>()
  const apisDir = join(API_NODES_DIR, 'apis')
  const apiSources = existsSync(apisDir)
    ? readdirSync(apisDir)
        .filter((f) => f.endsWith('.py'))
        .map((f) => readFileSync(join(apisDir, f), 'utf8'))
    : []
  for (const file of readdirSync(API_NODES_DIR).filter((f) =>
    f.endsWith('.py')
  )) {
    const source = readFileSync(join(API_NODES_DIR, file), 'utf8')
    const pattern = /IO\.Schema\(/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(source))) {
      const body = sliceBalanced(source, match.index + match[0].length - 1)
      const id = pyString(kwarg(body, 'node_id'))
      if (!id) continue
      const inputsLiteral = kwarg(body, 'inputs')
      const outputsLiteral = kwarg(body, 'outputs') ?? ''
      const firstOutput = /IO\.(\w+)\.Output/.exec(outputsLiteral)?.[1]
      const modality = firstOutput ? OUTPUT_MODALITY[firstOutput] : undefined
      const provider = (pyString(kwarg(body, 'category')) ?? '').split('/')[2]
      const usd = [
        ...(kwarg(body, 'price_badge') ?? '').matchAll(/"usd"\s*:\s*([\d.]+)/g)
      ]
        .map((m) => Number(m[1]))
        .filter((n) => Number.isFinite(n) && n > 0)
      schemas.set(id, {
        id,
        displayName: pyString(kwarg(body, 'display_name')) ?? id,
        ...(provider ? { provider } : {}),
        ...(modality ? { modality } : {}),
        ...(usd.length ? { priceUsdFrom: Math.min(...usd) } : {}),
        inputs: inputsLiteral?.startsWith('[')
          ? parseInputList(sliceBalanced(inputsLiteral, 0))
          : [],
        sources: [source, ...apiSources]
      })
    }
  }
  return schemas
}

function toField(def: InputDef, sources: string[]): Field | undefined {
  const { type, name, args } = def
  const optional = kwarg(args, 'optional') === 'True'
  const hint = pyString(kwarg(args, 'tooltip'))
  const label = pyString(kwarg(args, 'display_name')) ?? humanize(name)
  const base = { name, label, ...(hint ? { hint } : {}) }
  switch (type) {
    case 'String': {
      const defaultValue = pyString(kwarg(args, 'default'))
      return {
        ...base,
        kind: 'text',
        multiline: kwarg(args, 'multiline') === 'True',
        required: !optional && name === 'prompt',
        ...(defaultValue !== undefined ? { default: defaultValue } : {})
      }
    }
    case 'Int':
    case 'Float': {
      const min = pyNumber(kwarg(args, 'min'))
      const max = pyNumber(kwarg(args, 'max'))
      const defaultValue = pyNumber(kwarg(args, 'default'))
      if (min === undefined || max === undefined || defaultValue === undefined)
        return undefined
      const cap = name === 'seed' ? 999_999 : max
      return {
        ...base,
        kind: 'number',
        min,
        max: cap,
        step: pyNumber(kwarg(args, 'step')) ?? (type === 'Int' ? 1 : 0.1),
        default: Math.min(defaultValue, cap)
      }
    }
    case 'Combo': {
      const options = resolveOptions(kwarg(args, 'options'), sources)
      if (!options) return undefined
      const defaultValue = pyString(kwarg(args, 'default'))
      return {
        ...base,
        kind: 'select',
        options,
        default:
          defaultValue && options.includes(defaultValue)
            ? defaultValue
            : options[0]
      }
    }
    case 'DynamicCombo':
      return {
        ...base,
        kind: 'select',
        options: def.options!.map((o) => o.label),
        default: def.options![0].label
      }
    case 'Boolean':
      return {
        ...base,
        kind: 'toggle',
        default: kwarg(args, 'default') === 'True'
      }
    case 'Image':
    case 'Video':
    case 'Audio':
      return {
        ...base,
        kind: 'file',
        accept: type.toLowerCase() as 'image' | 'video' | 'audio',
        required: !optional
      }
    default:
      return undefined
  }
}

// Flattens the input tree into the fields a form shows, following the
// dynamic-combo choices in `chosen` (template values) or each combo's first option.
function fieldsFor(
  defs: InputDef[],
  sources: string[],
  chosen: Record<string, Primitive>
): Field[] {
  return defs.flatMap((def) => {
    const field = toField(def, sources)
    if (!field) return []
    if (!def.options) return [field]
    const picked =
      def.options.find((o) => o.label === chosen[def.name]) ?? def.options[0]
    return [field, ...fieldsFor(picked.children, sources, chosen)]
  })
}

const WIDGET_TYPES = new Set([
  'String',
  'Int',
  'Float',
  'Combo',
  'DynamicCombo',
  'Boolean'
])

// Walks widgets_values in schema order, descending into the dynamic-combo
// option the workflow selected. Stops at the first value that does not fit.
function alignWidgets(
  defs: InputDef[],
  sources: string[],
  values: unknown[],
  cursor: { index: number },
  out: Record<string, Primitive>
): boolean {
  for (const def of defs) {
    if (!WIDGET_TYPES.has(def.type)) continue
    const value = values[cursor.index]
    cursor.index += kwarg(def.args, 'control_after_generate') === 'True' ? 2 : 1
    const field = toField(def, sources)
    if (!field) return false
    const fits =
      (field.kind === 'text' && typeof value === 'string') ||
      (field.kind === 'number' && typeof value === 'number') ||
      (field.kind === 'toggle' && typeof value === 'boolean') ||
      (field.kind === 'select' &&
        typeof value === 'string' &&
        field.options.includes(value))
    if (!fits) return false
    out[def.name] =
      field.kind === 'number'
        ? Math.min(value as number, field.max)
        : (value as Primitive)
    if (def.options) {
      const picked = def.options.find((o) => o.label === value)
      if (
        !picked ||
        !alignWidgets(picked.children, sources, values, cursor, out)
      )
        return false
    }
  }
  return true
}

// ---------- Templates ----------

interface WorkflowNode {
  type: string
  widgets_values?: unknown[]
}

function isWorkflowNode(value: unknown): value is WorkflowNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string' &&
    (!('widgets_values' in value) ||
      value.widgets_values === undefined ||
      Array.isArray(value.widgets_values))
  )
}

function readWorkflow(name: string): WorkflowNode[] {
  const raw: unknown = JSON.parse(
    readFileSync(join(TEMPLATES_DIR, `${name}.json`), 'utf8')
  )
  const nodes =
    typeof raw === 'object' && raw !== null && 'nodes' in raw ? raw.nodes : []
  return Array.isArray(nodes) ? nodes.filter(isWorkflowNode) : []
}

function templateValues(
  schema: NodeSchema,
  node: WorkflowNode | undefined
): Record<string, Primitive> {
  const out: Record<string, Primitive> = {}
  if (node)
    alignWidgets(
      schema.inputs,
      schema.sources,
      node.widgets_values ?? [],
      { index: 0 },
      out
    )
  return out
}

function pickApiNode(
  nodes: WorkflowNode[],
  schemas: Map<string, NodeSchema>
): WorkflowNode | undefined {
  const score = (node: WorkflowNode) => {
    const schema = schemas.get(node.type)!
    const fields = fieldsFor(schema.inputs, schema.sources, {})
    const hasPrompt = fields.some(
      (f) => f.kind === 'text' && /prompt|text/.test(f.name)
    )
    return (hasPrompt ? 1000 : 0) + fields.length
  }
  return nodes
    .filter((node) => schemas.has(node.type))
    .sort((a, b) => score(b) - score(a))[0]
}

function slugForTemplate(name: string): string | undefined {
  if (!name.startsWith('api_')) return undefined
  const rest = name.slice(4)
  let best: { key: string; slug: string } | undefined
  for (const [key, { slug }] of Object.entries(API_PROVIDER_MAP)) {
    if (
      (rest === key || rest.startsWith(`${key}_`)) &&
      (!best || key.length > best.key.length)
    ) {
      best = { key, slug }
    }
  }
  return best?.slug
}

function thumbnailFor(name: string): string | undefined {
  return existsSync(join(TEMPLATES_DIR, `${name}-1.webp`))
    ? `${WORKFLOW_TEMPLATES_BASE}/${encodeURIComponent(name)}-1.webp`
    : undefined
}

// ---------- Main ----------

function run() {
  const generated = JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL('../src/config/generated-models.json', import.meta.url)
      ),
      'utf8'
    )
  ) as { slug: string; directory: string; canonicalSlug?: string }[]
  const partnerSlugs = new Set(
    generated
      .filter((m) => m.directory === 'partner_nodes' && !m.canonicalSlug)
      .map((m) => m.slug)
  )

  const index = JSON.parse(
    readFileSync(join(TEMPLATES_DIR, 'index.json'), 'utf8')
  ) as { templates: TemplateEntry[] }[]
  const templatesBySlug = new Map<string, TemplateEntry[]>()
  for (const category of index) {
    for (const template of category.templates) {
      const slug = slugForTemplate(template.name)
      if (!slug || !partnerSlugs.has(slug)) continue
      if (!existsSync(join(TEMPLATES_DIR, `${template.name}.json`))) continue
      const list = templatesBySlug.get(slug) ?? []
      if (!list.some((t) => t.name === template.name)) list.push(template)
      templatesBySlug.set(slug, list)
    }
  }

  const schemas = parseNodeSchemas()
  const output: Record<string, GeneratedModel> = {}
  let withFields = 0
  let withDefaults = 0

  for (const slug of [...partnerSlugs].sort()) {
    const templates = (templatesBySlug.get(slug) ?? []).filter((t) =>
      thumbnailFor(t.name)
    )
    if (!templates.length) continue
    const [first] = templates
    const apiNode = pickApiNode(readWorkflow(first.name), schemas)
    const schema = apiNode ? schemas.get(apiNode.type) : undefined
    const defaults = schema ? templateValues(schema, apiNode) : {}
    const fields = schema
      ? fieldsFor(schema.inputs, schema.sources, defaults)
      : []
    if (fields.length) withFields++
    if (Object.keys(defaults).length) withDefaults++

    const examples: GeneratedExample[] = templates
      .slice(0, EXAMPLES_PER_MODEL)
      .map((template) => {
        const exampleNode = pickApiNode(readWorkflow(template.name), schemas)
        const exampleSchema = exampleNode
          ? schemas.get(exampleNode.type)
          : undefined
        const values = exampleSchema
          ? templateValues(exampleSchema, exampleNode)
          : {}
        const exampleFields = exampleSchema
          ? fieldsFor(exampleSchema.inputs, exampleSchema.sources, values)
          : []
        const ownForm =
          exampleSchema !== undefined &&
          (exampleSchema.id !== schema?.id ||
            JSON.stringify(exampleFields) !== JSON.stringify(fields))
        return {
          name: template.name,
          title: template.title,
          description: template.description ?? '',
          tags: template.tags ?? [],
          thumbnailUrl: thumbnailFor(template.name)!,
          ...(ownForm
            ? {
                node: {
                  id: exampleSchema.id,
                  displayName: exampleSchema.displayName
                },
                fields: exampleFields
              }
            : {}),
          values
        }
      })

    output[slug] = {
      thumbnailUrl: thumbnailFor(first.name),
      ...(schema?.provider ? { provider: schema.provider } : {}),
      ...(schema?.modality ? { modality: schema.modality } : {}),
      ...(schema?.priceUsdFrom !== undefined
        ? { priceUsdFrom: schema.priceUsdFrom }
        : {}),
      ...(schema
        ? {
            node: {
              id: schema.id,
              displayName: schema.displayName,
              template: first.name
            }
          }
        : {}),
      fields,
      defaults,
      examples
    }
  }

  writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)
  process.stdout.write(
    `Written ${Object.keys(output).length}/${partnerSlugs.size} partner models ` +
      `(${withFields} with fields, ${withDefaults} with template defaults) to ${OUTPUT}\n`
  )
}

run()
