import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import {
  zAutogrowOptions,
  zMatchTypeOptions,
  zDynamicGroupInputSpec
} from '@/schemas/nodeDefSchema'
import type { InputSpec, ComfyInputsSpec } from '@/schemas/nodeDefSchema'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'

const dynamicTypeResolvers: Record<
  string,
  (inputSpec: InputSpecV2) => string[]
> = {
  COMFY_AUTOGROW_V3: resolveAutogrowType,
  COMFY_DYNAMICGROUP_V3: (input) =>
    resolveTemplateTypes(
      zDynamicGroupInputSpec.safeParse([input.type, input]).data?.[1].template
    ),
  COMFY_MATCHTYPE_V3: (input) =>
    zMatchTypeOptions
      .safeParse(input)
      .data?.template.allowed_types.split(',') ?? []
}

export function resolveInputType(input: InputSpecV2): string[] {
  return input.type in dynamicTypeResolvers
    ? dynamicTypeResolvers[input.type](input)
    : input.type.split(',')
}

function resolveAutogrowType(rawSpec: InputSpecV2): string[] {
  const { input } = zAutogrowOptions.safeParse(rawSpec).data?.template ?? {}
  return resolveTemplateTypes(input)
}

function resolveTemplateTypes(input?: ComfyInputsSpec): string[] {
  const inputTypes: (Record<string, InputSpec> | undefined)[] = [
    input?.required,
    input?.optional
  ]
  return inputTypes.flatMap((inputType) =>
    Object.entries(inputType ?? {}).flatMap(([name, v]) =>
      resolveInputType(transformInputSpecV1ToV2(v, { name }))
    )
  )
}
