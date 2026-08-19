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
    // Preview drafts on the always-SSR preview deployment (WEBSITE_PREVIEW_URL);
    // it renders drafts because PREVIEW_MODE is set there. Points at the list page
    // for now — switch to `/gallery/<slug>` once a detail page exists. Build-spec B4.
    preview: () => {
      const base = process.env.WEBSITE_PREVIEW_URL
      return base ? `${base.replace(/\/$/, '')}/gallery` : null
    },
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
