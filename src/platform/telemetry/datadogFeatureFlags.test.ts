import { datadogRum } from '@datadog/browser-rum'
import { expect, it, vi } from 'vitest'

import { trackDatadogFeatureFlagEvaluation } from './datadogFeatureFlags'

vi.mock(import('@datadog/browser-rum'))

it.for([
  ['extension.manager:supports-v4', 'extension_manager_supports_v4'],
  ['rollout(beta)[staff]', 'rollout_beta__staff_'],
  [
    'a+b=c&&d||e>f<g!h{i}^j"k“l”~m*n?o\\p',
    'a_b_c__d__e_f_g_h_i__j_k_l__m_n_o_p'
  ]
])('replaces characters Datadog reserves in %s', ([key, normalizedKey]) => {
  trackDatadogFeatureFlagEvaluation(key, true)

  expect(datadogRum.addFeatureFlagEvaluation).toHaveBeenCalledExactlyOnceWith(
    normalizedKey,
    true
  )
})
