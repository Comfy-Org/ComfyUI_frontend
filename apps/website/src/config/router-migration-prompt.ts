/**
 * The prompt the Router page's "Copy migration prompt" CTA puts on the
 * clipboard. The docs site embeds the same text, so a change here must be
 * mirrored there.
 */
export const ROUTER_MIGRATION_PROMPT = `Help me migrate this project's existing model integration to Comfy Router. First, inspect the codebase to understand its framework, backend or agent architecture, how it authenticates to model providers today, which models and providers it calls, how requests are built and results handled (SDKs, HTTP clients, retries, polling, file handling), and where generated outputs are stored.

Read the current documentation starting at the [Comfy Router quickstart](https://docs.comfy.org/development/comfy-router/quickstart). Follow the [API](https://docs.comfy.org/development/comfy-router/api), [models](https://docs.comfy.org/development/comfy-router/models), [headers](https://docs.comfy.org/development/comfy-router/headers), [queued delivery](https://docs.comfy.org/development/comfy-router/queue), [limitations](https://docs.comfy.org/development/comfy-router/limitations) and [API reference](https://docs.comfy.org/development/comfy-router/reference) pages. Verify endpoint availability and each model's request schema before implementing; do not assume sample code or the project's current provider payloads are current. Every model's input and output schema is served at \`https://api.comfy.org/v2/models/{provider}/{model}/openapi.json\`.

Based on the codebase, briefly explain where Comfy Router would fit. List every model call you found with the provider behind it, check each against the models page, and flag anything Router does not support or supports with different limits. Then ask me which call to migrate first, offering the representative options you found, such as the image generation call, the video generation call, or the call with the most traffic. If it is unclear whether I want the application migrated or a tool for my coding agent, clarify before making changes.

Once the call is agreed, implement the migration using the project's existing conventions:

- Choose direct REST requests or the documented official SDK based on the project's language and architecture.
- For REST, call \`https://api.comfy.org/v2/models/{provider}/{model}\` with \`X-API-Key: \${COMFY_API_KEY}\`, a unique \`Idempotency-Key\`, and \`Content-Type: application/json\`, sending the model's native input shape from its schema. Keep the key exclusively on the server, following the [headers guidance](https://docs.comfy.org/development/comfy-router/headers). Add a placeholder environment variable and setup instructions without exposing secrets.
- Use this request as the reference, after confirming its current schema and availability:

\`\`\`bash
curl --request POST \\
  --url https://api.comfy.org/v2/models/bfl/flux-2-pro \\
  --header "X-API-Key: \${COMFY_API_KEY}" \\
  --header "Idempotency-Key: \${COMFY_REQUEST_KEY}" \\
  --header "Content-Type: application/json" \\
  --data '{"prompt": "a red teapot on a windowsill, morning light"}'
\`\`\`

- Treat long-running generation as asynchronous. Where the existing code waits or polls, use queued delivery: POST to \`/v2/models/{provider}/{model}/requests\`, save the returned \`request_id\`, associate it with the requesting user or tenant, and enforce ownership when retrieving results.
- Follow the documented [polling lifecycle](https://docs.comfy.org/development/comfy-router/queue): honour \`Retry-After\`, treat \`COMPLETED\` as the terminal state, and branch on the presence of \`error_type\` rather than on a fourth status. Router has no webhooks; the status route is how you follow a request.
- Reuse the same \`Idempotency-Key\` on \`409 concurrency_limit_exceeded\`, \`429\` and \`504 deadline_exceeded\` responses so retries never duplicate a generation or a charge. Handle \`422\` validation errors from the \`detail[]\` array, and download result assets promptly because their URLs expire.
- Validate inputs, keep the existing result handling working, and expose clear progress and results.

Test the adapted call against \`https://api.comfy.org\`, then summarize what changed compared with the original call, which credentials I need to configure, how to try the feature, and what remains to migrate. Do not change any other model calls until this one is tested and I have reviewed it.`
