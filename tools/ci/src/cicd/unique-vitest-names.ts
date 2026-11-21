import { groupBy } from 'es-toolkit'
import type { Reporter, TestCase, TestModule } from 'vitest/node'

function sourceLocation(test: TestCase) {
  const path = test.module.relativeModuleId
  return test.location
    ? `${path}:${test.location.line}:${test.location.column}`
    : path
}

export default class UniqueVitestNames implements Reporter {
  onTestRunEnd(modules: ReadonlyArray<TestModule>) {
    for (const module of modules) {
      const testsByName = groupBy(
        [
          ...module.children.allTests('passed'),
          ...module.children.allTests('failed')
        ],
        (test) => JSON.stringify(test.fullName)
      )
      for (const [quotedName, tests] of Object.entries(testsByName)) {
        if (tests.length < 2) continue

        console.error(
          `[${module.project.name}] Duplicate test name ${quotedName} at ${tests.map(sourceLocation).join(', ')}. Give each case a distinct title.`
        )
        process.exitCode = 1
      }
    }
  }
}
