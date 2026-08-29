import * as Y from "yjs";
import { linksMap, nodesMap } from "../src/doc.js";

export type GraphInvariant = "I1" | "I2" | "I3" | "I4" | "I5";

export interface GraphInvariantViolation {
  invariant: GraphInvariant;
  path: string;
  message: string;
}

const INVARIANT_ORDER: Record<GraphInvariant, number> = {
  I1: 1,
  I2: 2,
  I3: 3,
  I4: 4,
  I5: 5,
};

function linkKey(value: unknown): string {
  return String(value);
}

function sameLink(a: unknown, b: unknown): boolean {
  return a === b || (a != null && b != null && linkKey(a) === linkKey(b));
}

function violation(
  out: GraphInvariantViolation[],
  invariant: GraphInvariant,
  path: string,
  message: string,
): void {
  out.push({ invariant, path, message });
}

/**
 * Read-only post-merge oracle for the top-level semantic graph.
 *
 * This intentionally lives under test/ and is not part of the package API.
 * It uses the same root accessors as project(), and never repairs a violation:
 * a failing check belongs to the operation that produced the state (KA-4).
 */
export function checkGraphInvariants(doc: Y.Doc): GraphInvariantViolation[] {
  const nodes = nodesMap(doc);
  const links = linksMap(doc);
  const violations: GraphInvariantViolation[] = [];

  // I1 and I2: all slot/port references must resolve to a live links-map key.
  nodes.forEach((node, nodeId) => {
    if (!(node instanceof Y.Map)) return;

    const inputs = node.get("inputs");
    if (inputs instanceof Y.Array) {
      inputs.forEach((slot, index) => {
        if (!(slot instanceof Y.Map)) return;
        const ref = slot.get("link");
        if (ref == null || links.has(linkKey(ref))) return;
        violation(
          violations,
          "I1",
          `nodes[${JSON.stringify(nodeId)}].inputs[${String(index)}].link`,
          `input link ${linkKey(ref)} does not resolve in links`,
        );
      });
    }

    const outputs = node.get("outputs");
    if (outputs instanceof Y.Array) {
      outputs.forEach((port, index) => {
        if (!(port instanceof Y.Map)) return;
        const refs = port.get("links");
        if (!(refs instanceof Y.Array)) return;
        refs.forEach((ref, refIndex) => {
          if (ref == null || links.has(linkKey(ref))) return;
          violation(
            violations,
            "I2",
            `nodes[${JSON.stringify(nodeId)}].outputs[${String(index)}].links[${String(refIndex)}]`,
            `output link ${linkKey(ref)} does not resolve in links`,
          );
        });
      });
    }
  });

  // I3 and I4: tuple endpoints exist, and every live tuple agrees with both
  // endpoint-side references. I4 is not attempted when I3 already fails for
  // that endpoint, which keeps one missing node from producing duplicate noise.
  const inputClaims = new Map<string, string>();
  links.forEach((rawTuple, linkMapKey) => {
    const path = `links[${JSON.stringify(linkMapKey)}]`;
    if (!Array.isArray(rawTuple) || rawTuple.length < 5) {
      violation(violations, "I3", path, "link entry is not a tuple with node endpoints");
      return;
    }

    const tuple = rawTuple as unknown[];
    const fromNodeKey = linkKey(tuple[1]);
    const toNodeKey = linkKey(tuple[3]);
    const sourceExists = nodes.has(fromNodeKey);
    const destinationExists = nodes.has(toNodeKey);
    if (!sourceExists) {
      violation(
        violations,
        "I3",
        `${path}[1]`,
        `source node ${fromNodeKey} does not resolve in nodes`,
      );
    }
    if (!destinationExists) {
      violation(
        violations,
        "I3",
        `${path}[3]`,
        `destination node ${toNodeKey} does not resolve in nodes`,
      );
    }

    const claimKey = `${toNodeKey}\u0000${linkKey(tuple[4])}`;
    const prior = inputClaims.get(claimKey);
    if (prior !== undefined) {
      violation(
        violations,
        "I5",
        path,
        `input register (${toNodeKey}, ${linkKey(tuple[4])}) is also claimed by link ${prior}`,
      );
    } else {
      inputClaims.set(claimKey, linkMapKey);
    }

    if (destinationExists) {
      const destination = nodes.get(toNodeKey);
      const inputs = destination instanceof Y.Map ? destination.get("inputs") : undefined;
      const toSlot = tuple[4];
      const slot =
        inputs instanceof Y.Array && typeof toSlot === "number" && Number.isInteger(toSlot) && toSlot >= 0
          ? inputs.get(toSlot)
          : undefined;
      if (!(slot instanceof Y.Map)) {
        violation(
          violations,
          "I4",
          `${path}[4]`,
          `destination input (${toNodeKey}, ${linkKey(toSlot)}) does not carry link ${linkKey(tuple[0])}`,
        );
      } else if (!sameLink(slot.get("link"), tuple[0])) {
        violation(
          violations,
          "I4",
          `${path}[4]`,
          `destination input carries ${linkKey(slot.get("link"))}, expected ${linkKey(tuple[0])}`,
        );
      }
    }

    if (sourceExists) {
      const source = nodes.get(fromNodeKey);
      const outputs = source instanceof Y.Map ? source.get("outputs") : undefined;
      const fromSlot = tuple[2];
      const port =
        outputs instanceof Y.Array && typeof fromSlot === "number" && Number.isInteger(fromSlot) && fromSlot >= 0
          ? outputs.get(fromSlot)
          : undefined;
      const refs = port instanceof Y.Map ? port.get("links") : undefined;
      if (!(refs instanceof Y.Array) || !refs.toArray().some((ref) => sameLink(ref, tuple[0]))) {
        violation(
          violations,
          "I4",
          `${path}[2]`,
          `source output (${fromNodeKey}, ${linkKey(fromSlot)}) does not advertise link ${linkKey(tuple[0])}`,
        );
      }
    }
  });

  return violations.sort((a, b) => {
    const invariant = INVARIANT_ORDER[a.invariant] - INVARIANT_ORDER[b.invariant];
    if (invariant !== 0) return invariant;
    const path = a.path.localeCompare(b.path);
    return path !== 0 ? path : a.message.localeCompare(b.message);
  });
}
