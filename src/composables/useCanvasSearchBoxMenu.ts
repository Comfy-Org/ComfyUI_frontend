import { legacyMenuCompat } from '@/lib/litegraph/src/contextMenuCompat'
import type {
  ContextMenu,
  IContextMenuValue
} from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSearchBoxStore } from '@/stores/workspace/searchBoxStore'

const REPLACE_SETTING_ID = 'Comfy.NodeSearchBox.ReplaceCanvasMenu'
const WRAPPER_MARK = Symbol('useCanvasSearchBoxMenu.wrapper')

/**
 * When the experimental "replace canvas menu" setting is enabled, the
 * right-click canvas menu's "Add Node" entry opens the Vue node search box
 * (which already includes blueprints, partner nodes, core nodes, and
 * extensions) instead of the legacy LiteGraph category submenu.
 *
 * The replacement is identified by callback identity against
 * {@link LGraphCanvas.onMenuAdd} so it remains stable across the translation
 * wrapper installed by {@link useContextMenuTranslation}. The original
 * right-click event is forwarded via {@link ContextMenu.getFirstEvent} so the
 * resulting node lands at the click position instead of canvas center.
 *
 * Installation is idempotent: repeated calls (e.g. HMR remounts) do not stack
 * wrappers because the wrapper is tagged and detected on re-entry.
 */
export const useCanvasSearchBoxMenu = () => {
  legacyMenuCompat.install(LGraphCanvas.prototype, 'getCanvasMenuOptions')

  const previousGetCanvasMenuOptions =
    LGraphCanvas.prototype.getCanvasMenuOptions
  if (isOurWrapper(previousGetCanvasMenuOptions)) return

  const wrapped: typeof previousGetCanvasMenuOptions = function (
    this: LGraphCanvas,
    ...args
  ) {
    const items = previousGetCanvasMenuOptions.apply(this, args)

    const settingStore = useSettingStore()
    if (!settingStore.get(REPLACE_SETTING_ID)) return items

    return items.map((item) =>
      isLegacyAddNode(item) ? buildSearchBoxAddNode(item) : item
    )
  }
  markAsOurWrapper(wrapped)

  LGraphCanvas.prototype.getCanvasMenuOptions = wrapped
  legacyMenuCompat.registerWrapper(
    'getCanvasMenuOptions',
    wrapped,
    previousGetCanvasMenuOptions,
    LGraphCanvas.prototype
  )
}

function isOurWrapper(fn: unknown): boolean {
  return !!fn && (fn as { [WRAPPER_MARK]?: true })[WRAPPER_MARK] === true
}

function markAsOurWrapper(fn: object) {
  Object.defineProperty(fn, WRAPPER_MARK, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false
  })
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
    callback: (
      _value?: unknown,
      _options?: unknown,
      _event?: MouseEvent,
      previousMenu?: ContextMenu<unknown>
    ) => {
      const triggerEvent = previousMenu?.getFirstEvent() as
        | CanvasPointerEvent
        | undefined
      const store = useSearchBoxStore()
      if (triggerEvent) {
        store.openAtEvent(triggerEvent)
      } else {
        store.toggleVisible()
      }
    }
  }
}
