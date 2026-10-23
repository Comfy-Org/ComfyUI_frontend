/**
 * Session replay runner: for every fixtures/<name>.session.jsonl, mint a doc
 * from the session's base_workflow, apply the recorded ops, and assert the
 * canonicalized projection deep-equals the recorded final workflow
 * (canonical = nodes/links sorted by id — docs/multiplayer-schema.md §7; the
 * fixture's workflow_final keeps Python insertion order, so both sides are
 * canonicalized before comparing).
 *
 * UN-GATED with V1-031: applyOps/project/mint are real. The fixture corpus is
 * the graduated V1-007 spike corpus (format: fixtures/README.md).
 */
import { describe, expect, it } from "vitest";
import { applyOps, mint, project } from "../src/index.js";
import { canonicalize, loadCatalog, loadSession, sessionFiles } from "./helpers.js";

const sessions = sessionFiles();

describe("fixture corpus", () => {
  it("ships the three spike sessions with base + final workflows", () => {
    expect(sessions.length).toBeGreaterThanOrEqual(3);
    for (const file of sessions) {
      const { header } = loadSession(file);
      expect(header.session, `${file} header`).toBeTruthy();
      expect(header.base_workflow?.nodes, `${file} base_workflow`).toBeDefined();
      expect(header.workflow_final?.nodes, `${file} workflow_final`).toBeDefined();
    }
  });

  it("ships the pinned catalog the projection depends on", () => {
    const catalog = loadCatalog();
    expect(Object.keys(catalog.types).length).toBeGreaterThan(0);
    expect(catalog.types["KSampler"]?.widget_order).toContain("steps");
  });
});

describe("session replay", () => {
  const catalog = loadCatalog();

  for (const file of sessions) {
    it(`replays ${file} from base_workflow to the recorded final workflow`, () => {
      const { header, ops } = loadSession(file);
      expect(ops.length, "at least one op").toBeGreaterThanOrEqual(1);

      const doc = mint(header.base_workflow, catalog);
      const result = applyOps(doc, ops, catalog);
      expect(result.outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
      expect(result.outcomes.filter((outcome) => outcome.outcome === "no-op")).toEqual([]);
      expect(result.outcomes.filter((outcome) => outcome.outcome !== "rejected")).toHaveLength(ops.length);

      expect(canonicalize(project(doc, catalog))).toEqual(canonicalize(header.workflow_final));
    });
  }
});
