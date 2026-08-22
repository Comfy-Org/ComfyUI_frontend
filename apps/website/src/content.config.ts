import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'

import { customerStorySchema } from './content/customers.schema'
import { engineeringBlogPostSchema } from './content/engineering-blog.schema'
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

const engineeringBlog = defineCollection({
  // English-only for now (see src/content/README.md) — preserve the exact
  // path as the id for consistency with the other collections here, even
  // though there's currently only one locale folder.
  loader: glob({
    base: './src/content/engineering-blog',
    pattern: '**/*.mdx',
    generateId: ({ entry }) => entry.replace(/\.mdx$/, '')
  }),
  schema: engineeringBlogPostSchema
})

export const collections = { customers, faq, engineeringBlog }
