/**
 * One card width for every catalogue shelf and grid, so a card is the same
 * size whichever of them it is standing in. The shelf sizes a card as a
 * fraction of the row it scrolls in, leaving half a card showing past the
 * edge as the hint that the row keeps going.
 *
 * A phone takes its card flat rather than as a fraction, so the hint is
 * whatever the row has left over. The cap keeps 40px of it: without one a
 * 320px screen shows a single card cut off at both ends and no sign that the
 * row scrolls, which is the only hint it has — the arrows are for pointers
 * that can hover, and a phone never gets them.
 */
export const SHELF_CARD =
  'w-72 max-w-[calc(100cqw-3.75rem)] shrink-0 snap-start sm:w-[calc((100cqw-2*1.25rem)/2.5)] sm:max-w-none lg:w-[calc((100cqw-3*1.25rem)/3.5)] xl:w-[calc((100cqw-4*1.25rem)/4.5)]'

export const CARD_GRID =
  'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
