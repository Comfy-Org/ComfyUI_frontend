import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { applyOps, mint, project, type Op, type WidgetCatalog, type WorkflowJSON } from "../src/index.js";

type Body = Record<string, unknown>;
type FixtureState = { applyNumber: number };
const servers: ReturnType<typeof createServer>[] = [];

async function readBody(req: IncomingMessage): Promise<Body> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) as Body : {};
}

type Drift = (applyNumber: number, body: Body, result: Body) => Body;

function driftOutcome(applyNumber: number, _body: Body, result: Body) {
  if (applyNumber !== 1) return result;
  const changed = structuredClone(result);
  (changed.outcomes as { outcome: string }[])[0]!.outcome = "no-op";
  return changed;
}

function driftOrder(applyNumber: number, _body: Body, result: Body) {
  if (applyNumber !== 2) return result;
  const changed = structuredClone(result);
  (changed.outcomes as unknown[]).reverse();
  return changed;
}

function driftReason(applyNumber: number, _body: Body, result: Body, code?: string) {
  if (applyNumber !== 3) return result;
  const changed = structuredClone(result);
  const reason = ((changed.outcomes as Body[])[0]!.reason as Body);
  if (code) reason.code = code;
  reason.message = code ? "message changes are deliberately ignored" : "different volatile prose";
  return changed;
}

const drifts: Record<string, Drift> = {
  count: (applyNumber, _body, result) => applyNumber === 1
    ? { ...result, ops_seen: (result.ops_seen as number) + 1 }
    : result,
  legacy: (applyNumber, body, result) => applyNumber === 1
    ? { applied: [(body.ops as Op[])[0]!.op_id] }
    : result,
  message: (applyNumber, body, result) => driftReason(applyNumber, body, result),
  order: driftOrder,
  outcome: driftOutcome,
  reason: (applyNumber, body, result) => driftReason(applyNumber, body, result, "different_code"),
};

function applyFixtureDrift(mode: string, applyNumber: number, body: Body, result: Body): Body {
  return drifts[mode]?.(applyNumber, body, result) ?? result;
}

