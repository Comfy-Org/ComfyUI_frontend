import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'

import config from '../payload.config'
import { findOrCreateByField } from './findOrCreate'
import { seedEvents } from './seedEvents'
import { seedGallery } from './seedGallery'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const cacheDir = path.resolve(dirname, '../../.media-cache')

const seed = async (): Promise<void> => {
  const payload = await getPayload({ config })

  const email = process.env.PAYLOAD_ADMIN_EMAIL
  const password = process.env.PAYLOAD_ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error('PAYLOAD_ADMIN_EMAIL and PAYLOAD_ADMIN_PASSWORD must be set')
  }
  await findOrCreateByField(payload, 'users', 'email', email, {
    email,
    password,
  })

  await seedGallery(payload, cacheDir)
  await seedEvents(payload, cacheDir)

  payload.logger.info('Seed complete')
  await payload.destroy()
}

// Top-level await so `payload run` (which awaits module evaluation, then exits)
// does not kill the process before the async seed work completes.
await seed()
process.exit(0)
