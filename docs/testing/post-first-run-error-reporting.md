# Post-first-run error reporting

This is the detection contract for Gate 3 of the
[re-enable checklist](https://app.notion.com/p/3cf6d73d365080a9a84ef48d322c13b0).
Failures pass through `reportError()` while retaining the existing unsuccessful
load result, recommendation retry, and correlation cleanup behavior.

## Categories

| `failure_category`      | Stable `errorType`                         | `failure_reason`                                                                                                                                   |
| ----------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `template_loading`      | `error_loading_workflow_template_response` | `http_response`; context includes the HTTP status                                                                                                  |
| `template_loading`      | `error_loading_workflow_template`          | `catalog_unavailable`, `load_failed`                                                                                                               |
| `template_metadata`     | `error_transforming_workflow_template`     | `source_module_unavailable`, `input_metadata_unavailable`, `invalid_workflow`, `missing_image_input`, `invalid_image_input`                        |
| `semantic_binding`      | `error_transforming_workflow_template`     | `missing_output_filename`, `input_node_missing`, `input_node_ambiguous`, `missing_widget_values`, `widget_value_missing`, `widget_value_ambiguous` |
| `execution_correlation` | `error_correlating_first_run_execution`    | `acceptance_timeout`, `connection_timeout`                                                                                                         |

The existing template error types are preserved. Category and reason tags split
metadata failures from semantic binding failures without changing those types.
Older releases lack the new tags, so retain type-only queries when comparing
releases.

Template reports include `templateId` and `sourceModule`. Correlation reports
retain the submitted `templateId` after the tour closes, plus the phase, accepted
job ID when known, output node ID, output presence, buffered event counts, and
timeout duration. These new fields exclude workflow JSON, prompt text, and image
filenames.

Correlation timeouts are warnings emitted once when tracking is abandoned.
`acceptance_timeout` means acceptance was not observed within 15 seconds; it can
also represent a submission refused before receiving a job ID. It does not prove
a backend execution failed. `connection_timeout` means the existing 20-second
offline grace expired. Cancellation, dismissal, unrelated outputs, valid delayed
acceptance, recovered connections, and supported fallback behavior do not emit
these timeout reports.

## Queries

`reportError()` sets the native Datadog RUM `error.type`, the Sentry `error_type`
tag, and the legacy RUM context `error_type`. It forwards category/reason as
Sentry tags and RUM custom context.

In RUM Explorer, select the deployed version and time window, then search:

```text
env:prod-v2 service:comfy-cloud-frontend @type:error (@error.type:error_loading_workflow_template_response OR @error.type:error_loading_workflow_template OR @error.type:error_transforming_workflow_template OR @error.type:error_correlating_first_run_execution)
```

Add `@context.failure_category:semantic_binding` or
`@context.failure_reason:acceptance_timeout` to isolate a category or reason.
Staging uses `env:stg-v2`; testcloud uses `env:test-v2`.
See [RUM search syntax](https://docs.datadoghq.com/real_user_monitoring/explorer/search_syntax/)
and [custom-context filtering](https://docs.datadoghq.com/real_user_monitoring/guide/retention_filter_best_practices/).

In Sentry, select the matching project, deployment environment, and release.
For example:

```text
error_type:error_transforming_workflow_template failure_category:semantic_binding
error_type:error_correlating_first_run_execution failure_reason:acceptance_timeout
```

See [Sentry search syntax](https://docs.sentry.io/concepts/search/).

## Verification and remaining production evidence

The template-loader and tour-controller tests exercise real failure paths through
the real `reportError()` implementation. Only the Sentry and Datadog SDK boundaries
are replaced with spies. They verify both destinations, exact category/reason
fields, contextual identifiers, unsuccessful load behavior, and bounded timeout
reporting. Transform tests cover missing and ambiguous node/widget bindings.

Run the focused checks with:

```sh
NODE_OPTIONS=--no-experimental-webstorage pnpm test:unit src/platform/workflow/templates/composables/useTemplateWorkflows.test.ts src/platform/workflow/templates/utils/templateWorkflowTransforms.test.ts src/renderer/extensions/firstRunTour/tour/useFirstRunTourController.test.ts src/platform/telemetry/reportError.test.ts
```

SDK-boundary assertions do not establish live ingestion, retention, or alerting.
After deploying this change, the rollout owner must record event links from the
target environment before checking off production detection:

1. Confirm the served frontend SHA and SDK environment match the intended release.
2. In a controlled test session, trigger the actual paths with browser response
   overrides: a non-OK continuation-template response; missing image-input
   metadata; a declared widget value absent from the fetched graph; held queue
   acceptance past 15 seconds; and a disconnected socket past 20 seconds after
   acceptance.
3. Find each report in both consoles using the queries above. Record the release,
   timestamp, category/reason, expected context, and event links in the checklist.
4. Confirm a successful continuation and recovered connection produce no matching
   failure reports, and each timeout produces only one report per destination.

Keep the final Gate 3 production-detection checkbox open until those deployed-event
links are recorded.
