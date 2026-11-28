import assert from 'node:assert/strict'

import {
  redactTelemetryUrls,
  redactTelemetryValues
} from '@comfyorg/telemetry/redactTelemetryUrls'

const WORKLOADS: Record<string, () => void> = {
  dotted: () => {
    const text = 'a' + '.'.repeat(70) + '!'
    assert.equal(redactTelemetryUrls(text), text)
  },
  spaced: () => {
    const text = `https://h/x?${' '.repeat(16_000)}!`
    const expected = `https://h/x${' '.repeat(16_000)}!`
    for (let index = 0; index < 10; index++) {
      assert.equal(redactTelemetryUrls(text), expected)
    }
  },
  'multi-start-query': () => {
    const text = 'a?'.repeat(8_000)
    assert.equal(redactTelemetryUrls(text), text)
  },
  'multi-start-spaced': () => {
    const text = 'a? '.repeat(5_000)
    assert.equal(redactTelemetryUrls(text), text)
  },
  'quote-boundary-run': () => {
    const text = '/?"'.repeat(5_000)
    assert.equal(redactTelemetryUrls(text), '/"'.repeat(5_000))
  },
  'glued-boundary-run': () => {
    const text = `https://h/x?a=${'/'.repeat(16_000)}`
    assert.equal(redactTelemetryUrls(text), 'https://h/x')
  },
  'glued-sibling-run': () => {
    const text = '//h|//'.repeat(2_730)
    assert.equal(redactTelemetryUrls(text), text)
  },
  collisions: () => {
    const count = 20_000
    const values = Array.from({ length: count }, (_, index) => index)
    const input = Object.fromEntries(
      values.map((index) => [`https://h/x?job=${index}`, index])
    )
    const redacted = redactTelemetryValues(input)
    assert.ok(redacted)
    assert.deepEqual(Object.values(redacted), values)
  }
}

function runCalibration(): void {
  const pattern = /(?:https?:)?\/\/[^\s?#]+/g
  const text = 'see https://h/x?a=1 and //h/y#z '.repeat(64)
  for (let index = 0; index < 8_000; index++) {
    assert.equal(text.match(pattern)?.length, 128)
  }
}

const kind = process.argv[2] ?? ''
assert.ok(Object.hasOwn(WORKLOADS, kind), `Unknown telemetry workload: ${kind}`)

runCalibration()
const calibrationStart = process.cpuUsage()
runCalibration()
const calibration = process.cpuUsage(calibrationStart)
const budgetMultiplier = kind === 'collisions' ? 40 : 10
const budget = Math.max(
  250_000,
  (calibration.user + calibration.system) * budgetMultiplier
)
const start = process.cpuUsage()
WORKLOADS[kind]()
const usage = process.cpuUsage(start)
const cpu = usage.user + usage.system
console.log(JSON.stringify({ workload: kind, cpu, budget }))
assert.ok(
  cpu < budget,
  `Telemetry workload used ${cpu}µs CPU, budget ${budget}µs`
)
