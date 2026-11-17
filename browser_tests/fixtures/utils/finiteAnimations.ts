/** Runs in the page. Resolves once every finite animation on `scope` has finished. */
export function finishFiniteAnimations(scope: Element | Document) {
  return Promise.allSettled(
    scope
      .getAnimations()
      .filter(({ effect }) => effect?.getComputedTiming().endTime !== Infinity)
      .map(({ finished }) => finished)
  )
}
