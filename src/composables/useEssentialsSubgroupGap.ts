import { ref } from 'vue'

/** @knipIgnoreUsedByStackedPR */
export const GAP_OPTIONS = ['gap-6', 'gap-8', 'gap-10'] as const
/** @knipIgnoreUsedByStackedPR */
export type GapOption = (typeof GAP_OPTIONS)[number]

/** @knipIgnoreUsedByStackedPR */
export const HEADER_COLOR_OPTIONS = [
  { id: 'muted', label: 'Muted', class: 'text-muted-foreground' },
  { id: 'primary', label: 'Primary', class: 'text-foreground' }
] as const
/** @knipIgnoreUsedByStackedPR */
export type HeaderColorId = (typeof HEADER_COLOR_OPTIONS)[number]['id']

/** @knipIgnoreUsedByStackedPR */
export const HEADER_SIZE_OPTIONS = [
  { id: '12', label: '12px', class: 'text-xs' },
  { id: '14', label: '14px', class: 'text-sm' }
] as const
/** @knipIgnoreUsedByStackedPR */
export type HeaderSizeId = (typeof HEADER_SIZE_OPTIONS)[number]['id']

/** @knipIgnoreUsedByStackedPR */
export const TILE_COLUMN_OPTIONS = [
  { id: '2', label: 'Large' },
  { id: '3', label: 'Small' }
] as const

/** @knipIgnoreUsedByStackedPR */
export const TILE_GRID_CLASS = 'grid-cols-[repeat(auto-fill,minmax(96px,1fr))]'
/** @knipIgnoreUsedByStackedPR */
export type TileColumnId = (typeof TILE_COLUMN_OPTIONS)[number]['id']

/** @knipIgnoreUsedByStackedPR */
export const JUMP_TO_VARIANTS = [
  { id: 'submenus', label: 'Submenus' },
  { id: 'flat', label: 'Flat' }
] as const
/** @knipIgnoreUsedByStackedPR */
export type JumpToVariantId = (typeof JUMP_TO_VARIANTS)[number]['id']

const subgroupGap = ref<GapOption>('gap-8')
const sectionHeaderColor = ref<HeaderColorId>('muted')
const subsectionHeaderColor = ref<HeaderColorId>('primary')
const sectionHeaderSize = ref<HeaderSizeId>('14')
const subsectionHeaderSize = ref<HeaderSizeId>('14')
const tileColumns = ref<TileColumnId>('3')
const jumpToVariant = ref<JumpToVariantId>('submenus')
const collapsibleSections = ref(false)

const lookup = <T extends { id: string }>(
  options: readonly T[],
  id: string
): T => options.find((o) => o.id === id) ?? options[0]

export function useEssentialsSubgroupGap() {
  return {
    subgroupGap,
    sectionHeaderColor,
    subsectionHeaderColor,
    sectionHeaderSize,
    subsectionHeaderSize,
    tileColumns,
    jumpToVariant,
    collapsibleSections,
    GAP_OPTIONS,
    HEADER_COLOR_OPTIONS,
    HEADER_SIZE_OPTIONS,
    TILE_COLUMN_OPTIONS,
    JUMP_TO_VARIANTS,
    sectionHeaderColorClass: () =>
      lookup(HEADER_COLOR_OPTIONS, sectionHeaderColor.value).class,
    subsectionHeaderColorClass: () =>
      lookup(HEADER_COLOR_OPTIONS, subsectionHeaderColor.value).class,
    sectionHeaderSizeClass: () =>
      lookup(HEADER_SIZE_OPTIONS, sectionHeaderSize.value).class,
    subsectionHeaderSizeClass: () =>
      lookup(HEADER_SIZE_OPTIONS, subsectionHeaderSize.value).class,
    tileColumnsClass: () => TILE_GRID_CLASS
  }
}
