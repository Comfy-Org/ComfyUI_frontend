import { start } from '../utils'
import lg from '../utils/litegraph'

// Load things once per test file before to ensure its all warmed up for the tests
beforeAll(async () => {
  const originalWarn = console.warn
  console.error = function (...args) {
    if (['Error: Not implemented: window.alert'].includes(args[0])) {
      return
    }
  }
  console.warn = function (...args) {
    if (
      [
        "sMethod=='pointer' && !window.PointerEvent",
        'Warning, nodes missing on pasting'
      ].includes(args[0])
    ) {
      return
    }
    originalWarn.apply(console, args)
  }
  console.log = function (...args) {}

  lg.setup(global)
  await start({ resetEnv: true })
  lg.teardown(global)
})
