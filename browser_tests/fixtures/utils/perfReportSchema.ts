import { z } from 'zod'

const perfMeasurementSchema = z.object({
  name: z.string(),
  durationMs: z.number(),
  styleRecalcs: z.number(),
  styleRecalcDurationMs: z.number(),
  layouts: z.number(),
  layoutDurationMs: z.number(),
  taskDurationMs: z.number(),
  heapDeltaBytes: z.number(),
  heapUsedBytes: z.number(),
  domNodes: z.number(),
  jsHeapTotalBytes: z.number(),
  scriptDurationMs: z.number(),
  eventListeners: z.number(),
  totalBlockingTimeMs: z.number(),
  rafIntervalsMs: z.array(z.number()),
  rafIntervalCount: z.number(),
  rafIntervalP50Ms: z.number(),
  rafIntervalP95Ms: z.number(),
  rafIntervalP99Ms: z.number(),
  rafIntervalMaxMs: z.number(),
  rafIntervalsOver8_33Ms: z.number(),
  rafIntervalsOver16_67Ms: z.number(),
  rafIntervalsOver33_3Ms: z.number(),
  rafIntervalsOver50Ms: z.number()
})

export type PerfMeasurement = z.infer<typeof perfMeasurementSchema>

export const perfMeasurementResultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('accepted'),
    measurement: perfMeasurementSchema
  }),
  z.object({
    kind: z.literal('rejected'),
    reason: z.string().min(1),
    measurement: perfMeasurementSchema
  })
])

export type PerfMeasurementResult = z.infer<typeof perfMeasurementResultSchema>

export function requireAcceptedMeasurement(
  result: PerfMeasurementResult
): PerfMeasurement {
  if (result.kind === 'rejected') {
    throw new Error(
      `Rejected measurement "${result.measurement.name}": ${result.reason}`
    )
  }
  return result.measurement
}

const perfReportV2Schema = z.object({
  schemaVersion: z.literal(2),
  timestamp: z.string(),
  gitSha: z.string(),
  branch: z.string(),
  measurements: z.array(perfMeasurementResultSchema)
})

export type PerfReportV2 = z.infer<typeof perfReportV2Schema>

const perfReportV1Schema = z.object({
  schemaVersion: z.literal(1).optional(),
  timestamp: z.string(),
  gitSha: z.string(),
  branch: z.string(),
  measurements: z.array(z.unknown())
})

export const perfReportSchema = z.union([
  perfReportV2Schema,
  perfReportV1Schema
])
export type PerfReport = z.infer<typeof perfReportSchema>
