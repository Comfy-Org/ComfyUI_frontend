import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Gallery } from './collections/Gallery'
import { Events } from './collections/Events'
import { Creators } from './collections/Creators'
import { Teams } from './collections/Teams'
import { Tools } from './collections/Tools'
import { rebuildWebsiteEndpoint } from './endpoints/rebuildWebsite'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      beforeDashboard: ['/components/RebuildSiteButton#RebuildSiteButton'],
    },
    // Prefill the login form with the seeded admin credentials in local dev only
    // (`prefillOnly` fills the fields without auto-submitting). Never in
    // production — that would ship credentials into the login page.
    autoLogin:
      process.env.NODE_ENV !== 'production' &&
      process.env.PAYLOAD_ADMIN_EMAIL &&
      process.env.PAYLOAD_ADMIN_PASSWORD
        ? {
            email: process.env.PAYLOAD_ADMIN_EMAIL,
            password: process.env.PAYLOAD_ADMIN_PASSWORD,
            prefillOnly: true,
          }
        : false,
  },
  collections: [Gallery, Events, Media, Creators, Teams, Tools, Users],
  endpoints: [rebuildWebsiteEndpoint],
  // Field-level localization for content (not admin chrome). Only fields marked
  // `localized` carry a per-locale value; everything else stays single-value.
  // Fallback is on by default, so a missing `zh-CN` value reads through to `en`.
  localization: {
    locales: [
      { code: 'en', label: 'English' },
      { code: 'zh-CN', label: '中文' },
    ],
    defaultLocale: 'en',
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [],
})
