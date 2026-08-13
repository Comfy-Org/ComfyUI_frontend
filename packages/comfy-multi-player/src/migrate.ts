/**
 * Schema-layout versioning (schema §10): stepwise vN → vN+1 migrations,
 * composed in order; exact no-op at the current version; FAIL-CLOSED on a
 * doc newer than this package — never a best-effort read. Host-only:
 * followers receive the migrated doc via the struct stream / a new epoch.
 */

import type * as Y from "yjs";
import { definitionsMap, linksMap, metaMap, nodesMap } from "./doc.js";
import { SCHEMA_VERSION, SchemaVersionError } from "./types.js";

/**
 * Migrate a doc from schema `fromVersion` to `SCHEMA_VERSION`, in place.
 *
 * v1 is the first layout, so there is nothing to step through yet: the call
 * validates and no-ops at `fromVersion === SCHEMA_VERSION`, and rejects
 * everything else fail-closed. When a v2 layout lands, its `v1 → v2` step
 * registers here and this function composes the steps in order.
 */
export function migrate(doc: Y.Doc, fromVersion: number): void {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) {
    throw new SchemaVersionError(
      `migrate: no migration path from schema v${String(fromVersion)} (v1 is the first layout)`,
    );
  }
  if (fromVersion > SCHEMA_VERSION) {
    throw new SchemaVersionError(
      `migrate: doc schema v${fromVersion} is newer than this package's v${SCHEMA_VERSION} — refusing to read (fail-closed, schema §10)`,
    );
  }
  const stored = metaMap(doc).get("schema_version");
  if (stored !== undefined && stored !== fromVersion) {
    throw new SchemaVersionError(
      `migrate: doc meta.schema_version=${String(stored)} does not match fromVersion=${fromVersion}`,
    );
  }
  // fromVersion === SCHEMA_VERSION: validate the v1 layout, then no-op.
  // Touching the root types is enough — getMap() materializes them if the doc
  // was built elsewhere, and any type clash throws inside Yjs.
  nodesMap(doc);
  linksMap(doc);
  definitionsMap(doc);
  metaMap(doc);
}
