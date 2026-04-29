import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

type PromotedInputLike = {
  name: string
  _widget?: IBaseWidget
}

export function matchPromotedInput(
  inputs: PromotedInputLike[] | undefined,
  widget: IBaseWidget
): PromotedInputLike | undefined {
  if (!inputs) return undefined

  const exactMatch = inputs.find((input) => input._widget === widget)
  if (exactMatch) return exactMatch

  const sameNameMatches = inputs.filter((input) => input.name === widget.name)
  return sameNameMatches.length === 1 ? sameNameMatches[0] : undefined
}
