function devAssert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    const formatted = `[Invariant] ${message}`
    if (import.meta.env.DEV) {
      throw new Error(formatted)
    } else {
      console.error(formatted)
    }
  }
}

export { devAssert }
