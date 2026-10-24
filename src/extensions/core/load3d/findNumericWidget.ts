import type {
  IBaseWidget,
  INumericWidget
} from '@/lib/litegraph/src/types/widgets'

/** Finds the numeric widget with the given name. */
export function findNumericWidget(
  widgets: IBaseWidget[] | undefined,
  name: string
): INumericWidget | undefined {
  return widgets?.find(
    (w): w is INumericWidget => w.name === name && w.type === 'number'
  )
}
