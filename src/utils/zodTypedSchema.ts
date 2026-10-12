import type { TypedSchema, TypedSchemaError } from 'vee-validate'
import type { z } from 'zod'

type IssuePath = readonly PropertyKey[]

function toFormPath(path: IssuePath): string {
  return path.reduce<string>((formPath, segment, index) => {
    if (typeof segment === 'number') return `${formPath}[${segment}]`
    return index === 0 ? String(segment) : `${formPath}.${String(segment)}`
  }, '')
}

function flattenIssues(
  issues: readonly z.core.$ZodIssue[],
  prefix: IssuePath = []
): { path: string; message: string }[] {
  return issues.flatMap((issue) => {
    const issuePath = [...prefix, ...issue.path]
    const path = toFormPath(issuePath)
    const own = { path, message: issue.message }
    if (issue.code !== 'invalid_union') return [own]

    const nested = flattenIssues(issue.errors.flat(), issuePath)
    return path || nested.length === 0 ? [...nested, own] : nested
  })
}

function toTypedSchemaErrors(
  issues: readonly z.core.$ZodIssue[]
): TypedSchemaError[] {
  const errorsByPath = new Map<string, string[]>()
  for (const { path, message } of flattenIssues(issues)) {
    errorsByPath.set(path, [...(errorsByPath.get(path) ?? []), message])
  }
  return Array.from(errorsByPath, ([path, errors]) => ({ path, errors }))
}

export function toTypedSchema<TSchema extends z.ZodType>(
  schema: TSchema
): TypedSchema<z.input<TSchema>, z.output<TSchema>> {
  return {
    __type: 'VVTypedSchema',
    async parse(values) {
      const result = await schema.safeParseAsync(values)
      return result.success
        ? { value: result.data, errors: [] }
        : { errors: toTypedSchemaErrors(result.error.issues) }
    }
  }
}
