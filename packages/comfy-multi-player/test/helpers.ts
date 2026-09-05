/** Shared fixture-loading + canonicalization helpers for the test suites. */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Op, WidgetCatalog, WorkflowJSON, WorkflowNode } from "../src/index.js";

export const fixturesDir = join(dirname(dirname(fileURLToPath(import.meta.url))), "fixtures");

export interface SessionHeader {
  session: string;
  /** How the session was authored (e.g. "team"). Never production data. */
  authored_by: string;
  /** The workflow the ops were minted against — replay starts here, not empty. */
  base_workflow: WorkflowJSON;
  /** The workflow after all ops — the (canonicalized) deep-equal target. */
  workflow_final: WorkflowJSON;
}

export interface Session {
  file: string;
  header: SessionHeader;
  ops: Op[];
}

export function sessionFiles(): string[] {
  return readdirSync(fixturesDir).filter((f) => f.endsWith(".session.jsonl"));
}

export function loadSession(file: string): Session {
  const lines = readFileSync(join(fixturesDir, file), "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  const header = JSON.parse(lines[0]!) as SessionHeader;
  const ops = lines.slice(1).map((l) => JSON.parse(l) as Op);
  return { file, header, ops };
}

export function loadCatalog(): WidgetCatalog {
  return JSON.parse(readFileSync(join(fixturesDir, "catalog.json"), "utf8")) as WidgetCatalog;
}

export interface LwwVector {
  name: string;
  note: string;
  ops: Op[];
  converged_value: unknown;
  winner_op_id: string;
}

export interface LwwVectorsFile {
  base_workflow: WorkflowJSON;
  subgraph_base_workflow: WorkflowJSON;
  vectors: LwwVector[];
}

export function loadLwwVectors(): LwwVectorsFile {
  return JSON.parse(readFileSync(join(fixturesDir, "lww-vectors.json"), "utf8")) as LwwVectorsFile;
}

/**
 * Schema §7 rule 1: sorted-by-id node/link order is canonical (definitions
 * sorted by id too, matching comfy-cli `workflow_ops.canonical`). Fixture
 * finals keep Python insertion order, so both sides are canonicalized before
 * comparing.
 */
export function canonicalize(wf: WorkflowJSON): WorkflowJSON {
  const byId = (a: { id: unknown }, b: { id: unknown }) =>
    String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
  const linkId = (l: unknown) => String((l as unknown[])[0]);
  const canonicalNodes = (nodes: WorkflowNode[]): WorkflowNode[] => nodes.map((node) => ({
    ...node,
    ...(Array.isArray(node.outputs)
      ? {
          outputs: node.outputs.map((output) => {
            if (typeof output !== "object" || output === null || !("links" in output) || !Array.isArray(output.links)) {
              return output;
            }
            return { ...output, links: [...output.links].sort((a, b) => Number(a) - Number(b)) };
          }),
        }
      : {}),
  }));
  const out: WorkflowJSON = {
    ...wf,
    nodes: canonicalNodes(wf.nodes).sort(byId),
    links: [...wf.links].sort((a, b) => (linkId(a) < linkId(b) ? -1 : linkId(a) > linkId(b) ? 1 : 0)),
  };
  const defs = out["definitions"] as { subgraphs?: { id?: unknown }[] } | undefined;
  if (defs && Array.isArray(defs.subgraphs)) {
    out["definitions"] = {
      ...defs,
      subgraphs: [...defs.subgraphs]
        .map((definition) => ({
          ...definition,
          ...(Array.isArray((definition as { nodes?: unknown }).nodes)
            ? { nodes: canonicalNodes((definition as { nodes: WorkflowNode[] }).nodes) }
            : {}),
        }))
        .sort((a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0),
    };
  }
  return out;
}
