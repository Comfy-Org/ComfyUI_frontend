import { start } from "./utils";
import lg from "./utils/litegraph";

// Load things once per test file before to ensure its all warmed up for the tests
beforeAll(async () => {
	lg.setup(global);
	await start({ resetEnv: true });
	lg.teardown(global);
});
