import * as fc from "fast-check";
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  applyOps,
  mint,
  project,
  type ConnectOp,
  type Op,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";
import { appliedMap, isStorableArrayItem, isStorableMapValue } from "../src/doc.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
/** Same catalog, but with a real `inputcount` widget on the grow destination. */
const countingCatalog: WidgetCatalog = {
  ...catalog,
  types: {
    ...catalog.types,
    BatchImagesNode: { ...catalog.types["BatchImagesNode"]!, widget_order: ["inputcount"] },
  },
};
const opId = (tag: string) => (tag + "0".repeat(32)).slice(0, 32);

/**
 * D4: a rejected op leaves the document BYTE-identical, not merely
 * projection-identical. The rejected op also never records its `op_id`, so
 * re-submitting it is re-attempted (and re-rejected) rather than deduped —
 * which is what makes the retry non-mutating too, the second half of #10.
 */
function assertRejectedWithoutMutation(
  workflow: WorkflowJSON,
  op: Op,
  code: string,
  withCatalog: WidgetCatalog = catalog,
): void {
  const doc = mint(workflow, withCatalog);
  const before = Buffer.from(Y.encodeStateAsUpdate(doc));
  expect(applyOps(doc, [op], withCatalog).outcomes.find((outcome) => outcome.outcome === "rejected")?.reason.code).toBe(code);
  expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
  // A rejected op is retryable, so it must not have burned its op_id — and if
  // it had, the retry below would report `no-op`, not `rejected`.
  expect(appliedMap(doc).has(op.op_id)).toBe(false);

  const retry = applyOps(doc, [op], withCatalog);
  expect(retry.outcomes.find((outcome) => outcome.outcome === "rejected")?.reason.code).toBe(code);
  expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
}

