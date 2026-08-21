/**
 * The KA-11 read gate: schema-version discipline enforced ON READ.
 *
 * KA-11's rule is "fail closed on unreadable schema and provide a `migrate()`
 * path". `migrate()` is the *provided path*; it is not the gate, because
 * nothing forces a caller through it. `project()` is what actually turns a
 * document into the graph every consumer reads, so the gate has to live there
 * too — a guard a low-context caller can skip is documentation, not
 * enforcement (issue #38).
 *
 * This module holds the ONE definition of "what schema version does this
 * document claim, and may this package read it", so the read path and the
 * migration path cannot drift into two conventions. That is literally true,
 * not aspirational: `migrate()` calls {@link readSchemaVersion} too — there is
 * no second copy of this read anywhere in `src/`.
 */

import type * as Y from "yjs";
import { SCHEMA_VERSION, SchemaVersionError } from "./types.js";

/**
 * The `meta` root's name. Spelled literally rather than reached through
 * `doc.ts`'s `metaMap()` on purpose: `Y.Doc#getMap` CREATES an absent root and
 * registers it in `doc.share`, which would turn this inspection into a repair.
 * See {@link readSchemaVersion}.
 */
const META_ROOT = "meta";

/**
 * The document's OWN claim about its layout version, read without
 * materializing anything, or `undefined` when there is no readable claim.
 *
 * "Unreadable" is three cases, and all three are fail-closed for a reader
 * (never a default to fill in):
 *
 *   1. the `meta` root is absent from `doc.share`. Read this precisely: it is
 *      NOT true that a root appears in `doc.share` only once it carries
 *      content — `Y.Doc#getMap` registers an EMPTY root immediately, and any
 *      earlier reader in the process can therefore have put it there (that is
 *      the #20 defect: an unconditional `getMap` turns an inspection into a
 *      repair). What `doc.share.has()` actually asks is "has this root been
 *      integrated — by an incoming update, or by a prior `getMap`", and the
 *      point here is only that ASKING it does not create one. A root does
 *      arrive over the WIRE only once it carries content — an empty root map
 *      is not encoded — which is why a snapshot-forked replica legitimately
 *      lacks roots the minting doc had. Case 1 ("absent") and case 2
 *      ("present but empty") both yield `undefined`, and both are fail-closed,
 *      so the distinction never has to be drawn by a caller;
 *   2. `meta` carries no `schema_version`;
 *   3. `schema_version` is not a positive integer (a string `"1"`, `null`, a
 *      float, `0`, …) — a value that is not a version cannot be compared to
 *      one.
 *
 * Typing a root that is ALREADY present (Yjs `AbstractType` → `Y.Map`, which
 * is how a replica's roots arrive from `Y.applyUpdate`) creates no struct and
 * no new share key, so this read stays byte-exact under
 * `encodeStateAsUpdate` and leaves the `doc.share` key set unchanged. It is a
 * client-side REINTERPRETATION of structs the doc already holds: the share
 * entry for a root that arrived untyped is replaced by the typed view of the
 * same structs, which is what every reader in this package (and the read-only
 * surface) does.
 *
 * Exported from the entrypoint because a host has the same question to answer
 * BEFORE it reads, and it already answers the neighbouring one that way. In
 * the cloud doc-host sidecar — `Comfy-Org/cloud`,
 * `services/agent/dochost/src/server.ts`, pinned at
 * `070dce96b4c475a0d926d570eba411f799329817` (FC-10; registry entry
 * `cloud/dochost-server` in `docs/upstream-pins.json`) — `requirePin` compares
 * `meta.catalog_version` and returns a structured `catalog_mismatch` 400
 * rather than letting a throw escape, and `handleProject` calls it before
 * `project(doc, catalog)`. The Go client lifts `catalog_mismatch` as a typed
 * sentinel; a thrown `SchemaVersionError` currently arrives as a generic
 * `apply_error` 400 instead, which is exactly the asymmetry these exports let
 * the host close. The gate below stays as the backstop for a caller that does
 * not pre-check.
 */
