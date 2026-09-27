import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'

import { customerStorySchema } from './content/customers.schema'
import { faqSchema } from './content/faq.schema'

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

const faq = defineCollection({
  loader: glob({
    base: './src/content/faq',
    pattern: '**/*.mdx',
    generateId: ({ entry }) => entry.replace(/\.mdx$/, '')
  }),
  schema: faqSchema
})

export const collections = { customers, faq }
