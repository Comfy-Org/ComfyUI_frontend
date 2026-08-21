import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      // Localized so an asset carries per-locale alt text; a missing zh-CN
      // value falls back to en until translated.
      name: 'alt',
      type: 'text',
      required: true,
      localized: true,
    },
  ],
  upload: true,
}