export function readSchemaVersion(doc: Y.Doc): number | undefined {
  if (!doc.share.has(META_ROOT)) return undefined;
  const stored = doc.getMap<unknown>(META_ROOT).get("schema_version");
  if (typeof stored !== "number" || !Number.isInteger(stored) || stored < 1) return undefined;
  return stored;
}

/**
 * {@link assertReadableSchema} against an explicit reader version.
 *
 * NOT re-exported from the entrypoint, deliberately: a caller free to choose
 * `expected` could pass the document's own version and switch the gate off.
 * It is exported from this module so the "document is OLDER than the reader"
 * arm is reachable by test today — at `SCHEMA_VERSION = 1` no older version
 * exists to construct, and an arm no test can turn red is dead code, which is
 * the vacuous-coverage trap this repo keeps hitting.
 */
export function assertSchemaVersionAgainst(doc: Y.Doc, context: string, expected: number): void {
  const stored = readSchemaVersion(doc);
  if (stored === undefined) {
    throw new SchemaVersionError(
      `${context}: doc has no readable meta.schema_version — refusing to read (fail-closed, schema §10)`,
    );
  }
  if (stored > expected) {
    throw new SchemaVersionError(
      `${context}: doc schema v${stored} is newer than this package's v${expected} — refusing to read (fail-closed, schema §10)`,
    );
  }
  if (stored < expected) {
    throw new SchemaVersionError(
      `${context}: doc schema v${stored} is older than this package's v${expected} — call migrate(doc, ${stored}) first, then read (fail-closed, schema §10)`,
    );
  }
}

/**
 * Refuse to read a document whose layout this package cannot describe
 * (KA-11). `context` names the read entrypoint for the message.
 *
 * WHY AN OLDER DOCUMENT IS REFUSED RATHER THAN MIGRATED IN PLACE. `project()`
 * is a pure read: it takes a `Y.Doc` and returns JSON, and it is a read ANY
 * replica may call — a browser follower included. Stated precisely, because
 * the looser version is false today: no follower calls it. The frontend does
 * not depend on this package at all (`@comfyorg/comfy-multi-player` is absent
 * from its `package.json` on every branch), and ADR-004 records that the
 * follower deliberately consumes only the doc-layout helpers, since it holds
 * no catalog for the document it renders. That is exactly why the rule is
 * written as a rule: `follower-boundary.md` says to treat an API that permits
 * unrestricted document mutation across this boundary as a blocking violation
 * "even if current callers behave correctly". Migrating inside a read would
 * make a read WRITE the shared document. The direct rule that breaks is
 * KA-6 / FC-5: followers never write the shared doc, and schema §10 puts
 * migration on the host precisely so followers receive the migrated document
 * via the struct stream or a new epoch. A follower that self-migrated would
 * become an independently edited replica, which is then the FC-1 raw-struct
 * divergence path (KA-1 says such replicas must exchange semantic ops, and an
 * in-place upgrade is not one — it is neither stamped nor in the op log). So
 * the version transition stays where it can be audited: the caller runs
 * `migrate(doc, storedVersion)` on the host, and only then reads. Projecting
 * an older layout as-is is not an option either — that IS the mis-projection
 * KA-11 names.
 *
 * Consistent with `migrate()` by construction, and by construction is meant
 * literally — both call {@link readSchemaVersion}, so there is no second
 * definition of "unreadable" to drift. Same failure type
 * (`SchemaVersionError`), same wording for a too-new document, and the same
 * refusal to materialize a root on the failure path — a rejected read leaves
 * `encodeStateAsUpdate(doc)` byte-identical and `doc.share` untouched.
 *
 * ONE EXCEPTION to "same failure type", recorded by Amendment A3 for
 * `migrate()` and true here for the same reason: a document whose `meta` root
 * was integrated as a different concrete Y type surfaces Yjs's own
 * constructor-clash `Error` from the `getMap` inside `readSchemaVersion`, not
 * a `SchemaVersionError`. It is still fail-closed and still a throw, but a
 * consumer matching on the error TYPE must expect it. Pinned by
 * `test/schema-version-on-read.test.ts`.
 */
export function assertReadableSchema(doc: Y.Doc, context: string): void {
  assertSchemaVersionAgainst(doc, context, SCHEMA_VERSION);
}
