import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'

import { customerStorySchema } from './content/customers.schema'

const customers = defineCollection({
  // Preserve the exact path as the id (default slugification lowercases the
  // `zh-CN` locale folder, which would break locale filtering).
  loader: glob({
    base: './src/content/customers',
    pattern: '**/*.mdx',
    generateId: ({ entry }) => entry.replace(/\.mdx$/, '')
  }),
  schema: customerStorySchema
})

export const collections = { customers }
