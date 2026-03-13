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

  return (
    inputs.find((input) => input._widget === widget) ??
    inputs.find((input) => input.name === widget.name)
  )
}
