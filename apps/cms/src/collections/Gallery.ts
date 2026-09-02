import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { authenticatedOrPublished } from '../access/authenticatedOrPublished'
import { slugField } from '../fields/slug'
import { websitePreview } from './websitePreview'

export const Gallery: CollectionConfig = {
  slug: 'gallery',
  access: {
    read: authenticatedOrPublished,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status'],
    // List page for now — switch to `/gallery/<slug>` once a detail page
    // exists. Build-spec B4.
    preview: websitePreview('/gallery'),
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      // The only localized field: an editor enters per-locale titles and the
      // zh-CN gallery renders the Chinese one (falling back to en when missing).
      // The rendered alt / video aria-label is this title, so localizing it also
      // localizes the on-page text alternative for free.
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    slugField(),
    {
      // The still shown in the grid, and the poster for a video item. Required
      // on every item, so a video can never render without a poster (ticket 01).
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      // Optional motion. When set, the card autoplays it over the thumbnail.
      name: 'video',
      type: 'upload',
      relationTo: 'media',
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
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            if (!value && siblingData._status === 'published') {
              return new Date()
            }
            return value
          },
        ],
      },
    },
  ],
}
