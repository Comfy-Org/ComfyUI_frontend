import type { WidgetSizing } from '@comfyorg/graph-model/widgets'

import { useSettingStore } from '@/platform/settings/settingStore'

const TEXTAREA = {
  headerHeight: 24,
  visibleLines: 2,
  lineHeight: 1.5,
  paddingBottom: 8
} as const

/** Least height the Vue textarea widget renders: its header and two lines at the textarea font size. */
export function textareaMinHeight(): number {
  const fontSize = useSettingStore().get('Comfy.TextareaWidget.FontSize')
  return (
    TEXTAREA.headerHeight +
    TEXTAREA.visibleLines * TEXTAREA.lineHeight * fontSize +
    TEXTAREA.paddingBottom
  )
}

/** Raises a growable textarea row's minimum to {@link textareaMinHeight}. */
export function withTextareaFloor(
  sizing: WidgetSizing | undefined
): WidgetSizing | undefined {
  if (sizing?.kind !== 'growable') return sizing
  return {
    ...sizing,
    minHeight: Math.max(sizing.minHeight, textareaMinHeight())
  }
}
