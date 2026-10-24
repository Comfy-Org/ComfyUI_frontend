let configuringGraphLevel = 0

export function isGraphConfiguring() {
  return configuringGraphLevel > 0
}

export function withGraphConfiguring<T>(fn: () => T): T {
  configuringGraphLevel++
  try {
    return fn()
  } finally {
    configuringGraphLevel--
  }
}
