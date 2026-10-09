/**
 * One card width for every catalogue shelf and grid, so a card is the same
 * size whichever of them it is standing in. The shelf sizes a card as a
 * fraction of the row it scrolls in, leaving half a card showing past the
 * edge as the hint that the row keeps going.
 */
export const SHELF_CARD =
  'w-72 shrink-0 snap-start sm:w-[calc((100cqw-2*1.25rem)/2.5)] lg:w-[calc((100cqw-3*1.25rem)/3.5)] xl:w-[calc((100cqw-4*1.25rem)/4.5)]'

/** The grid beside the Models category sidebar, a column narrower. */
export const CARD_GRID_BESIDE_NAV =
  'grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
