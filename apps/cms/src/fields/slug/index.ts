import type { TextField } from 'payload'

import { formatSlug } from './formatSlug'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
  validate: (value: string | null | undefined) =>
    typeof value === 'string' && SLUG_PATTERN.test(value)
      ? true
      : 'Enter a slug of lowercase letters, numbers and single hyphens (for example my-event). Titles without Latin characters do not generate one automatically.',
})
