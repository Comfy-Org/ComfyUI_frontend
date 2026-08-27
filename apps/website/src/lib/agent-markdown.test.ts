import { describe, expect, it } from 'vitest'

import {
  apiMarkdown,
  homepageMarkdown,
  notFoundMarkdown
} from './agent-markdown'

describe('homepageMarkdown', () => {
  const markdown = homepageMarkdown()

  it('opens with a single H1 and substantial content', () => {
    expect(markdown.startsWith('# Comfy — ')).toBe(true)
    expect(markdown.match(/^# /gm)).toHaveLength(1)
    expect(markdown.length).toBeGreaterThan(500)
  })

  it('has a section hierarchy', () => {
    const sections = markdown.match(/^## /gm) ?? []
    expect(sections.length).toBeGreaterThanOrEqual(5)
  })

  it('uses the same i18n headings as the rendered sections', () => {
    expect(markdown).toContain('## Latest model releases')
    expect(markdown).toContain('## How ComfyUI works')
  })

  it('links the product surfaces and agent resources', () => {
    for (const needle of [
      'https://comfy.org/download',
      'https://comfy.org/cloud',
      'https://comfy.org/api',
      'https://comfy.org/openapi.json',
      'https://comfy.org/llms.txt',
      'https://comfy.org/sitemap-index.xml',
      'https://docs.comfy.org/',
      'Accept: text/markdown'
    ]) {
      expect(markdown).toContain(needle)
    }
  })

  it('contains no unresolved newline escapes from i18n strings', () => {
    expect(markdown).not.toMatch(/\S\n\S*\\n/)
    expect(markdown).not.toContain('undefined')
  })
})

describe('apiMarkdown', () => {
  const markdown = apiMarkdown()

  it('opens with a Comfy API H1', () => {
    expect(markdown.startsWith('# Comfy API — ')).toBe(true)
    expect(markdown.match(/^# /gm)).toHaveLength(1)
  })

  it('links keys, docs, SDKs, and the OpenAPI spec', () => {
    for (const needle of [
      'https://platform.comfy.org/profile/api-keys',
      'https://docs.comfy.org/development/cloud/overview',
      'https://docs.comfy.org/development/api-development/sdks',
      'pip install comfy-sdk',
      '@comfyorg/sdk',
      'https://comfy.org/openapi.json',
      'https://cloud.comfy.org/mcp'
    ]) {
      expect(markdown).toContain(needle)
    }
  })
})

describe('notFoundMarkdown', () => {
  const markdown = notFoundMarkdown()

  it('is a short recovery map for agents', () => {
    expect(markdown.startsWith('# 404')).toBe(true)
    for (const needle of [
      'https://comfy.org/llms.txt',
      'https://comfy.org/sitemap-index.xml',
      'https://comfy.org/index.md',
      'https://comfy.org/openapi.json',
      'https://docs.comfy.org/'
    ]) {
      expect(markdown).toContain(needle)
    }
  })
})
