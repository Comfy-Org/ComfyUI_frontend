export type LayoutTemplateId = 'single' | 'dual'

export interface LayoutZone {
  id: string
  /** i18n key for the zone label */
  label: string
  gridArea: string
}

export interface LayoutTemplate {
  id: LayoutTemplateId
  /** i18n key for the template label */
  label: string
  /** i18n key for the template description */
  description: string
  icon: string
  gridTemplate: string
  zones: LayoutZone[]
  /** Zone ID where run controls go by default */
  defaultRunControlsZone: string
  /** Zone ID where preset strip goes by default */
  defaultPresetStripZone: string
}

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: 'single',
    label: 'linearMode.layout.templates.single',
    description: 'linearMode.layout.templates.singleDesc',
    icon: 'icon-[lucide--panel-right]',
    gridTemplate: `
      "main" 1fr
      / 1fr
    `,
    zones: [
      {
        id: 'main',
        label: 'linearMode.layout.zones.main',
        gridArea: 'main'
      }
    ],
    defaultRunControlsZone: 'main',
    defaultPresetStripZone: 'main'
  },
  {
    id: 'dual',
    label: 'linearMode.layout.templates.dual',
    description: 'linearMode.layout.templates.dualDesc',
    icon: 'icon-[lucide--columns-2]',
    gridTemplate: `
      "left right" 1fr
      / 1fr 1fr
    `,
    zones: [
      {
        id: 'left',
        label: 'linearMode.layout.zones.left',
        gridArea: 'left'
      },
      {
        id: 'right',
        label: 'linearMode.layout.zones.right',
        gridArea: 'right'
      }
    ],
    defaultRunControlsZone: 'right',
    defaultPresetStripZone: 'left'
  }
]

export function getTemplate(id: LayoutTemplateId): LayoutTemplate | undefined {
  return LAYOUT_TEMPLATES.find((t) => t.id === id)
}

export interface GridOverride {
  zoneOrder?: string[]
  columnFractions?: number[]
  rowFractions?: number[]
}

/**
 * Build a CSS grid-template string from a template and optional overrides.
 * When overrides are provided, zone order and column/row fractions are adjusted.
 * Returns the original gridTemplate if no overrides apply.
 */
export function buildGridTemplate(
  template: LayoutTemplate,
  overrides?: GridOverride
): string {
  if (!overrides) return template.gridTemplate

  const { zoneOrder, columnFractions, rowFractions } = overrides

  // Parse the template's grid areas to determine row/column structure
  const areaLines = template.gridTemplate
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('"'))

  if (areaLines.length === 0) return template.gridTemplate

  // Extract area names per row and row fractions
  const rows = areaLines.map((line) => {
    const match = line.match(/"([^"]+)"\s*(.*)/)
    if (!match) return { areas: [] as string[], fraction: '1fr' }
    const areas = match[1].split(/\s+/)
    const fraction = match[2].trim() || '1fr'
    return { areas, fraction }
  })

  // Determine unique column count from first row
  const colCount = rows[0]?.areas.length ?? 0
  // Apply zone order reordering if provided
  let reorderedRows = rows
  if (zoneOrder && zoneOrder.length > 0) {
    // Build a mapping from old position to new position
    const allAreas = rows.flatMap((r) => r.areas)
    const uniqueAreas = [...new Set(allAreas)]
    const reorderMap = new Map<string, string>()
    for (let i = 0; i < Math.min(zoneOrder.length, uniqueAreas.length); i++) {
      reorderMap.set(uniqueAreas[i], zoneOrder[i])
    }

    reorderedRows = rows.map((row) => ({
      ...row,
      areas: row.areas.map((a) => reorderMap.get(a) ?? a)
    }))
  }

  // Build row fraction strings
  const rowFrStrs = reorderedRows.map((row, i) => {
    if (rowFractions && i < rowFractions.length) {
      return `${rowFractions[i]}fr`
    }
    return row.fraction
  })

  // Build column fraction string
  let colStr: string
  if (columnFractions && columnFractions.length === colCount) {
    colStr = columnFractions.map((f) => `${f}fr`).join(' ')
  } else {
    // Extract original column definitions from the "/" line
    const slashLine = template.gridTemplate
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('/'))
    colStr = slashLine ? slashLine.substring(1).trim() : '1fr '.repeat(colCount)
  }

  // Assemble
  const areaStrs = reorderedRows.map(
    (row, i) => `"${row.areas.join(' ')}" ${rowFrStrs[i]}`
  )

  return `\n      ${areaStrs.join('\n      ')}\n      / ${colStr}\n    `
}
