import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { gcsStorage } from '@payloadcms/storage-gcs'
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
import { isAdmin } from './access/adminOnly'
import { rebuildWebsiteEndpoint } from './endpoints/rebuildWebsite'
import { gcsMediaPrefix, gcsPublicBase } from './mediaUrl'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Media is served from the GCS bucket behind the media.comfy.org CDN, not the
// Next server's local disk — so autoplay hero videos range-serve from a fast
// origin. Gated on GCS_BUCKET: unset (local dev without creds) leaves media on
// local disk at /api/media/file/<filename>, exactly as before.
const gcsBucket = process.env.GCS_BUCKET
// Parsed defensively rather than with a bare `JSON.parse`: a malformed value
// would otherwise throw a raw SyntaxError during module init — whose message
// echoes a slice of the credential — and `JSON.parse` returns `any`, letting an
// arbitrary shape reach `new Storage(...)` unchecked. Errors here name the
// variable and nothing else.
const parseGcsCredentials = (raw: string | undefined) => {
  if (!raw) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('GCS_CREDENTIALS_JSON is not valid JSON')
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('GCS_CREDENTIALS_JSON must be a JSON object')
  }

  const { client_email: clientEmail, private_key: privateKey } = parsed as Record<string, unknown>
  if (typeof clientEmail !== 'string' || typeof privateKey !== 'string') {
    throw new Error('GCS_CREDENTIALS_JSON must be a service-account key')
  }

  return { client_email: clientEmail, private_key: privateKey }
}

// Only when the bucket is set: with GCS disabled the parsed value is discarded,
// so a stale or malformed credential would otherwise throw during module init
// and take down the local-disk fallback it has no bearing on.
const gcsCredentials = gcsBucket ? parseGcsCredentials(process.env.GCS_CREDENTIALS_JSON) : undefined

const isLocalDevelopment = process.env.NODE_ENV === 'development' && !process.env.VERCEL

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
    // (`prefillOnly` fills the fields without auto-submitting). Gated on an
    // affirmative local-dev signal rather than `NODE_ENV !== 'production'`: that
    // negative test also passes for `test` and for any staging box left on the
    // default `development`, each of which would then ship credentials into its
    // login page. A deployed CMS is never local, so `VERCEL` disqualifies every
    // Vercel environment regardless of what NODE_ENV holds there.
    autoLogin:
      isLocalDevelopment && process.env.PAYLOAD_ADMIN_EMAIL && process.env.PAYLOAD_ADMIN_PASSWORD
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
  plugins: [
    gcsStorage({
      enabled: Boolean(gcsBucket),
      bucket: gcsBucket || '',
      acl: 'Public',
      // Nest the doc prefix under the collection prefix rather than letting it
      // replace the collection prefix. `generateSignedURL` reads `docPrefix`
      // from the request body, so non-composite keys let an admin mint a signed
      // write url anywhere in a bucket that also holds hand-managed assets.
      useCompositePrefixes: true,
      // The admin browser PUTs the file straight to a signed GCS url instead of
      // POSTing it through /api/media — Vercel rejects request bodies over
      // 4.5 MB at the edge, and the event videos run 5–25 MB. The plugin's
      // default access is any authenticated user, which would let a
      // `website-preview` key mint signed write urls into the public CDN
      // bucket, so minting is admin-only. Needs bucket CORS allowing PUT from
      // the CMS origin (see README, "Media storage").
      clientUploads: {
        access: ({ req }) => isAdmin(req.user),
      },
      options: {
        projectId: process.env.GCS_PROJECT_ID,
        credentials: gcsCredentials,
      },
      collections: {
        media: {
          prefix: gcsMediaPrefix,
          // Store the raw CDN url on the doc instead of routing bytes back
          // through Payload's access-controlled /api/media/file proxy. Media is
          // already `read: anyone`, so the gate protects nothing.
          disablePayloadAccessControl: true,
          // Absolute CDN url, so the website's `new URL(doc.url, base)` uses it
          // verbatim (base ignored). Media has no imageSizes, so `size` is unused.
          generateFileURL: ({ filename, prefix }) => {
            const key = [gcsMediaPrefix, prefix, filename].filter(Boolean).join('/')
            return `${gcsPublicBase}/${key}`
          },
        },
      },
    }),
  ],
})
