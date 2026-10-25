import type { HubWorkflowsRouting } from './hub-workflows-manifest'

/**
 * Who answers `/hub/workflows/*` names the website does not build, and which
 * old workflows-site URLs the router sends to a website page. The router reads
 * `legacyRedirects` for `/workflows/*` from its own bundled manifest only, so
 * each entry here also needs a comfy-router edit and redeploy.
 */
export const hubWorkflowsRouting: HubWorkflowsRouting = {
  defaultOwner: 'workflows-site',
  legacyRedirects: {}
}
