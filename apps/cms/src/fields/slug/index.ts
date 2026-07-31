import type { TextField } from 'payload'

import { formatSlug } from './formatSlug'

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
        return typeof source === 'string' && source.length > 0 ? formatSlug(source) : value
      },
    ],
  },
})
