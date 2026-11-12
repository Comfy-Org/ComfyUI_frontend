/**
 * Read-time schema-version gate (CRDT keep-alive invariant KA-11).
 *
 * KA-11: "Schema-version discipline, ENFORCED ON READ. Bump `SCHEMA_VERSION`
 * when an old reader would mis-project a new doc; fail-closed on an unreadable
 * schema."
 *
 * Before this file the follower had no read-side gate at all: the only mention
 * of the version anywhere was `expect(SCHEMA_VERSION).toBe(1)` in a test, which
 * pins the BUILD-TIME constant of the package the frontend compiled against and
 * says nothing about the version of the document that actually arrived over the
 * socket. A doc-host advancing to schema v2 would have been read with a v1
 * reader — whatever keys still parsed would render, silently and wrongly. That
 * is fail-OPEN, the exact failure KA-11 names.
 *
 * The version is read through the shared package's PUBLIC api
 * (`readSchemaVersion`, `SCHEMA_VERSION`) — never through a deep/internal
 * import — so the key name and the expected value cannot drift from the
 * writer: they are the same symbols the cloud doc-host uses. The package's own `migrate()` is deliberately
 * NOT called: it is host-only (it mutates the doc), and a follower must never
 * write the shared doc (KA-6 / FORECLOSE #5).
 */
import { SCHEMA_VERSION, readSchemaVersion } from '@comfyorg/comfy-multi-player'
import type * as Y from 'yjs'

import { assert } from '@/base/assert'

/** Thrown by {@link assertReadableSchema}; carries the version actually found. */
export class FollowerSchemaError extends Error {
  constructor(
    readonly found: unknown,
    message: string
  ) {
    super(message)
    this.name = 'FollowerSchemaError'
  }
}

/**
 * Fail closed unless the merged doc declares exactly the schema version this
 * build was written against.
 *
 * A MISSING `meta.schema_version` fails too, and deliberately: every doc the
 * host produces is seeded by the shared package (`initDoc`/`mint` both write
 * the key), so an absent version means the bytes are not a document this
 * reader understands — which is precisely "unreadable schema".
 *
 * @throws FollowerSchemaError when the doc is not readable at this version.
 */
export function assertReadableSchema(doc: Y.Doc): void {
  const found = readSchemaVersion(doc)
  if (found === SCHEMA_VERSION) return

  const message =
    `CRDT follower: doc meta.schema_version=${String(found)} is not the ` +
    `v${SCHEMA_VERSION} layout this build reads — refusing to project it ` +
    `(fail-closed, keep-alive invariant KA-11).`

  try {
    // Route through the repo's central invariant channel: console.error in
    // every environment, Sentry reporter in production.
    assert(
      false,
      'CRDT follower: doc meta.schema_version is not the layout this build reads — refusing to project it (fail-closed, keep-alive invariant KA-11)',
      { found }
    )
  } catch {
    // Swallowed on purpose. `assert` throws only under DEV, so it is NOT a
    // fail-closed mechanism by itself — outside DEV it returns normally and
    // the caller would carry on projecting an unreadable doc. The typed throw
    // below is what actually closes the gate, in every environment.
  }
  throw new FollowerSchemaError(found, message)
}
