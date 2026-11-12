type CanvasTrackerOwnership =
  | { status: 'unbound' }
  | { status: 'bound'; tracker: object }
  | { status: 'invalidated' }

let ownership: CanvasTrackerOwnership = { status: 'unbound' }

export function bindCanvasTracker(tracker: object): void {
  ownership = { status: 'bound', tracker }
}

export function invalidateCanvasTracker(): void {
  ownership = { status: 'invalidated' }
}

export function isCanvasOwner(tracker: object): boolean {
  return ownership.status === 'bound' && ownership.tracker === tracker
}

export function canCaptureCanvas(tracker: object): boolean {
  return (
    ownership.status === 'unbound' ||
    (ownership.status === 'bound' && ownership.tracker === tracker)
  )
}

export function isCanvasCaptureBlocked(): boolean {
  return ownership.status === 'invalidated'
}

export function resetCanvasTrackerForTest(): void {
  ownership = { status: 'unbound' }
}
