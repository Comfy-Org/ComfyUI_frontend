import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { anyone } from '../access/anyone'

// Creators, teams, and tools are identical name-bearing collections that gallery
// items relate to. Public read lets ticket 05's depth-populated anonymous fetch
// resolve them; a unique name supports ticket 04's dedup-by-name upsert.
export const nameCollection = (
  slug: string,
  labels: { singular: string; plural: string },
): CollectionConfig => ({
  slug,
  labels,
  access: {
    read: anyone,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
  ],
})
