import { z } from 'zod'

import { PERF_IDENTITY_SCHEMA_VERSION } from '@e2e/fixtures/helpers/perfWorkloadIdentity'

const perfWorkloadIdentitySchema = z.object({
  schemaVersion: z.literal(PERF_IDENTITY_SCHEMA_VERSION),
  topology: z.object({
    hash: z.string(),
    nodes: z.number(),
    visibleNodes: z.number(),
    inputs: z.number(),
    outputs: z.number(),
    links: z.number(),
    maxFanOut: z.number(),
    widgets: z.number()
  }),
  environment: z.object({
    renderer: z.enum(['legacy', 'vue']),
    canvasInfoEnabled: z.boolean().nullable(),
    viewportWidth: z.number(),
    viewportHeight: z.number(),
    devicePixelRatio: z.number(),
    frontendVersion: z.string(),
    frontendCommit: z.string(),
    buildMode: z.enum(['development', 'production', 'test']),
    browserVersion: z.string(),
    gpuClass: z.enum(['hardware', 'software', 'swiftshader', 'unknown'])
  })
})

const perfMeasurementV2Schema = z.object({
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

const perfMeasurementSchema = perfMeasurementV2Schema.extend({
  taskOtherDurationMs: z.number().nullable(),
  v8CompileDurationMs: z.number().nullable(),
  devToolsCommandDurationMs: z.number().nullable(),
  threadTimeMs: z.number().nullable(),
  processTimeMs: z.number().nullable(),
  accountedTaskDurationMs: z.number().nullable(),
  taskAccountingResidualMs: z.number().nullable(),
  missingCdpMetrics: z.array(z.string()),
  nonMonotonicCdpMetrics: z.array(z.string()),
  workloadIdentity: perfWorkloadIdentitySchema
})

export type PerfMeasurement = z.infer<typeof perfMeasurementSchema>

const rejectedRafNumberSchema = z.union([
  z.number(),
  z.null().transform(() => Number.NaN)
])
const rejectedPerfMeasurementSchema = perfMeasurementSchema.extend({
  rafIntervalsMs: z.array(rejectedRafNumberSchema),
  rafIntervalP50Ms: rejectedRafNumberSchema,
  rafIntervalP95Ms: rejectedRafNumberSchema,
  rafIntervalP99Ms: rejectedRafNumberSchema,
  rafIntervalMaxMs: rejectedRafNumberSchema
})

export const perfMeasurementResultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('accepted'),
    measurement: perfMeasurementSchema
  }),
  z.object({
    kind: z.literal('rejected'),
    reason: z.string().min(1),
    measurement: rejectedPerfMeasurementSchema
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

const perfReportV3Schema = z.object({
  schemaVersion: z.literal(3),
  timestamp: z.string(),
  gitSha: z.string(),
  branch: z.string(),
  measurements: z.array(perfMeasurementResultSchema)
})

export type PerfReportV3 = z.infer<typeof perfReportV3Schema>

const perfMeasurementResultV2Schema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('accepted'),
    measurement: perfMeasurementV2Schema
  }),
  z.object({
    kind: z.literal('rejected'),
    reason: z.string().min(1),
    measurement: perfMeasurementV2Schema
  })
])

const perfReportV2Schema = z.object({
  schemaVersion: z.literal(2),
  timestamp: z.string(),
  gitSha: z.string(),
  branch: z.string(),
  measurements: z.array(perfMeasurementResultV2Schema)
})

const perfReportV1Schema = z.object({
  schemaVersion: z.literal(1).optional(),
  timestamp: z.string(),
  gitSha: z.string(),
  branch: z.string(),
  measurements: z.array(z.unknown())
})

export const perfReportSchema = z.union([
  perfReportV3Schema,
  perfReportV2Schema,
  perfReportV1Schema
])
export type PerfReport = z.infer<typeof perfReportSchema>
