import type { TextField } from 'payload'

import { formatSlug } from './formatSlug'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Payload types a text field's `data` as `Partial<unknown>`, so the source title
// is read through a checked lookup rather than indexed off it directly.
const readString = (data: unknown, key: string): string | undefined => {
  if (typeof data !== 'object' || data === null) return undefined
  const raw = (data as Record<string, unknown>)[key]
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined
}

// A slug that auto-derives from `sourceField` when left empty and formats any
// value that is provided (typed in the admin or set by the seed). Follows the
// Payload website template's slug convention without its custom admin component.
export const slugField = (sourceField = 'title'): TextField => ({
  name: 'slug',
  type: 'text',
  unique: true,
  index: true,
  admin: {
    position: 'sidebar',
  },
  hooks: {
    beforeValidate: [
      ({ data, value }) => {
        const source = typeof value === 'string' && value.length > 0 ? value : data?.[sourceField]
        if (typeof source !== 'string' || source.length === 0) {
          return value
        }
        // `formatSlug` is ASCII-only, so a title with no Latin characters
        // produces nothing. Leave the field unset rather than storing '' —
        // `validate` then asks the editor for one, and Postgres allows many
        // NULLs under the unique index while it allows only one ''.
        return formatSlug(source) || undefined
      },
    ],
  },
  // Validates what the document will store, not what was typed. The
  // `beforeValidate` hook above runs only in the create/update operation, while
  // the admin validates the raw form value as it builds form state — so without
  // repeating the normalization here, "My Event" and an empty slug awaiting its
  // title both read as invalid and block a save the server would have accepted.
  validate: (value: string | null | undefined, { data }) => {
    const source =
      typeof value === 'string' && value.length > 0 ? value : readString(data, sourceField)
    const slug = source ? formatSlug(source) : ''
    return SLUG_PATTERN.test(slug)
      ? true
      : 'Enter a slug of lowercase letters, numbers and single hyphens (for example my-event). Titles without Latin characters do not generate one automatically.'
  },
})
