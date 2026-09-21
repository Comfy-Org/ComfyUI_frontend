import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

interface SelectOnlyPin {
  owners: Set<symbol>
  restoreValue: boolean
}

const pins = new WeakMap<LGraphCanvas, SelectOnlyPin>()

export function acquireSelectOnlyPin(canvas: LGraphCanvas, owner: symbol) {
  const existing = pins.get(canvas)
  if (existing) {
    existing.owners.add(owner)
    return
  }
  const pin: SelectOnlyPin = {
    owners: new Set([owner]),
    restoreValue: canvas.selectOnly
  }
  pins.set(canvas, pin)
  Object.defineProperty(canvas, 'selectOnly', {
    configurable: true,
    get: () => true,
    set: (value: boolean) => {
      pin.restoreValue = value
    }
  })
}

export function releaseSelectOnlyPin(canvas: LGraphCanvas, owner: symbol) {
  const pin = pins.get(canvas)
  if (!pin?.owners.delete(owner) || pin.owners.size > 0) return
  pins.delete(canvas)
  Reflect.deleteProperty(canvas, 'selectOnly')
  canvas.selectOnly = pin.restoreValue
}
