import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { anyone } from '../access/anyone'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: anyone,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
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
