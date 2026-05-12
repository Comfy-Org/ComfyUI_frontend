import { legacyMenuCompat } from '@/lib/litegraph/src/contextMenuCompat'
import type { IContextMenuValue } from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSearchBoxStore } from '@/stores/workspace/searchBoxStore'

const REPLACE_SETTING_ID = 'Comfy.NodeSearchBox.ReplaceCanvasMenu'

/**
 * When the experimental "replace canvas menu" setting is enabled, the
 * right-click canvas menu's "Add Node" entry opens the Vue node search box
 * (which already includes blueprints, partner nodes, core nodes, and
 * extensions) instead of the legacy LiteGraph category submenu.
 *
 * The replacement is identified by callback identity against
 * {@link LGraphCanvas.onMenuAdd} so it remains stable across the translation
 * wrapper installed by {@link useContextMenuTranslation}.
 */
export const useCanvasSearchBoxMenu = () => {
  legacyMenuCompat.install(LGraphCanvas.prototype, 'getCanvasMenuOptions')

  const originalGetCanvasMenuOptions =
    LGraphCanvas.prototype.getCanvasMenuOptions

  const wrapped = function (
    this: LGraphCanvas,
    ...args: Parameters<typeof originalGetCanvasMenuOptions>
  ) {
    const items = originalGetCanvasMenuOptions.apply(this, args)

    const settingStore = useSettingStore()
    if (!settingStore.get(REPLACE_SETTING_ID)) return items

    return items.map((item) =>
      isLegacyAddNode(item) ? buildSearchBoxAddNode(item) : item
    )
  }

  LGraphCanvas.prototype.getCanvasMenuOptions = wrapped
  legacyMenuCompat.registerWrapper(
    'getCanvasMenuOptions',
    wrapped,
    originalGetCanvasMenuOptions,
    LGraphCanvas.prototype
  )
}

function isLegacyAddNode(
  item: IContextMenuValue | null
): item is IContextMenuValue {
  return (
    !!item &&
    typeof item === 'object' &&
    item.callback === LGraphCanvas.onMenuAdd
  )
}

function buildSearchBoxAddNode(original: IContextMenuValue): IContextMenuValue {
  return {
    ...original,
    has_submenu: false,
    submenu: undefined,
    callback: () => {
      useSearchBoxStore().toggleVisible()
    }
  }
}
