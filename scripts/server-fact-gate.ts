import { runChangedLineLint } from './changed-line-lint'
import { isGatedPath } from './server-fact-gate-core'
import { SERVER_FACT_CONFIG } from './server-fact-oxlint'

runChangedLineLint({
  name: 'server-facts',
  config: SERVER_FACT_CONFIG,
  isGatedPath,
  includeDeletions: true
})
