import { z } from 'astro/zod'

import { workshopCreatorFormSchema } from '../src/config/workshop-creator-form'
import type {
  WorkshopCreatorFile,
  WorkshopCreatorForm
} from '../src/config/workshop-creator-form'
import type { WorkshopInputDefinition } from '../src/config/workshop-input-definition'
import { deriveWorkshopFields } from '../src/config/workshop-fields'
import { resolveSchemaReference } from '../src/config/workshop-router-openapi'
import { curateWorkshopInputs } from './workshop-input-presentation'

const object = z.record(z.string(), z.json())
type Schema = z.infer<typeof object>
type Rules = NonNullable<Parameters<typeof curateWorkshopInputs>[3]>
type Rule = Rules[string]
export function schemaAt(root: Schema, path: string): Schema {
  let value = root
  for (const key of path.split('/').filter(Boolean)) {
    const resolved = resolveSchemaReference(value, root)
    value = object.parse(
      key === '[]' ? resolved.items : object.parse(resolved.properties)[key]
    )
  }
  return resolveSchemaReference(value, root)
}

interface FieldOptions extends Rule {
  required?: boolean
}

export function createCreatorFields(
  id: string,
  curated: ReturnType<typeof curateWorkshopInputs>
) {
  const source = curated.inputSchema
  const properties: Schema = {}
  const rules: Record<string, Rule> = {}
  const required = new Set<string>()
  const files: WorkshopCreatorFile[] = []
  const sourceRequired = new Set(
    Array.isArray(source.required) ? source.required : []
  )

  function add(name: string, schema: Schema, options: FieldOptions = {}) {
    const { required: isRequired = false, ...rule } = options
    const { description, ...input } = schema
    properties[name] = input
    rules[name] = rule
    if (isRequired) required.add(name)
  }

  function addRoot(omit: readonly string[] = []) {
    for (const [name, input] of Object.entries(curated.inputs)) {
      if (input.hidden || omit.includes(name)) continue
      const schema = schemaAt(source, name)
      const [field] = deriveWorkshopFields(
        { type: 'object', properties: { [name]: schema } },
        [],
        []
      )
      if (field.kind === 'text' && field.valueType === 'json') continue
      const { defaultSource, ...rule } = input
      add(name, schema, {
        ...rule,
        defaultCandidates: [],
        required: sourceRequired.has(name)
      })
    }
  }

  function url(
    name: string,
    label: string,
    isRequired = false,
    media: NonNullable<WorkshopInputDefinition['urlUpload']> = 'image'
  ) {
    add(
      name,
      { type: 'string', format: 'uri', pattern: '^https?://' },
      {
        label,
        help: '',
        advanced: false,
        control: 'text-box',
        required: isRequired,
        urlUpload: media,
        ...(media === 'image' ? { imageSource: 'url' } : {})
      }
    )
  }

  function file(
    name: string,
    label: string,
    maxItems = 1,
    isRequired = false,
    mimeTypes?: string[]
  ) {
    files.push({
      name,
      label,
      accept: 'image',
      maxItems,
      required: isRequired,
      ...(mimeTypes ? { mimeTypes } : {})
    })
  }

  function prompt(path: string, name = 'prompt') {
    add(name, schemaAt(source, path), {
      label: name === 'text' ? 'Text' : 'Prompt',
      help: '',
      advanced: false,
      control: 'text-area',
      required: true
    })
  }

  function settings(
    path: string,
    names: readonly string[],
    prefix: string,
    overrides: Rules = {}
  ) {
    const group = schemaAt(source, path)
    const root = {
      ...group,
      ...(source.components ? { components: source.components } : {})
    }
    const projected = curateWorkshopInputs(
      'creator/settings',
      root,
      [],
      Object.fromEntries(names.map((name) => [name, overrides[name] ?? {}]))
    )
    for (const name of names) {
      const input = projected.inputs[name]
      const { defaultSource, ...rule } = input
      add(
        prefix + name,
        object.parse(object.parse(projected.inputSchema.properties)[name]),
        {
          ...rule,
          ...(Object.hasOwn(projected.defaultInput, name)
            ? {
                fixed: z
                  .union([z.string(), z.number(), z.boolean()])
                  .parse(projected.defaultInput[name])
              }
            : {})
        }
      )
    }
  }

  function build(request: WorkshopCreatorForm['request']) {
    const scalarRules = Object.fromEntries(
      Object.entries(rules).filter(([name]) => Object.hasOwn(properties, name))
    )
    const form = curateWorkshopInputs(
      id,
      {
        type: 'object',
        properties,
        required: [...required],
        additionalProperties: false
      },
      [],
      scalarRules
    )
    const inputs: Record<string, WorkshopInputDefinition> = { ...form.inputs }
    for (const field of files)
      inputs[field.name] = {
        label: field.label,
        help: rules[field.name]?.help ?? '',
        control: 'media',
        hidden: false,
        advanced: false
      }
    return workshopCreatorFormSchema.parse({
      parameters: form.inputSchema,
      inputs,
      ...(Object.keys(form.defaultInput).length
        ? { fixedValues: form.defaultInput }
        : {}),
      files,
      request
    })
  }
  return {
    source,
    properties,
    rules,
    required,
    add,
    addRoot,
    url,
    file,
    prompt,
    settings,
    build
  }
}
