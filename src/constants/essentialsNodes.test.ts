import { describe, expect, it } from 'vitest'

import {
  ESSENTIALS_CATEGORY_CANONICAL,
  ESSENTIALS_NODE_PATHS,
  ESSENTIALS_NODE_PATH_MAP,
  ESSENTIALS_NODE_RANK,
  ESSENTIALS_SECTIONS,
  ESSENTIALS_SECTION_RANK,
  ESSENTIALS_SUBGROUPS,
  ESSENTIALS_SUBGROUP_RANK,
  TOOLKIT_BLUEPRINT_MODULES,
  TOOLKIT_NOVEL_NODE_NAMES,
  resolveBackendEssentialsPath
} from './essentialsNodes'

describe('essentialsNodes', () => {
  it('has no duplicate node names', () => {
    const seen = new Set<string>()
    for (const [name] of ESSENTIALS_NODE_PATHS) {
      expect(seen.has(name), `"${name}" duplicated`).toBe(false)
      seen.add(name)
    }
  })

  it('every node path references a known section', () => {
    for (const [name, path] of ESSENTIALS_NODE_PATHS) {
      expect(
        ESSENTIALS_SECTIONS.includes(path.section),
        `"${name}" → unknown section "${path.section}"`
      ).toBe(true)
    }
  })

  it('every node subgroup is declared under its section', () => {
    for (const [name, path] of ESSENTIALS_NODE_PATHS) {
      if (!path.subgroup) continue
      const allowed = ESSENTIALS_SUBGROUPS[path.section]
      expect(
        allowed.includes(path.subgroup),
        `"${name}" → unknown subgroup "${path.subgroup}" under "${path.section}"`
      ).toBe(true)
    }
  })

  it('ESSENTIALS_NODE_PATH_MAP covers every entry', () => {
    for (const [name, path] of ESSENTIALS_NODE_PATHS) {
      expect(ESSENTIALS_NODE_PATH_MAP.get(name)).toEqual(path)
    }
  })

  it('TOOLKIT_NOVEL_NODE_NAMES excludes Inputs & Outputs nodes', () => {
    for (const [name, path] of ESSENTIALS_NODE_PATHS) {
      if (path.section === 'Inputs & Outputs') {
        expect(TOOLKIT_NOVEL_NODE_NAMES.has(name)).toBe(false)
      }
    }
  })

  it('TOOLKIT_NOVEL_NODE_NAMES excludes SubgraphBlueprint-prefixed nodes', () => {
    for (const name of TOOLKIT_NOVEL_NODE_NAMES) {
      expect(name.startsWith('SubgraphBlueprint.')).toBe(false)
    }
  })

  it('TOOLKIT_BLUEPRINT_MODULES contains comfy_essentials', () => {
    expect(TOOLKIT_BLUEPRINT_MODULES.has('comfy_essentials')).toBe(true)
  })

  it('section rank reflects declaration order', () => {
    ESSENTIALS_SECTIONS.forEach((s, i) => {
      expect(ESSENTIALS_SECTION_RANK.get(s)).toBe(i)
    })
  })

  it('subgroup rank reflects declaration order within each section', () => {
    for (const [section, subs] of Object.entries(ESSENTIALS_SUBGROUPS)) {
      const rank = ESSENTIALS_SUBGROUP_RANK.get(section)!
      subs.forEach((sub, i) => expect(rank.get(sub)).toBe(i))
    }
  })

  it('node rank is per-bucket sequential', () => {
    const counters = new Map<string, number>()
    for (const [name, path] of ESSENTIALS_NODE_PATHS) {
      const key = path.subgroup
        ? `${path.section}\0${path.subgroup}`
        : path.section
      const expected = counters.get(key) ?? 0
      expect(ESSENTIALS_NODE_RANK.get(name)).toBe(expected)
      counters.set(key, expected + 1)
    }
  })

  it('canonical map normalizes section labels case-insensitively', () => {
    for (const section of ESSENTIALS_SECTIONS) {
      expect(ESSENTIALS_CATEGORY_CANONICAL.get(section.toLowerCase())).toBe(
        section
      )
    }
  })

  it('resolveBackendEssentialsPath handles legacy + new labels', () => {
    expect(resolveBackendEssentialsPath('basics')).toEqual({
      section: 'Inputs & Outputs'
    })
    expect(resolveBackendEssentialsPath('image generation')).toEqual({
      section: 'Generate'
    })
    expect(resolveBackendEssentialsPath('Generate')).toEqual({
      section: 'Generate'
    })
    expect(resolveBackendEssentialsPath(undefined)).toBeUndefined()
    expect(resolveBackendEssentialsPath('nonsense')).toBeUndefined()
  })
})
