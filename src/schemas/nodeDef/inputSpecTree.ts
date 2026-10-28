import { reportError } from '@/platform/telemetry/reportError'
import { createInputSpecInterpreter } from '@/schemas/nodeDef/inputSpecInterpreter'
import type { InputSpecDiagnosticSink } from '@/schemas/nodeDef/inputSpecInterpreter'

const MAX_SPEC_DRIFT_REPORTS = 10
const reportedSpecDrift = new Set<string>()

const warnSpecDrift: InputSpecDiagnosticSink = (spec, error, optionIndex) => {
  const location = JSON.stringify([spec.name, spec.type, optionIndex])
  if (
    reportedSpecDrift.has(location) ||
    reportedSpecDrift.size >= MAX_SPEC_DRIFT_REPORTS
  )
    return

  reportedSpecDrift.add(location)

  reportError(new Error('Unable to parse dynamic node input specification'), {
    surface: 'graph',
    errorType: 'error_parsing_node_input_spec',
    tags: {
      failure_kind: 'degraded',
      feature_area: 'node_definition',
      operation: 'parse_input_spec',
      outcome: 'recovered'
    },
    context: {
      controlType: spec.type,
      optionIndex,
      issueCount: error.issues.length
    },
    level: 'warning'
  })
}

export const {
  splitSlotTypes,
  inputSpecTree,
  ownSlotTypes,
  dynamicComboOptionKeys,
  dynamicComboOptionTypes,
  matchTypeTemplate
} = createInputSpecInterpreter(warnSpecDrift)
