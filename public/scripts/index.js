import { app } from "./app.js";

(async () => {
    await app.setup();
    window.app = app;
    window.graph = app.graph;
})();
