import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const postsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  'engineering-blog/en'
)

interface Post {
  file: string
  frontmatter: Record<string, string>
  body: string
}

function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error('No frontmatter block found')
  const fields: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const fieldMatch = line.match(/^(\w+):\s*(.*)$/)
    if (!fieldMatch) continue
    fields[fieldMatch[1]] = fieldMatch[2].trim().replace(/^["']|["']$/g, '')
  }
  return fields
}

function loadPosts(): Post[] {
  return readdirSync(postsDir)
    .filter((name) => name.endsWith('.mdx'))
    .map((name) => {
      const raw = readFileSync(join(postsDir, name), 'utf8')
      const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
      if (!match) throw new Error(`No frontmatter block in ${name}`)
      return { file: name, frontmatter: parseFrontmatter(raw), body: match[2] }
    })
}

const posts = loadPosts()
const REQUIRED_FIELDS = ['title', 'description', 'author', 'date']

it('finds at least one engineering blog post', () => {
  expect(posts.length).toBeGreaterThan(0)
})

it('has a unique slug (filename) per post', () => {
  const names = posts.map((post) => post.file)
  expect(new Set(names).size).toBe(names.length)
})

describe.for(posts)('$file', ({ frontmatter, body }) => {
  it.for(REQUIRED_FIELDS)('declares a non-empty %s', (field) => {
    expect(frontmatter[field]).toBeTruthy()
  })

  it('has a body', () => {
    expect(body.trim().length).toBeGreaterThan(0)
  })
})
