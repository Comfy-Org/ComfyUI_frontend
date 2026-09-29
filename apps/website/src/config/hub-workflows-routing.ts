import type { HubWorkflowsRouting } from './hub-workflows-manifest'

/**
 * Who answers `/hub/workflows/*` names the website does not build, and which
 * old workflows-site URLs the router sends to a website page. Changing
 * `defaultOwner` or `legacyRedirects` is the reviewed migration step: flip `defaultOwner` to `website` and list each moved
 * `/workflows/<slug>/` URL once its page is in `hub-workflow-names.json`.
 */
export const hubWorkflowsRouting: HubWorkflowsRouting = {
  defaultOwner: 'workflows-site',
  legacyRedirects: {}
}
