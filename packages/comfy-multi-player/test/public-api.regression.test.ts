/**
 * Guards the package's public entrypoint surface.
 *
 * KA-3 / FC-3: the op layer is the only sanctioned way to mutate shared state.
 * Re-exporting `src/doc.ts` from `src/index.ts` handed consumers the raw Y.Doc
 * layout and low-level mutators, so a caller could write the shared document
 * without going through `applyOps` and bypass stamp gating (KA-2), idempotency
 * and convergence (KA-4), and the catalog check at mint (KA-12).
 *
 * ADR-004 deliberately retains three layout reads for the frontend follower;
 * The internals list is derived from `src/doc.ts` at runtime rather than
 * hardcoded, so a newly added document internal is covered the moment it exists.
 *
 * The sanctioned-name exception is the reviewable artifact: widening it is a diff,
 * not a silent consequence of adding an export. New consumers should prefer
 * `src/read.ts`, whose surface hands back no live handle.
 * KA-1 additionally exposes the read-only encoding-loss diagnostic.
 */
import { describe, expect, it } from "vitest";
import * as documentInternals from "../src/doc.js";
import * as publicApi from "../src/index.js";

const SANCTIONED_DOC_EXPORTS: readonly string[] = [
  "nodesMap",
  "linksMap",
  "OPAQUE_WIDGETS_KEY",
  "encodingLosses",
];

describe("public API", () => {
  /**
   * Regression: document internals were re-exported from the package entrypoint.
   * Fix: #18 — https://github.com/Comfy-Org/comfy-multi-player/issues/18
   */
  it("regression: keeps every non-follower src/doc.ts runtime export off the package entrypoint", () => {
    const internalNames = Object.keys(documentInternals);
    expect(internalNames.length).toBeGreaterThan(0);
    // The allowlist may only name things that actually exist in doc.ts, so a
    // rename cannot leave a dead entry silently widening the guard.
    expect(internalNames).toEqual(expect.arrayContaining([...SANCTIONED_DOC_EXPORTS]));

    for (const name of internalNames) {
      if (SANCTIONED_DOC_EXPORTS.includes(name)) continue;
      expect(publicApi, `${name} must remain module-private`).not.toHaveProperty(name);
    }
  });

  it("pins the op layer, stamp helpers, and ADR-004 follower read surface", () => {
    expect(publicApi).toEqual(
      expect.objectContaining({
        mint: expect.any(Function),
        applyOps: expect.any(Function),
        inspectOps: expect.any(Function),
        project: expect.any(Function),
        migrate: expect.any(Function),
        compareStampKeys: expect.any(Function),
        stampKey: expect.any(Function),
        writeTarget: expect.any(Function),
        nodesMap: expect.any(Function),
        linksMap: expect.any(Function),
        OPAQUE_WIDGETS_KEY: "__widgets_opaque",
        encodingLosses: expect.any(Function),
      }),
    );
  });

  it("exposes the read-only snapshot surface", () => {
    expect(publicApi).toEqual(
      expect.objectContaining({
        readGraph: expect.any(Function),
        readMeta: expect.any(Function),
        docCatalogPin: expect.any(Function),
        hasNode: expect.any(Function),
        hasAppliedOp: expect.any(Function),
        appliedOpIds: expect.any(Function),
        readStamps: expect.any(Function),
        OPAQUE_WIDGETS_KEY: expect.any(String),
      }),
    );
  });
});
