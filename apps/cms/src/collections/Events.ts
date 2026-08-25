import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'
import { authenticatedOrPublished } from '../access/authenticatedOrPublished'
import { slugField } from '../fields/slug'
import { websitePreview } from './websitePreview'

// `required: true` inside the `featured` group would fail every non-featured
// publish (a group's fields always exist), so the fields a featured event must
// have validate conditionally on `isFeatured` instead — drafts skip
// validation, publishing enforces it.
const requiredWhenFeatured = (
  value: unknown,
  { data }: { data: { isFeatured?: boolean | null } },
): true | string =>
  data.isFeatured && value == null ? 'Required when the event is featured' : true

export const Events: CollectionConfig = {
  slug: 'events',
  access: {
    read: authenticatedOrPublished,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  // There is no publishedAt on events: lists sort by startDateTime and the
  // carousel by featured.order, so the admin list mirrors the site's
  // newest-first ordering.
  defaultSort: '-startDateTime',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'category', 'startDateTime', '_status'],
    // List page for now — switch to `/events/<slug>` once the detail route
    // exists.
    preview: websitePreview('/events'),
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    // Stable: the slug hook suggests from the title only while the slug is
    // empty and never regenerates a non-empty value, so existing
    // /events/<slug> links survive title edits.
    { ...slugField(), required: true },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: [
        { label: 'Livestream', value: 'livestream' },
        { label: 'Hackathon', value: 'hackathon' },
        { label: 'Community', value: 'community' },
      ],
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      localized: true,
    },
    {
      name: 'startDateTime',
      type: 'date',
      required: true,
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      // Optional; the website treats a missing end as start + 1h.
      name: 'endDateTime',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      // IANA zone the website renders the display date in (for the PT/ET label);
      // a missing value defaults to Pacific, matching the site.
      name: 'timeZone',
      type: 'text',
      admin: {
        placeholder: 'America/Los_Angeles',
      },
    },
    {
      // Semantic online/in-person switch driving the virtual-vs-physical
      // presentation and the JSON-LD branch — never inferred from the
      // location text.
      name: 'locationMode',
      type: 'select',
      required: true,
      options: [
        { label: 'Online', value: 'online' },
        { label: 'In person', value: 'in-person' },
      ],
    },
    {
      name: 'locationName',
      type: 'text',
      localized: true,
      admin: {
        condition: (data) => data.locationMode === 'in-person',
      },
    },
    {
      // Absolute URL or site-relative path; the website localizes relative
      // paths itself, so the stored value is not localized.
      name: 'href',
      type: 'text',
    },
    {
      name: 'newTab',
      type: 'checkbox',
    },
    {
      name: 'ctaLabel',
      type: 'text',
      localized: true,
    },
    {
      name: 'liveVideoId',
      type: 'text',
    },
    {
      // Supersedes liveVideoId once the recording is published.
      name: 'recordingVideoId',
      type: 'text',
    },
    {
      // Past-gallery card art. A Payload group is always present, so an
      // absent card is represented by `file` being unset; whether the slot
      // renders as image or video is derived from the upload's mime type.
      name: 'cardMedia',
      type: 'group',
      fields: [
        {
          name: 'file',
          type: 'upload',
          relationTo: 'media',
        },
        {
          // Applies when `file` is a video.
          name: 'poster',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
    },
    {
      // Hero-carousel placement, independent of cardMedia.
      name: 'featured',
      type: 'group',
      admin: {
        condition: (data) => Boolean(data.isFeatured),
      },
      fields: [
        {
          name: 'order',
          type: 'number',
          validate: requiredWhenFeatured,
        },
        {
          name: 'autoplayMs',
          type: 'number',
        },
        {
          name: 'showTitle',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'media',
          type: 'group',
          fields: [
            {
              name: 'file',
              type: 'upload',
              relationTo: 'media',
              validate: requiredWhenFeatured,
            },
            {
              name: 'poster',
              type: 'upload',
              relationTo: 'media',
            },
          ],
        },
      ],
    },
  ],
}
