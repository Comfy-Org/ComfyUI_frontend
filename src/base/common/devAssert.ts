type AssertReporter = (formatted: string) => void

class DevAssertionError extends Error {}

let reporter: AssertReporter | undefined

function setDevAssertReporter(fn: AssertReporter) {
  reporter = fn
}

function devAssert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    const formatted = `[Invariant] ${message}`
    console.error(formatted)
    reporter?.(formatted)

    if (import.meta.env.DEV) {
      throw new DevAssertionError(formatted)
    }
  }
}

export { devAssert, setDevAssertReporter }
