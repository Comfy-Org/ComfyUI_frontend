import {
  transformInputSpecV1ToV2,
  transformInputSpecV2ToV1
} from '@/schemas/nodeDef/migration'
import {
  zAutogrowOptions,
  zDynamicComboInputSpec,
  zMatchTypeOptions
} from '@/schemas/nodeDefSchema'
import type { ComfyInputsSpec, InputSpec } from '@/schemas/nodeDefSchema'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'

const dynamicTypeResolvers: Record<
  string,
  (inputSpec: InputSpecV2) => string[]
> = {
  COMFY_AUTOGROW_V3: resolveAutogrowType,
  COMFY_DYNAMICCOMBO_V3: resolveDynamicComboType,
  COMFY_MATCHTYPE_V3: (input) =>
    zMatchTypeOptions
      .safeParse(input)
      .data?.template?.allowed_types?.split(',') ?? []
}

export function resolveInputType(input: InputSpecV2): string[] {
  return input.type in dynamicTypeResolvers
    ? dynamicTypeResolvers[input.type](input)
    : input.type.split(',')
}

function resolveAutogrowType(rawSpec: InputSpecV2): string[] {
  const { input } = zAutogrowOptions.safeParse(rawSpec).data?.template ?? {}
  return resolveInputsSpecTypes(input)
}

function resolveDynamicComboType(rawSpec: InputSpecV2): string[] {
  const options =
    zDynamicComboInputSpec.safeParse(transformInputSpecV2ToV1(rawSpec))
      .data?.[1].options ?? []

  return options.flatMap(({ inputs }) => resolveInputsSpecTypes(inputs))
}

function resolveInputsSpecTypes(inputs: ComfyInputsSpec | undefined): string[] {
  const inputGroups: (Record<string, InputSpec> | undefined)[] = [
    inputs?.required,
    inputs?.optional
  ]
  return inputGroups.flatMap((group) =>
    Object.entries(group ?? {}).flatMap(([name, spec]) =>
      resolveInputType(transformInputSpecV1ToV2(spec, { name }))
    )
  )
}
