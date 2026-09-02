import type { ErrorCardData, ErrorGroup } from './types'

export function shouldRenderExecutionItemList(cards: ErrorCardData[]): boolean {
  return (
    cards.length > 0 &&
    cards.every(
      (card) =>
        card.nodeId &&
        card.errors.length > 0 &&
        card.errors.every(
          (error) => !error.isRuntimeError && Boolean(error.displayItemLabel)
        )
    )
  )
}

export function isExecutionItemListGroup(group: ErrorGroup): boolean {
  return (
    group.type === 'execution' && shouldRenderExecutionItemList(group.cards)
  )
}
