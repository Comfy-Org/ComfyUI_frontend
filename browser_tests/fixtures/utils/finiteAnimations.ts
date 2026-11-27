/** Runs in the page. Resolves once every running finite animation on `scope` has finished. */
export function finishFiniteAnimations(scope: Element | Document) {
  return Promise.allSettled(
    scope
      .getAnimations()
      .filter(
        ({ effect, playState }) =>
          playState === 'running' &&
          effect?.getComputedTiming().endTime !== Infinity
      )
      .map(({ finished }) => finished)
  )
}
