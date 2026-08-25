import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: {
    // Enable API-key auth so a low-privilege `website-preview` user can be issued
    // a key for authenticated draft reads by the website's preview deployment.
    // Email/password login stays enabled. See build-spec Part B (B3).
    useAPIKey: true,
  },
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
}
