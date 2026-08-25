import { vi } from 'vitest'
import { nextTick } from 'vue'

/** Controllable IntersectionObserver: happy-dom's implementation never fires,
 * so tests install this stub and drive visibility by hand. */
export class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  readonly observed: Element[] = []

  constructor(
    readonly callback: (
      entries: IntersectionObserverEntry[],
      observer: IntersectionObserver
    ) => void
  ) {
    FakeIntersectionObserver.instances.push(this)
  }

  observe(element: Element) {
    this.observed.push(element)
  }

  unobserve() {}
  disconnect() {}

  intersect(isIntersecting: boolean) {
    this.callback(
      this.observed.map(
        (target) =>
          ({ target, isIntersecting, time: 0 }) as IntersectionObserverEntry
      ),
      this as unknown as IntersectionObserver
    )
  }
}

/** Installs the stub for the current test; returns the class for driving. */
export function stubIntersectionObserver(): typeof FakeIntersectionObserver {
  FakeIntersectionObserver.instances = []
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  return FakeIntersectionObserver
}

/** Marks every observer as intersecting (or not). Observers are created on a
 * post-flush watcher, so this waits a tick before firing and another after so
 * dependent watchers have run. */
export async function setAllIntersecting(isIntersecting: boolean) {
  await nextTick()
  for (const observer of FakeIntersectionObserver.instances)
    observer.intersect(isIntersecting)
  await nextTick()
}
