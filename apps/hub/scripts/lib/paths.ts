import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const SITE_DIR = path.resolve(__dirname, '..', '..')
export const REPO_ROOT = path.join(SITE_DIR, '..')
export const TEMPLATES_DIR =
  process.env.HUB_TEMPLATES_DIR || path.join(SITE_DIR, '..', 'templates')
export const CONTENT_DIR = path.join(SITE_DIR, 'src', 'content', 'templates')
export const THUMBNAILS_DIR = path.join(
  SITE_DIR,
  'public',
  'workflows',
  'thumbnails'
)
export const WORKFLOWS_DIR = path.join(SITE_DIR, 'public', 'workflows')
export const LOGOS_SRC_DIR = path.join(TEMPLATES_DIR, 'logo')
export const LOGOS_DEST_DIR = path.join(SITE_DIR, 'public', 'logos')
export const AVATARS_SRC_DIR = path.join(SITE_DIR, 'avatars')
export const AVATARS_DEST_DIR = path.join(
  SITE_DIR,
  'public',
  'workflows',
  'avatars'
)
