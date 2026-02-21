import type { TypedSchema, TypedSchemaError } from 'vee-validate'
import type { z } from 'zod'

const buildTypedSchemaErrors = (issues: z.ZodIssue[]): TypedSchemaError[] => {
  const groupedErrors = new Map<string, TypedSchemaError>()

  for (const issue of issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : ''
    const existingError = groupedErrors.get(path)

    if (existingError) {
      existingError.errors.push(issue.message)
      continue
    }

    groupedErrors.set(path, {
      path: path || undefined,
      errors: [issue.message]
    })
  }

  return [...groupedErrors.values()]
}

export const toTypedSchema = <TSchema extends z.ZodType>(
  schema: TSchema
): TypedSchema<z.input<TSchema>, z.output<TSchema>> => ({
  __type: 'VVTypedSchema',
  parse: async (values) => {
    const result = await schema.safeParseAsync(values)

    if (result.success) {
      return {
        value: result.data,
        errors: []
      }
    }

    return {
      errors: buildTypedSchemaErrors(result.error.issues)
    }
  }
})
