import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

import { gcsMediaPrefix, gcsPublicBase } from './src/mediaUrl'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

// The CDN url the storage plugin writes onto media docs, split into the parts
// next/image matches on. Derived from the same normalized values payload.config
// builds those urls with, so a custom host, base path, or prefix needs no second
// edit here. GCS_PUBLIC_BASE_URL may carry a base path (`https://cdn/assets`),
// which prefixes the media prefix in the stored url and so in the pattern too.
// Gated on GCS_BUCKET like the storage plugin itself: with GCS disabled the
// pattern is unused, and a malformed GCS_PUBLIC_BASE_URL would otherwise throw
// here and take down the local-disk media setup it has no bearing on.
const cdnRemotePatterns = (): NonNullable<NextConfig['images']>['remotePatterns'] => {
  if (!process.env.GCS_BUCKET) return undefined
  const cdnBase = new URL(gcsPublicBase)
  const cdnBasePath = cdnBase.pathname.replace(/^\/+|\/+$/g, '')
  return [
    {
      protocol: cdnBase.protocol === 'http:' ? 'http' : 'https',
      hostname: cdnBase.hostname,
      port: cdnBase.port || undefined,
      pathname: `/${[cdnBasePath, gcsMediaPrefix, '**'].filter(Boolean).join('/')}`,
    },
  ]
}

const nextConfig: NextConfig = {
  images: {
    // Local disk path, used when the GCS storage plugin is disabled (no GCS_BUCKET).
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
    // Admin thumbnails when media is served from the CDN-backed bucket.
    remotePatterns: cdnRemotePatterns(),
  },
  // Next 16 bundles with Turbopack, which resolves TypeScript sources natively —
  // the Payload template's `webpack.resolve.extensionAlias` hook is not applied
  // and is not needed. Re-add it only alongside a `next build --webpack`.
  turbopack: {
    root: path.resolve(dirname, '../..'),
  },
  // This app is the admin panel and API only — the public site is apps/website.
  // There is no route at `/`, so send it to the panel rather than a 404.
  redirects: async () => [{ source: '/', destination: '/admin', permanent: false }],
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
