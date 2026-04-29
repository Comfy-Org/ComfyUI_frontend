import { z } from 'zod'

const zPropertyBase = z.object({
  _order: z.number().optional()
})

const zStringProperty = zPropertyBase.extend({
  type: z.literal('string'),
  value: z.string()
})

const zBooleanProperty = zPropertyBase.extend({
  type: z.literal('boolean'),
  value: z.boolean()
})

const zNumberProperty = zPropertyBase.extend({
  type: z.literal('number'),
  value: z.number(),
  min: z.number().optional(),
  max: z.number().optional()
})

export const zUserProperty = z.discriminatedUnion('type', [
  zStringProperty,
  zBooleanProperty,
  zNumberProperty
])

export const zUserProperties = z.record(z.string(), zUserProperty)

export type PropertyType = 'string' | 'boolean' | 'number'

export type UserProperty = z.infer<typeof zUserProperty>
export type UserProperties = z.infer<typeof zUserProperties>

export interface PropertySuggestion {
  type: PropertyType
  min?: number
  max?: number
}

export function createDefaultProperty(type: PropertyType): UserProperty {
  switch (type) {
    case 'string':
      return { type: 'string', value: '' }
    case 'boolean':
      return { type: 'boolean', value: false }
    case 'number':
      return { type: 'number', value: 0 }
  }
}

export function createPropertyFromSuggestion(
  suggestion: PropertySuggestion
): UserProperty {
  switch (suggestion.type) {
    case 'string':
      return { type: 'string', value: '' }
    case 'boolean':
      return { type: 'boolean', value: false }
    case 'number':
      return {
        type: 'number',
        value: suggestion.min ?? 0,
        ...(suggestion.min !== undefined && { min: suggestion.min }),
        ...(suggestion.max !== undefined && { max: suggestion.max })
      }
  }
}

export function coverageOpacityClass(count: number, total: number): string {
  if (total <= 0) return 'opacity-40'
  if (count >= total) return 'font-semibold'
  const ratio = count / total
  if (ratio > 0.66) return 'opacity-75'
  if (ratio > 0.33) return 'opacity-55'
  return 'opacity-40'
}

export function getAssetUserProperties(
  userMetadata: Record<string, unknown> | undefined
): UserProperties {
  if (!userMetadata?.user_properties) return {}
  const result = zUserProperties.safeParse(userMetadata.user_properties)
  return result.success ? result.data : {}
}
