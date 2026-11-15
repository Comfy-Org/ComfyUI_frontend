/**
 * A document minted by the *cloud doc-host's* comfy-multi-player, checked in as
 * literal bytes.
 *
 * WHY THESE BYTES ARE A FIXTURE AND NOT A `mint()` CALL. Every other test in
 * this directory mints with the package the follower itself compiles against,
 * so the writer and the reader are the same build by construction and no test
 * can observe host/client skew. That blind spot shipped in PM-2052: the cloud
 * doc-host moved to document schema v5 while the frontend still read v4, so
 * the follower's exact-equality gate refused every document the host minted.
 * The public remediation carriers are
 * https://github.com/Comfy-Org/ComfyUI_frontend/pull/20625 and
 * https://github.com/Comfy-Org/ComfyUI_frontend/pull/20620.
 *
 * Holding the bytes constant makes frontend-side schema drift fail. It does not
 * monitor the cloud package pin: regenerate the fixture when that pin changes.
 * A `mint()` call here would make writer and reader the same build again.
 *
 * Produced by `Y.encodeStateAsUpdate(mint({ nodes: [{ id: 99, type: 'Sink' }],
 * links: [] }, { types: {} }))` under comfy-multi-player 0.3.10. The test also
 * decodes these bytes and asserts their schema version so provenance drift is
 * loud rather than a stale label.
 */
export const DOC_HOST_MULTI_PLAYER_VERSION = '0.3.10'
export const DOC_HOST_SCHEMA_VERSION = 5

export const DOC_HOST_MINTED_SINK_UPDATE_B64 =
  'AQaa8PfeDQAoAQRtZXRhDnNjaGVtYV92ZXJzaW9uAX0FKAEEbWV0YQ9jYXRhbG9nX3ZlcnNpb24BdwAnAQVub2RlcwI5OQEoAJrw994NAgJpZAF9owEoAJrw994NAgR0eXBlAXcEU2luaygAmvD33g0CDV9faW5jYXJuYXRpb24BdwEwAA=='
