import assert from 'node:assert/strict'

import {
  redactTelemetryUrls,
  redactTelemetryValues
} from '@comfyorg/telemetry/redactTelemetryUrls'

function runWorkload(kind: string | undefined): void {
  switch (kind) {
    case 'dotted': {
      const text = 'a' + '.'.repeat(70) + '!'
      assert.equal(redactTelemetryUrls(text), text)
      return
    }
    case 'spaced': {
      const text = `https://h/x?${' '.repeat(16_000)}!`
      const expected = `https://h/x${' '.repeat(16_000)}!`
      for (let index = 0; index < 10; index++) {
        assert.equal(redactTelemetryUrls(text), expected)
      }
      return
    }
    case 'multi-start-query': {
      const text = 'a?'.repeat(8_000)
      assert.equal(redactTelemetryUrls(text), text)
      return
    }
    case 'multi-start-spaced': {
      const text = 'a? '.repeat(5_000)
      assert.equal(redactTelemetryUrls(text), text)
      return
    }
    case 'collisions': {
      const count = 20_000
      const values = Array.from({ length: count }, (_, index) => index)
      const input = Object.fromEntries(
        values.map((index) => [`https://h/x?job=${index}`, index])
      )
      const redacted = redactTelemetryValues(input)
      assert.ok(redacted)
      assert.deepEqual(Object.values(redacted), values)
      return
    }
    default:
      assert.fail(`Unknown telemetry workload: ${kind}`)
  }
}

for (let index = 0; index < 1_000; index++) {
  redactTelemetryUrls('https://h/x')
}
const calibrationStart = process.cpuUsage()
for (let index = 0; index < 10_000; index++) {
  redactTelemetryUrls('https://h/x')
}
const calibration = process.cpuUsage(calibrationStart)
const budget = Math.max(250_000, (calibration.user + calibration.system) * 20)
const start = process.cpuUsage()
runWorkload(process.argv[2])
const usage = process.cpuUsage(start)
const cpu = usage.user + usage.system
console.log(JSON.stringify({ workload: process.argv[2], cpu, budget }))
assert.ok(
  cpu < budget,
  `Telemetry workload used ${cpu}µs CPU, budget ${budget}µs`
)
