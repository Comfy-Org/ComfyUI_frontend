import { describe, expect, it } from 'vitest'

import type { LayoutTemplateId } from './layoutTemplates'
import {
  buildGridTemplate,
  getTemplate,
  LAYOUT_TEMPLATES
} from './layoutTemplates'

/** Extract area rows from a grid template string. */
function parseAreaRows(gridStr: string) {
  return gridStr
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('"'))
    .map((l) => {
      const match = l.match(/"([^"]+)"\s*(.*)/)
      return {
        areas: match?.[1].split(/\s+/) ?? [],
        fraction: match?.[2]?.trim() || '1fr'
      }
    })
}

describe('buildGridTemplate', () => {
  const dualTemplate = getTemplate('dual')!

  it('returns original gridTemplate when no overrides', () => {
    const result = buildGridTemplate(dualTemplate)
    expect(result).toBe(dualTemplate.gridTemplate)
  })

  it('applies column fraction overrides', () => {
    const originalRows = parseAreaRows(dualTemplate.gridTemplate)
    const colCount = originalRows[0].areas.length

    const fractions = Array.from({ length: colCount }, (_, i) => i + 1)
    const result = buildGridTemplate(dualTemplate, {
      columnFractions: fractions
    })

    const colLine = result
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('/'))
    expect(colLine).toBe(`/ ${fractions.map((f) => `${f}fr`).join(' ')}`)
  })

  it('applies row fraction overrides in correct positions', () => {
    const result = buildGridTemplate(dualTemplate, {
      rowFractions: [2]
    })
    const rows = parseAreaRows(result)
    expect(rows[0].fraction).toBe('2fr')
  })

  it('reorders zone areas in output', () => {
    const originalRows = parseAreaRows(dualTemplate.gridTemplate)
    const uniqueAreas = [...new Set(originalRows.flatMap((r) => r.areas))]
    const swapped = [uniqueAreas[1], uniqueAreas[0]]

    const result = buildGridTemplate(dualTemplate, {
      zoneOrder: swapped
    })
    const resultRows = parseAreaRows(result)

    expect(resultRows[0].areas[0]).toBe(originalRows[0].areas[1])
    expect(resultRows[0].areas[1]).toBe(originalRows[0].areas[0])
  })

  it('preserves row count when applying overrides', () => {
    const result = buildGridTemplate(dualTemplate, {
      rowFractions: [1]
    })
    const resultRows = parseAreaRows(result)
    const originalRows = parseAreaRows(dualTemplate.gridTemplate)
    expect(resultRows).toHaveLength(originalRows.length)
  })

  it('falls back to original columns when fractions length mismatches', () => {
    const originalColLine = dualTemplate.gridTemplate
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('/'))

    const result = buildGridTemplate(dualTemplate, {
      columnFractions: [1] // wrong count — should be ignored
    })
    const resultColLine = result
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('/'))

    expect(resultColLine).toBe(originalColLine)
  })

  it('applies combined overrides together', () => {
    const originalRows = parseAreaRows(dualTemplate.gridTemplate)
    const uniqueAreas = [...new Set(originalRows.flatMap((r) => r.areas))]
    const swapped = [uniqueAreas[1], uniqueAreas[0]]
    const colCount = originalRows[0].areas.length

    const result = buildGridTemplate(dualTemplate, {
      zoneOrder: swapped,
      rowFractions: [5],
      columnFractions: Array.from({ length: colCount }, () => 2)
    })

    const resultRows = parseAreaRows(result)
    expect(resultRows[0].areas[0]).toBe(originalRows[0].areas[1])
    expect(resultRows[0].fraction).toBe('5fr')
    const colLine = result
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('/'))
    expect(colLine).toContain('2fr')
  })

  it('empty overrides produce same structure as original', () => {
    const result = buildGridTemplate(dualTemplate, {})
    const resultRows = parseAreaRows(result)
    const originalRows = parseAreaRows(dualTemplate.gridTemplate)
    expect(resultRows.map((r) => r.areas)).toEqual(
      originalRows.map((r) => r.areas)
    )
  })
})

describe('getTemplate', () => {
  it('returns undefined for invalid ID', () => {
    expect(
      getTemplate('nonexistent' as unknown as LayoutTemplateId)
    ).toBeUndefined()
  })

  it('returns matching template for each known ID', () => {
    for (const template of LAYOUT_TEMPLATES) {
      expect(getTemplate(template.id)).toBe(template)
    }
  })
})

describe('LAYOUT_TEMPLATES', () => {
  it('has unique IDs', () => {
    const ids = LAYOUT_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every template has at least one zone', () => {
    for (const template of LAYOUT_TEMPLATES) {
      expect(template.zones.length).toBeGreaterThan(0)
    }
  })

  it('every template has valid default zone references', () => {
    for (const template of LAYOUT_TEMPLATES) {
      const zoneIds = template.zones.map((z) => z.id)
      expect(zoneIds).toContain(template.defaultRunControlsZone)
      expect(zoneIds).toContain(template.defaultPresetStripZone)
    }
  })
})
