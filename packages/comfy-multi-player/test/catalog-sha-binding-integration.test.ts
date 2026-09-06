/**
 * KA-12 / FC-10 integration contract: the catalog identity is minted into the
 * document and must remain an immutable SHA across apply and projection.
 */
import { describe, expect, it } from "vitest";
import { metaMap } from "../src/doc.js";
import {
  applyOps,
  mint,
  project,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";

const catalogSha = "8d4f4e8c0fd340451cb33753758e0b19488691d567adcf68dbb93f14f868e216";
const sha256 = /^[0-9a-f]{64}$/;
const catalog: WidgetCatalog = {
  types: {
    Sampler: { widget_order: ["steps", "cfg"] },
  },
};
const workflow: WorkflowJSON = {
  nodes: [{ id: 1, type: "Sampler", widgets_values: [20, 8] }],
  links: [],
};

function setWidget(nodeId: number, widget: string, value: unknown): SetWidgetOp {
  return {
    op: "set_widget",
    op_id: "0123456789abcdef0123456789abcdef",
    actor: "agent:test:catalog-binding",
    base_version: 1,
    stamp: [1, "agent:test:catalog-binding"],
    node_id: nodeId,
    widget,
    value,
  };
}

function assertImmutableCatalogCitation(value: unknown): asserts value is string {
  if (typeof value !== "string" || !sha256.test(value)) {
    throw new TypeError(`KA-12 / FC-10: catalog_version must be an immutable sha256, got '${String(value)}'`);
  }
}

describe("catalog SHA binding across mint → apply → project (KA-12 / FC-10)", () => {
  it("stamps the SHA at mint and carries it unchanged through apply and projection", () => {
    const doc = mint(workflow, catalog, catalogSha);
    const pinnedAtMint = metaMap(doc).get("catalog_version");
    assertImmutableCatalogCitation(pinnedAtMint);
    expect(pinnedAtMint).toBe(catalogSha);

    expect(applyOps(doc, [setWidget(1, "steps", 30)], catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(project(doc, catalog).nodes[0]?.widgets_values).toEqual([30, 8]);
    expect(metaMap(doc).get("catalog_version")).toBe(pinnedAtMint);
  });

  it("rejects a name-addressed write to a class absent from the pinned catalog", () => {
    const doc = mint(
      { nodes: [{ id: 2, type: "FrontendOnly", widgets_values: ["opaque"] }], links: [] },
      catalog,
      catalogSha,
    );

    const result = applyOps(doc, [setWidget(2, "text", "changed")], catalog);
    expect(result.outcomes[0]).toMatchObject({ outcome: "rejected", reason: { code: "opaque_widgets" } });
    expect(result.outcomes.find((o) => o.outcome === "rejected")?.reason.message).toContain("absent from the pinned catalog");
    expect(project(doc, catalog).nodes[0]?.widgets_values).toEqual(["opaque"]);
    expect(metaMap(doc).get("catalog_version")).toBe(catalogSha);
  });

  it("flags a moving branch-style catalog citation", () => {
    const doc = mint(workflow, catalog, "main");
    expect(() => assertImmutableCatalogCitation(metaMap(doc).get("catalog_version"))).toThrow(
      "KA-12 / FC-10: catalog_version must be an immutable sha256, got 'main'",
    );
  });
});
