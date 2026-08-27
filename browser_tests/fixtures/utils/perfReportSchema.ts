import { z } from 'zod'

const perfWorkloadIdentitySchema = z.object({
  schemaVersion: z.literal(1),
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
  activity: z.object({
    activeProgressEntries: z.number().nullable(),
    progressEventsEmitted: z.number().nullable(),
    progressEventsReceived: z.number().nullable(),
    progressEventsApplied: z.number().nullable(),
    dirtyReasons: z.record(z.string(), z.number()).nullable(),
    foregroundDraws: z.number().nullable(),
    backgroundDraws: z.number().nullable()
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
  }),
  missingOptionalFields: z.array(z.string())
})

const perfMeasurementSchema = z.object({
  name: z.string(),
  durationMs: z.number(),
  styleRecalcs: z.number(),
  styleRecalcDurationMs: z.number(),
  layouts: z.number(),
  layoutDurationMs: z.number(),
  taskDurationMs: z.number(),
  taskOtherDurationMs: z.number().nullable(),
  v8CompileDurationMs: z.number().nullable(),
  devToolsCommandDurationMs: z.number().nullable(),
  threadTimeMs: z.number().nullable(),
  processTimeMs: z.number().nullable(),
  accountedTaskDurationMs: z.number().nullable(),
  taskAccountingResidualMs: z.number().nullable(),
  missingCdpMetrics: z.array(z.string()),
  nonMonotonicCdpMetrics: z.array(z.string()),
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
  rafIntervalsOver50Ms: z.number(),
  workloadIdentity: perfWorkloadIdentitySchema
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
