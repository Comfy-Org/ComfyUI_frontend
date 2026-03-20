export type LayoutTemplateId = 'focus' | 'grid' | 'sidebar'

export interface LayoutZone {
  id: string
  /** i18n key for the zone label */
  label: string
  gridArea: string
  isOutput?: boolean
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
  /** Zone IDs that default to bottom alignment */
  defaultBottomAlignZones?: string[]
}

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: 'focus',
    label: 'linearMode.layout.templates.focus',
    description: 'linearMode.layout.templates.focusDesc',
    icon: 'icon-[lucide--layout-panel-left]',
    gridTemplate: `
      "main side1" 1fr
      "main side2" 1fr
      / 2fr 1fr
    `,
    zones: [
      {
        id: 'main',
        label: 'linearMode.layout.zones.main',
        gridArea: 'main',
        isOutput: true
      },
      {
        id: 'side1',
        label: 'linearMode.layout.zones.topRight',
        gridArea: 'side1'
      },
      {
        id: 'side2',
        label: 'linearMode.layout.zones.bottomRight',
        gridArea: 'side2'
      }
    ],
    defaultRunControlsZone: 'side2',
    defaultPresetStripZone: 'side1',
    defaultBottomAlignZones: ['side2']
  },
  {
    id: 'grid',
    label: 'linearMode.layout.templates.grid',
    description: 'linearMode.layout.templates.gridDesc',
    icon: 'icon-[lucide--grid-3x3]',
    gridTemplate: `
      "z1 z2 z3" 1fr
      "z4 z5 z6" 1fr
      / 1fr 1fr 1fr
    `,
    zones: [
      { id: 'z1', label: 'linearMode.layout.zones.zone1', gridArea: 'z1' },
      { id: 'z2', label: 'linearMode.layout.zones.zone2', gridArea: 'z2' },
      { id: 'z3', label: 'linearMode.layout.zones.zone3', gridArea: 'z3' },
      { id: 'z4', label: 'linearMode.layout.zones.zone4', gridArea: 'z4' },
      {
        id: 'z5',
        label: 'linearMode.layout.zones.zone5',
        gridArea: 'z5',
        isOutput: true
      },
      { id: 'z6', label: 'linearMode.layout.zones.zone6', gridArea: 'z6' }
    ],
    defaultRunControlsZone: 'z6',
    defaultPresetStripZone: 'z3',
    defaultBottomAlignZones: ['z6']
  },
  {
    id: 'sidebar',
    label: 'linearMode.layout.templates.sidebar',
    description: 'linearMode.layout.templates.sidebarDesc',
    icon: 'icon-[lucide--panel-right]',
    gridTemplate: `
      "z1 z2 sb" 1fr
      "z3 z4 sb" 1fr
      / 1fr 1fr minmax(240px, 0.8fr)
    `,
    zones: [
      { id: 'z1', label: 'linearMode.layout.zones.zone1', gridArea: 'z1' },
      {
        id: 'z2',
        label: 'linearMode.layout.zones.zone2',
        gridArea: 'z2',
        isOutput: true
      },
      { id: 'z3', label: 'linearMode.layout.zones.zone3', gridArea: 'z3' },
      { id: 'z4', label: 'linearMode.layout.zones.zone4', gridArea: 'z4' },
      {
        id: 'sb',
        label: 'linearMode.layout.zones.sidebar',
        gridArea: 'sb'
      }
    ],
    defaultRunControlsZone: 'sb',
    defaultPresetStripZone: 'sb',
    defaultBottomAlignZones: ['sb']
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
    const zoneToArea = new Map<string, string>()
    for (const row of rows) {
      for (const area of row.areas) {
        zoneToArea.set(area, area)
      }
    }

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
