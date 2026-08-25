import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  images: {
    // Local disk path, used when the GCS storage plugin is disabled (no GCS_BUCKET).
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
    // Admin thumbnails when media is served from the CDN-backed bucket. Host is
    // literal — keep in sync with GCS_PUBLIC_BASE_URL / GCS_MEDIA_PREFIX.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.comfy.org',
        pathname: '/website/cms/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname, '../..'),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
