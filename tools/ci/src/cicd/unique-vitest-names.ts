import type { Reporter, TestModule } from 'vitest/node'

export default class UniqueVitestNames implements Reporter {
  onTestRunEnd(modules: ReadonlyArray<TestModule>) {
    for (const module of modules) {
      const firstLocation = new Map<string, string>()
      for (const test of module.children.allTests()) {
        const { state } = test.result()
        if (state !== 'passed' && state !== 'failed') continue

        const path = module.relativeModuleId
        const location = test.location
          ? `${path}:${test.location.line}:${test.location.column}`
          : path
        const first = firstLocation.get(test.fullName)
        if (first === undefined) {
          firstLocation.set(test.fullName, location)
          continue
        }

        console.error(
          `[${module.project.name}] Duplicate test name ${JSON.stringify(test.fullName)} at ${first} and ${location}. Give each case a distinct title.`
        )
        process.exitCode = 1
      }
    }
  }
}
