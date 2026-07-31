import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { authenticatedOrPublished } from '../access/authenticatedOrPublished'
import { slugField } from '../fields/slug'

export const Gallery: CollectionConfig = {
  slug: 'gallery',
  access: {
    read: authenticatedOrPublished,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status'],
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    slugField(),
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'creator',
      type: 'relationship',
      relationTo: 'creators',
      required: true,
    },
    {
      name: 'team',
      type: 'relationship',
      relationTo: 'teams',
    },
    {
      name: 'tool',
      type: 'relationship',
      relationTo: 'tools',
      required: true,
    },
    {
      name: 'href',
      type: 'text',
    },
  ],
}