describe("regression: rejected connect ops leave document bytes unchanged (#10)", () => {
  const source = {
    id: 300, type: "LoadImage", inputs: [],
    outputs: [{ name: "IMAGE", type: "IMAGE", links: [9000] }], widgets_values: [],
  };
  const destination = {
    id: 700, type: "BatchImagesNode",
    inputs: [{ name: "images.image0", type: "IMAGE", link: 9000 }],
    outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }], widgets_values: [],
  };
  const workflow: WorkflowJSON = {
    nodes: [source, destination],
    links: [[9000, 300, 0, 700, 0, "IMAGE"]],
    groups: [], extra: {}, last_node_id: 700, last_link_id: 9000,
  };

  it("invalid source output does not claim the input or remove its incumbent link", () => {
    assertRejectedWithoutMutation(workflow, {
      op: "connect", op_id: opId("bad-output"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9500, from_node: 300, from_slot: 5,
      to_node: 700, to_slot: 0, link_type: "IMAGE",
    }, "output_slot_missing");
  });

  it("invalid inputcount widget does not append a grown slot", () => {
    assertRejectedWithoutMutation(workflow, {
      op: "connect", op_id: opId("bad-count"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9501, from_node: 300, from_slot: 0,
      to_node: 700, to_slot: null, link_type: "IMAGE",
      grow: {
        name: "images.image0", type: "IMAGE",
        inputcount: { widget: "not_a_widget", value: 2 },
      },
    }, "unknown_widget");
  });

  it("non-string inputcount widget does not append a grown slot (the verified #10 repro)", () => {
    // The exact path recorded against issue #10: `growInput` appended the slot
    // and `applyInputcountBump` then threw `malformed_op` on a non-string
    // `grow.inputcount.widget`. Yjs does not roll a transact body back on
    // throw and `mset(op_id)` never ran, so the doc gained an input slot
    // (inputs 1 -> 2) while the rejected outcome reported nothing had
    // happened, and a retry appended a second slot.
    assertRejectedWithoutMutation(workflow, {
      op: "connect", op_id: opId("nonstr-count"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9502, from_node: 300, from_slot: 0,
      to_node: 700, to_slot: null, link_type: "IMAGE",
      grow: {
        name: "images.image0", type: "IMAGE",
        inputcount: { widget: 7 as unknown as string, value: 2 },
      },
    }, "malformed_op");
  });

  it("malformed grow payload does not append a grown slot", () => {
    assertRejectedWithoutMutation(workflow, {
      op: "connect", op_id: opId("bad-grow"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9503, from_node: 300, from_slot: 0,
      to_node: 700, to_slot: null, link_type: "IMAGE",
      grow: { name: 5 as unknown as string, type: "IMAGE" },
    }, "malformed_op");
  });

  it("an opaque destination refuses an inputcount grow before growing the slot", () => {
    const opaque = {
      id: 800, type: "MarkdownNode",
      inputs: [{ name: "images.image0", type: "IMAGE", link: null }],
      outputs: [], widgets_values: ["opaque"],
    };
    assertRejectedWithoutMutation(
      {
        nodes: [source, opaque],
        links: [],
        groups: [], extra: {}, last_node_id: 800, last_link_id: 9000,
      },
      {
        op: "connect", op_id: opId("opaque-count"), actor: "human:z", base_version: 9,
        stamp: [9, "human:z"], link_id: 9504, from_node: 300, from_slot: 0,
        to_node: 800, to_slot: null, link_type: "IMAGE",
        grow: {
          name: "images.image0", type: "IMAGE",
          inputcount: { widget: "inputcount", value: 2 },
        },
      },
      "opaque_widgets",
    );
  });

  it("a non-cloneable inputcount value is refused before the slot is grown", () => {
    // `structuredClone` throws DataCloneError on a value JSON cannot carry.
    // It used to be evaluated as an argument to `mset`, i.e. after `widgetsOf`
    // had created the widgets map and after the autogrow had appended a slot.
    assertRejectedWithoutMutation(workflow, {
      op: "connect", op_id: opId("uncloneable"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9505, from_node: 300, from_slot: 0,
      to_node: 700, to_slot: null, link_type: "IMAGE",
      grow: {
        name: "images.image0", type: "IMAGE",
        inputcount: { widget: "inputcount", value: (() => undefined) as unknown as number },
      },
    }, "malformed_op", countingCatalog);
  });

  it.each([
    ["negative", -1],
    ["fractional", 0.5],
    ["NaN", Number.NaN],
    ["out of range", 99],
  ])("a %s from_slot is refused before the link tuple is written", (_label, fromSlot) => {
    // `from_slot >= outs.length` alone admitted every one of these: each
    // reached `outs.get(from_slot)` returning `undefined` and threw a raw
    // TypeError, reported as the generic `apply_failed`, only AFTER the link
    // tuple and the input slot had been written — with `__applied` unwritten,
    // so the retry re-mutated. Identical on `main` and on the first pass of
    // this fix; the fix closed two instances of #10, not the class.
    assertRejectedWithoutMutation(workflow, {
      op: "connect", op_id: opId(`slot${String(fromSlot)}`), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9506, from_node: 300, from_slot: fromSlot,
      to_node: 700, to_slot: 0, link_type: "IMAGE",
    }, "output_slot_missing");
  });

  it.each([
    ["negative", -1],
    ["fractional", 1.5],
    ["NaN", Number.NaN],
  ])("a %s to_slot is refused before the register is claimed", (_label, toSlot) => {
    assertRejectedWithoutMutation(workflow, {
      op: "connect", op_id: opId(`to${String(toSlot)}`), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9507, from_node: 300, from_slot: 0,
      to_node: 700, to_slot: toSlot, link_type: "IMAGE",
    }, "input_slot_missing");
  });

  it("an out-of-range from_slot onto an EMPTY destination slot is refused before the register is claimed", () => {
    // The projection-invisible member of the family. Slot 1 holds no incumbent
    // link, so the only footprint of the premature register claim is the
    // `__stamps` entry — `project()` is byte-for-byte unchanged either way, and
    // every projection-based assertion in the suite passes while the encoded
    // document differs. This is why the class survived the first sweep: only
    // `encodeStateAsUpdate` can see it.
    const twoInputs: WorkflowJSON = {
      ...workflow,
      nodes: [
        source,
        {
          ...destination,
          inputs: [
            { name: "images.image0", type: "IMAGE", link: 9000 },
            { name: "images.image1", type: "IMAGE", link: null },
          ],
        },
      ],
    };
    assertRejectedWithoutMutation(twoInputs, {
      op: "connect", op_id: opId("empty-dst-slot"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9520, from_node: 300, from_slot: 5,
      to_node: 700, to_slot: 1, link_type: "IMAGE",
    }, "output_slot_missing");
  });

  it("a non-cloneable set_widget value is refused before the widgets map is created", () => {
    const doc = mint(workflow, catalog);
    const before = Buffer.from(Y.encodeStateAsUpdate(doc));
    const op = {
      op: "set_widget", op_id: opId("uncloneable-sw"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], node_id: 700, widget: "inputcount",
      value: (() => undefined) as unknown,
    } as unknown as ConnectOp;
    expect(applyOps(doc, [op], catalog).outcomes.find((outcome) => outcome.outcome === "rejected")?.reason.code)
      .toBe("malformed_op");
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The rest of the class: values `structuredClone` accepts but Yjs cannot store
// ---------------------------------------------------------------------------

/**
 * `structuredClone` is a NECESSARY but not SUFFICIENT gate for a value on its
 * way into the document. Yjs accepts a fixed set of shapes at a `Y.Map` set
 * (`typeMapSet`) and a narrower one at a `Y.Array` insert
 * (`typeListInsertGenerics`); everything else throws `Unexpected content type`
 * — and `Map`, `Set`, `RegExp`, `Error` and `ArrayBuffer` all clone happily on
 * their way to that throw. The throw lands mid-handler, after `widgetsOf` has
 * created the widgets map or after the autogrow has appended its slot, which
 * is the same KA-4 / D4 violation as #10 with a different trigger.
 *
 * These rows are the exact domain, pinned against Yjs itself below so the
 * predicate cannot drift from the library it mirrors.
 */
const CLONEABLE_BUT_UNSTORABLE: Array<[string, () => unknown]> = [
  ["Map", () => new Map([["a", 1]])],
  ["Set", () => new Set([1])],
  ["RegExp", () => /x/g],
  ["Error", () => new Error("boom")],
  ["ArrayBuffer", () => new ArrayBuffer(4)],
];

describe("KA-4 / D4: a rejected op leaves the document byte-identical (the whole class, not the #10 repro)", () => {
  const source = {
    id: 300, type: "LoadImage", inputs: [],
    outputs: [{ name: "IMAGE", type: "IMAGE", links: [9000] }], widgets_values: [],
  };
  /** Input 0 is OCCUPIED, input 1 is EMPTY: the two shapes fail differently. */
  const destination = {
    id: 700, type: "BatchImagesNode",
    inputs: [
      { name: "images.image0", type: "IMAGE", link: 9000 },
      { name: "images.image1", type: "IMAGE", link: null },
    ],
    outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }], widgets_values: [],
  };
  /**
   * No `widgets_values` key at all, so `mint` gives this node NO `widgets`
   * map — `widgetsOf` has to create one, which is the write that the old
   * ordering left behind when the value write then threw. A node that already
   * carries a widgets map cannot see the defect: the fixture, not the
   * assertion, is what makes the test sensitive.
   */
  const bareWidgets = {
    id: 710, type: "CLIPTextEncode",
    inputs: [{ name: "clip", type: "CLIP", link: null }], outputs: [],
  };
  /** Same, as an autogrow destination for the §8.4 inputcount family. */
  const bareGrowTarget = {
    id: 720, type: "BatchImagesNode",
    inputs: [{ name: "images.image0", type: "IMAGE", link: null }],
    outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
  };
  const workflow: WorkflowJSON = {
    nodes: [source, destination, bareWidgets, bareGrowTarget],
    links: [[9000, 300, 0, 700, 0, "IMAGE"]],
    groups: [], extra: {}, last_node_id: 720, last_link_id: 9000,
  };

  describe("set_widget", () => {
    it.each(CLONEABLE_BUT_UNSTORABLE)(
      "a %s value is refused before `widgetsOf` creates the widgets map",
      (label, make) => {
        assertRejectedWithoutMutation(workflow, {
          op: "set_widget", op_id: opId(`unstorable-sw-${label}`), actor: "human:z",
          base_version: 9, stamp: [9, "human:z"], node_id: 710, widget: "text",
          value: make(),
        }, "malformed_op");
      },
    );

    it("a node that already has a widgets map is refused too (the ordering must not regress)", () => {
      assertRejectedWithoutMutation(workflow, {
        op: "set_widget", op_id: opId("unstorable-sw-existing"), actor: "human:z",
        base_version: 9, stamp: [9, "human:z"], node_id: 700, widget: "inputcount",
        value: new Map(),
      }, "malformed_op", countingCatalog);
    });
  });

  describe("connect", () => {
    it.each(CLONEABLE_BUT_UNSTORABLE)(
      "an inputcount grow with a %s value is refused before the slot is appended",
      (label, make) => {
        assertRejectedWithoutMutation(workflow, {
          op: "connect", op_id: opId(`unstorable-grow-${label}`), actor: "human:z",
          base_version: 9, stamp: [9, "human:z"], link_id: 9600, from_node: 300,
          from_slot: 0, to_node: 720, to_slot: null, link_type: "IMAGE",
          grow: {
            name: "images.image1", type: "IMAGE",
            inputcount: { widget: "inputcount", value: make() },
          },
        }, "malformed_op", countingCatalog);
      },
    );

    it.each(CLONEABLE_BUT_UNSTORABLE)(
      "a %s link_id is refused before the register is claimed and the incumbent severed",
      (label, make) => {
        // `link_id` is written three ways — the links-map key, the destination
        // slot's `link` (a Y.Map value) and the source port's `links` (a
        // Y.Array item) — so the strictest of the three domains gates it. The
        // occupied destination makes the damage maximal: the incumbent link
        // 9000 was severed before the throw.
        assertRejectedWithoutMutation(workflow, {
          op: "connect", op_id: opId(`unstorable-link-${label}`), actor: "human:z",
          base_version: 9, stamp: [9, "human:z"], link_id: make() as unknown as number,
          from_node: 300, from_slot: 0, to_node: 700, to_slot: 0, link_type: "IMAGE",
        }, "malformed_op");
      },
    );

    it.each([
      ["undefined", undefined, "malformed_op"],
      ["a Date", new Date(0), "malformed_op"],
      ["a BigInt", 10n, "malformed_op"],
    ])("%s link_id is refused before the register is claimed", (_label, linkId, code) => {
      // Undefined and Date are accepted at a Y.Map set but NOT at the
      // `Y.Array` insert into the source port's `links`. BigInt is classified
      // as malformed earlier by whole-envelope canonicalization.
      assertRejectedWithoutMutation(workflow, {
        op: "connect", op_id: opId(`unstorable-link2-${String(linkId)}`), actor: "human:z",
        base_version: 9, stamp: [9, "human:z"], link_id: linkId as unknown as number,
        from_node: 300, from_slot: 0, to_node: 700, to_slot: 1, link_type: "IMAGE",
      }, code);
    });
  });

  describe("delete_node", () => {
    it.each([
      ["a number", 5],
      ["an object", {}],
      ["a boolean", true],
      ["NaN", Number.NaN],
    ])("%s removed_links is refused before the node is deleted", (label, removed) => {
      // `new Set(op.removed_links ?? [])` throws on anything non-iterable, and
      // it was evaluated AFTER `mdel(nodes, key)` had already deleted the node.
      // The op then reported `apply_failed` with `applied_count: 0` while the
      // node was gone, and left its op_id unrecorded so the retry re-deleted.
      assertRejectedWithoutMutation(workflow, {
        op: "delete_node", op_id: opId(`bad-removed-${label}`), actor: "human:z",
        base_version: 9, stamp: [9, "human:z"], node_id: 700,
        removed_links: removed as unknown as number[],
      }, "malformed_op");
    });

    it("an absent target with a non-iterable removed_links is refused the same way", () => {
      assertRejectedWithoutMutation(workflow, {
        op: "delete_node", op_id: opId("bad-removed-absent"), actor: "human:z",
        base_version: 9, stamp: [9, "human:z"], node_id: 99999,
        removed_links: 5 as unknown as number[],
      }, "malformed_op");
    });
  });

  describe("add_node", () => {
    it.each(CLONEABLE_BUT_UNSTORABLE)(
      "a node payload carrying a %s is refused before the node map is integrated",
      (label, make) => {
        // `createNodeMap` builds a DETACHED Y.Map, where Yjs performs no
        // content-type check at all; the throw lands later, when
        // `mset(nodes, key, nodeMap)` integrates the prelim content — i.e.
        // mid-write, with `__applied` unwritten.
        assertRejectedWithoutMutation(workflow, {
          op: "add_node", op_id: opId(`unstorable-add-${label}`), actor: "human:z",
          base_version: 9, stamp: [9, "human:z"], node_id: 900,
          node: { id: 900, type: "PreviewImage", inputs: [], outputs: [], properties: make() },
        } as unknown as Op, "invalid_node_payload");
      },
    );

    it("a nested flags value is refused", () => {
      assertRejectedWithoutMutation(workflow, {
        op: "add_node", op_id: opId("unstorable-add-flags"), actor: "human:z",
        base_version: 9, stamp: [9, "human:z"], node_id: 901,
        node: { id: 901, type: "PreviewImage", inputs: [], outputs: [], flags: { pinned: new Set() } },
      } as unknown as Op, "invalid_node_payload");
    });

    it("a name-keyed widgets_values entry is refused", () => {
      assertRejectedWithoutMutation(workflow, {
        op: "add_node", op_id: opId("unstorable-add-widgets"), actor: "human:z",
        base_version: 9, stamp: [9, "human:z"], node_id: 902,
        node: { id: 902, type: "CLIPTextEncode", inputs: [], outputs: [], widgets_values: { text: new Map() } },
      } as unknown as Op, "invalid_node_payload");
    });

    it("a Date inside an output's links array is refused (Y.Array insert is stricter than Y.Map set)", () => {
      assertRejectedWithoutMutation(workflow, {
        op: "add_node", op_id: opId("unstorable-add-links"), actor: "human:z",
        base_version: 9, stamp: [9, "human:z"], node_id: 903,
        node: {
          id: 903, type: "PreviewImage", inputs: [],
          outputs: [{ name: "IMAGE", type: "IMAGE", links: [new Date(0)] }],
        },
      } as unknown as Op, "invalid_node_payload");
    });
  });
});

describe("the storable-value predicate mirrors Yjs itself", () => {
  // Pinned against the library, not against a remembered table: if a Yjs
  // upgrade widens or narrows what a Y.Map/Y.Array accepts, this fails rather
  // than letting the applier's guard drift into rejecting the legal or
  // admitting the fatal.
  const SAMPLES: Array<[string, () => unknown]> = [
    ["null", () => null],
    ["undefined", () => undefined],
    ["number", () => 1],
    ["NaN", () => Number.NaN],
    ["string", () => "s"],
    ["boolean", () => true],
    ["plain object", () => ({ a: 1 })],
    ["array", () => [1, 2]],
    ["Date", () => new Date(0)],
    ["BigInt", () => 1n],
    ["Uint8Array", () => new Uint8Array([1])],
    ["ArrayBuffer", () => new ArrayBuffer(4)],
    ...CLONEABLE_BUT_UNSTORABLE.filter(([l]) => l !== "ArrayBuffer"),
  ];

  it.each(SAMPLES)("%s: the predicates agree with a real Y.Doc write", (_label, make) => {
    const asMap = (): void => {
      const doc = new Y.Doc();
      doc.getMap("m").set("k", make());
      Y.encodeStateAsUpdate(doc);
    };
    const asItem = (): void => {
      const doc = new Y.Doc();
      doc.getArray("a").push([make()]);
      Y.encodeStateAsUpdate(doc);
    };
    const survives = (fn: () => void): boolean => {
      try {
        fn();
        return true;
      } catch {
        return false;
      }
    };
    expect(isStorableMapValue(make())).toBe(survives(asMap));
    expect(isStorableArrayItem(make())).toBe(survives(asItem));
  });
});

describe("KA-4 / D4 as a property, not a list of instances", () => {
  // The table above is the set of triggers found by hand. This is the claim
  // itself: over a generated op space against a NON-EMPTY document — an empty
  // one makes almost every op a delete-wins no-op, and the byte assertion
  // vacuous — every REJECTED op leaves `encodeStateAsUpdate` untouched.
  const propertyWorkflow: WorkflowJSON = {
    nodes: [
      { id: 300, type: "LoadImage", inputs: [], outputs: [{ name: "IMAGE", type: "IMAGE", links: [9000] }], widgets_values: [] },
      {
        id: 700, type: "BatchImagesNode",
        inputs: [
          { name: "images.image0", type: "IMAGE", link: 9000 },
          { name: "images.image1", type: "IMAGE", link: null },
        ],
        outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }], widgets_values: [],
      },
      { id: 710, type: "CLIPTextEncode", inputs: [{ name: "clip", type: "CLIP", link: null }], outputs: [] },
      { id: 720, type: "BatchImagesNode", inputs: [{ name: "images.image0", type: "IMAGE", link: null }], outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }] },
    ],
    links: [[9000, 300, 0, 700, 0, "IMAGE"]],
    groups: [], extra: {}, last_node_id: 720, last_link_id: 9000,
  };

  const hostile = (): fc.Arbitrary<unknown> =>
    fc.oneof(
      fc.constant(undefined), fc.constant(null), fc.constant(Number.NaN), fc.constant(-1),
      fc.constant(0.5), fc.constant(0), fc.constant(1), fc.constant(9), fc.constant(true),
      fc.constant("x"), fc.constant(""), fc.constant({}), fc.constant([]), fc.constant(1n),
      fc.constant(Symbol("s")), fc.constant(() => 1), fc.constant(new Map()),
      fc.constant(new Set()), fc.constant(/re/), fc.constant(new Date(0)),
      fc.constant(new ArrayBuffer(2)), fc.constant(Object.create(null) as unknown),
    );
  const nodeRef = (): fc.Arbitrary<unknown> => fc.oneof(fc.constantFrom(300, 700, 710, 720, 99999, "700"), hostile());
  const slotIdx = (): fc.Arbitrary<unknown> => fc.oneof(fc.constantFrom(0, 1, 2, 9), hostile());

  const opArb = fc.oneof(
    fc.record({
      op: fc.constant("connect"),
      from_node: nodeRef(), from_slot: slotIdx(), to_node: nodeRef(), to_slot: slotIdx(),
      link_id: fc.oneof(fc.constantFrom(9700, 9000, "9700"), hostile()),
      link_type: fc.oneof(fc.constant("IMAGE"), hostile()),
      grow: fc.oneof(
        fc.constant(undefined),
        fc.record({
          name: fc.oneof(fc.constantFrom("images.image1", "images.image0"), hostile()),
          type: fc.oneof(fc.constant("IMAGE"), hostile()),
          widget: fc.oneof(fc.constant(undefined), hostile()),
          inputcount: fc.oneof(
            fc.constant(undefined),
            fc.record({ widget: fc.oneof(fc.constantFrom("inputcount", "nope"), hostile()), value: hostile() }),
          ),
        }),
      ),
    }),
    fc.record({
      op: fc.constant("delete_node"),
      node_id: nodeRef(),
      removed_links: fc.oneof(fc.constant([9000]), fc.constant([]), hostile()),
    }),
    fc.record({
      op: fc.constant("set_widget"),
      node_id: nodeRef(),
      widget: fc.oneof(fc.constantFrom("text", "inputcount", "nope"), hostile()),
      value: hostile(),
      path: fc.oneof(fc.constant(undefined), fc.constant([700]), hostile()),
      inner_widget: fc.oneof(fc.constant(undefined), fc.constant("text"), hostile()),
    }),
    fc.record({
      op: fc.constant("add_node"),
      node_id: nodeRef(),
      node: fc.oneof(
        hostile(),
        fc.record({
          id: nodeRef(),
          type: fc.oneof(fc.constant("PreviewImage"), hostile()),
          inputs: hostile(), outputs: hostile(), widgets_values: hostile(), properties: hostile(),
        }),
      ),
    }),
    fc.record({ op: fc.constant("clear"), removed_nodes: hostile() }),
  );

  it("every rejected op over a generated op space leaves the document byte-identical", () => {
    let n = 0;
    let rejected = 0;
    fc.assert(
      fc.property(opArb, fc.integer({ min: 0, max: 3 }), (partial, baseVersion) => {
        n += 1;
        const op = {
          ...(partial as object),
          op_id: `fuzz${String(n).padStart(28, "0")}`,
          actor: "human:z",
          base_version: baseVersion,
          stamp: [baseVersion, "human:z"],
        } as unknown as Op;
        const doc = mint(propertyWorkflow, countingCatalog);
        const before = Buffer.from(Y.encodeStateAsUpdate(doc));
        const projected = JSON.stringify(project(doc, countingCatalog));

        const res = applyOps(doc, [op], countingCatalog);
        if (!res.outcomes.some((outcome) => outcome.outcome === "rejected")) return; // an accepted op is allowed to mutate
        rejected += 1;

        expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
        expect(JSON.stringify(project(doc, countingCatalog))).toBe(projected);
        expect(appliedMap(doc).has(op.op_id)).toBe(false);
      }),
      { seed: 0x4a_4d_04, numRuns: 25000 },
    );
    // Non-vacuity of the sweep itself: a run in which nothing was ever
    // rejected would pass every assertion above without testing anything. At
    // this seed and run count the sweep independently re-derives all four
    // triggers the table above names.
    expect(n).toBe(25_000);
    expect(rejected).toBeGreaterThan(5_000);
  }, 60_000);
});
