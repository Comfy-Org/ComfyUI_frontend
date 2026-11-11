const SWITCHES = {
  layer: { param: 'pointAtIt', storageKey: 'Comfy.PointAtItPoc.enabled' },
  stroke: { param: 'pointAtItStroke', storageKey: 'Comfy.PointAtItPoc.stroke' }
}

type SwitchStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * `?<param>=on` switches it on and remembers it; `?<param>=off` forgets it.
 * Without either, the remembered choice decides, and the default is off.
 */
export function resolveSwitch(
  name: keyof typeof SWITCHES,
  search: string,
  storage: SwitchStorage
): boolean {
  const { param, storageKey } = SWITCHES[name]
  const requested = new URLSearchParams(search).get(param)
  if (requested === 'on') storage.setItem(storageKey, 'on')
  if (requested === 'off') storage.removeItem(storageKey)
  return storage.getItem(storageKey) === 'on'
}
