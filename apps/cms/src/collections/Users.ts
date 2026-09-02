import type { CollectionConfig } from 'payload'

import { adminOnly, adminPanel } from '../access/adminOnly'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    // Admin-only across the board: a `website-preview` key must not be able to
    // read other users' API keys, mint itself an admin account, or reach the
    // admin panel.
    admin: adminPanel,
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role'],
  },
  auth: {
    // Enable API-key auth so a `website-preview` user can be issued a key for
    // authenticated draft reads by the website's preview deployment. The key
    // authenticates as that user, so it is `role` — not the auth method — that
    // keeps it read-only. Email/password login stays enabled.
    // See build-spec Part B (B3).
    useAPIKey: true,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation !== 'create') {
          return data
        }
        // The bootstrap user is created before any admin exists to grant the
        // role, so the first account is always an admin — otherwise a fresh
        // install has nobody who can reach the admin panel. Runs inside the
        // create's transaction, where the new row is not yet visible.
        const { totalDocs } = await req.payload.count({ collection: 'users', req })
        return totalDocs === 0 ? { ...data, role: 'admin' } : data
      },
    ],
  },
  fields: [
    // Email added by default
    {
      name: 'role',
      type: 'select',
      required: true,
      // Least privilege: a new account can only read drafts until an admin
      // promotes it. The bootstrap hook above overrides this for the first user.
      defaultValue: 'website-preview',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Website preview (draft reads only)', value: 'website-preview' },
      ],
    },
  ],
}