async function serveFixtureRequest(
  mode: string,
  state: FixtureState,
  url: string | undefined,
  body: Body,
  res: ServerResponse,
) {
  res.setHeader("content-type", "application/json");
  if (url === "/health") return res.end('{"ok":true,"fixture":"loopback-not-cloud"}');
  if (url === "/mint") {
    const doc = mint(body.workflow as WorkflowJSON, body.catalog as WidgetCatalog);
    return res.end(JSON.stringify({ snapshot_b64: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64") }));
  }
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Buffer.from(body.snapshot_b64 as string, "base64"));
  for (const update of body.updates_b64 as string[]) Y.applyUpdate(doc, Buffer.from(update, "base64"));
  if (url === "/project") return res.end(JSON.stringify({ projection: project(doc, body.catalog as WidgetCatalog) }));
  const before = Y.encodeStateVector(doc);
  state.applyNumber++;
  const rawResult = applyOps(doc, body.ops as Op[], body.catalog as WidgetCatalog) as unknown as Body;
  const apply_result = applyFixtureDrift(mode, state.applyNumber, body, rawResult);
  const projected = project(doc, body.catalog as WidgetCatalog);
  const projection = mode === "projection" && state.applyNumber === 1 ? { ...projected, extra: true } : projected;
  applyFixtureMutation(mode, state, body, doc);
  res.end(JSON.stringify({ apply_result, projection, update_b64: Buffer.from(Y.encodeStateAsUpdate(doc, before)).toString("base64") }));
}

function applyFixtureMutation(mode: string, state: FixtureState, body: Body, doc: Y.Doc): void {
  if (mode === "hidden-rejection-mutation" && state.applyNumber === 3) {
    doc.getMap("meta").set("fixture_hidden_rejection_mutation", true);
  }
  if (mode === "rejected-operation-recorded" && state.applyNumber === 3) {
    const rejected = (body.ops as Op[])[0]!;
    doc.getMap("__applied").set(rejected.op_id, true);
  }
  if (mode === "trailing-operation-applied" && state.applyNumber === 3) {
    const trailing = (body.ops as Op[])[1];
    if (!trailing) throw new Error("trailing-operation fixture requires a second rejected-batch operation");
    const trailingResult = applyOps(doc, [trailing], body.catalog as WidgetCatalog);
    if (trailingResult.outcomes[0]?.outcome !== "applied") {
      throw new Error(`trailing-operation fixture could not apply operation: ${JSON.stringify(trailingResult)}`);
    }
  }
}

async function run(mode = "match", packageRoot = resolve(".")) {
  const requests: { path: string; body: Body }[] = [];
  const state: FixtureState = { applyNumber: 0 };
  const server = createServer(async (req, res) => {
    const body = await readBody(req);
    requests.push({ path: req.url!, body });
    await serveFixtureRequest(mode, state, req.url, body, res);
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing loopback address");
  const child = spawn(process.execPath, [resolve("examples/dochost-poc/dochost-driver.mjs")], {
    cwd: resolve("."),
    env: { ...process.env, DOC_HOST: `http://127.0.0.1:${address.port}`, CMP_PIN: packageRoot },
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const code = await new Promise<number | null>((done) => child.on("close", done));
  return { code, output, requests };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((done) => server.close(() => done()))));
});

describe("dochost driver executable-package oracle (tiny loopback fixture, not cloud)", () => {
  it("matches outcomes/projections and forks every comparison from one bootstrap", async () => {
    const result = await run();
    expect(result.code, result.output).toBe(0);
    expect(result.requests.filter((request) => request.path === "/mint")).toHaveLength(1);
    const applies = result.requests.filter((request) => request.path === "/apply");
    expect(applies).toHaveLength(3);
    expect(applies.map(({ body }) => (body.updates_b64 as string[]).length)).toEqual([0, 1, 2]);
    const hostUpdates = applies.map(({ body }) => body.updates_b64 as string[]).flat();
    expect(hostUpdates).toHaveLength(3);
    expect(result.output).toContain("host: agent link present");
  });

  it("ignores volatile rejection message prose", async () => {
    const result = await run("message");
    expect(result.code, result.output).toBe(0);
  });

  it.each([
    ["hidden-rejection-mutation", "FAIL  rejected batch leaves encoded document state unchanged"],
    ["rejected-operation-recorded", "FAIL  rejected operation is absent from __applied"],
    ["trailing-operation-applied", "FAIL  batch-aborted trailing operation is absent from __applied"],
  ])("fails closed for %s", async (mode, expectedFailure) => {
    const result = await run(mode);
    expect(result.code, result.output).toBe(1);
    expect(result.output).toContain(expectedFailure);
  });

  it("imports the executable package from a path containing spaces and URL delimiters", async () => {
    const directory = mkdtempSync(join(tmpdir(), "cmp-driver-"));
    const checkout = join(directory, "checkout # with spaces");
    try {
      symlinkSync(resolve("."), checkout, "dir");
      const result = await run("match", checkout);
      expect(result.code, result.output).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each([
    ["outcome", "FAIL  human ApplyResult matches local executable package"],
    ["order", "FAIL  agent ApplyResult matches local executable package"],
    ["count", "FAIL  human ApplyResult matches local executable package"],
    ["reason", "FAIL  rejected ApplyResult and stable reason code match local executable package"],
    ["legacy", "sidecar returned legacy/invalid ApplyResult"],
    ["projection", "FAIL  human projection matches local executable package"],
  ])(
    "fails closed for %s drift even when other sidecar data matches",
    async (mode, expectedFailure) => {
      const result = await run(mode);
      expect(result.code, result.output).toBe(1);
      expect(result.output).toContain(expectedFailure);
    },
  );
});
