const SWITCH_PARAM = 'pointAtIt'
export const SWITCH_STORAGE_KEY = 'Comfy.PointAtItPoc.enabled'

type SwitchStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * `?pointAtIt=on` switches the layer on and remembers it; `?pointAtIt=off`
 * forgets it. Without either, the remembered choice decides, and the default is off.
 */
export function resolveSwitch(search: string, storage: SwitchStorage): boolean {
  const requested = new URLSearchParams(search).get(SWITCH_PARAM)
  if (requested === 'on') storage.setItem(SWITCH_STORAGE_KEY, 'on')
  if (requested === 'off') storage.removeItem(SWITCH_STORAGE_KEY)
  return storage.getItem(SWITCH_STORAGE_KEY) === 'on'
}
