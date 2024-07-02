import fs from "fs";
import path from "path";
import { nop } from "../utils/nopProxy";

function forEachKey(cb) {
  for (const k of [
    "LiteGraph",
    "LGraph",
    "LLink",
    "LGraphNode",
    "LGraphGroup",
    "DragAndScale",
    "LGraphCanvas",
    "ContextMenu",
  ]) {
    cb(k);
  }
}

export default {
  setup(ctx) {
    const lg = fs.readFileSync(path.resolve("./src/lib/litegraph.core.js"), "utf-8");
    const globalTemp = {};
    (function (console) {
      eval(lg);
    }).call(globalTemp, nop);

    forEachKey((k) => (ctx[k] = globalTemp[k]));
    const lg_ext = fs.readFileSync(path.resolve("./src/lib/litegraph.extensions.js"), "utf-8");
    eval(lg_ext);
  },

  teardown(ctx) {
    forEachKey((k) => delete ctx[k]);

    // Clear document after each run
    document.getElementsByTagName("html")[0].innerHTML = "";
  }
};