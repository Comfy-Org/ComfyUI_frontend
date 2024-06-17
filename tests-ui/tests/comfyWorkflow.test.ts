import { parseComfyWorkflow } from "../../src/types/comfyWorkflow";
import { defaultGraph } from "../../src/scripts/defaultGraph";
import fs from "fs";

const WORKFLOW_DIR = "tests-ui/workflows";

describe("parseComfyWorkflow", () => {
    it("parses valid workflow", async () => {
        fs.readdirSync(WORKFLOW_DIR).forEach(async (file) => {
            if (file.endsWith(".json")) {
                const data = fs.readFileSync(`${WORKFLOW_DIR}/${file}`, "utf-8");
                await expect(parseComfyWorkflow(data)).resolves.not.toThrow();
            }
        });
    });

    it("workflow.nodes", async () => {
        const workflow = JSON.parse(JSON.stringify(defaultGraph));
        workflow.nodes = undefined;
        await expect(parseComfyWorkflow(JSON.stringify(workflow))).rejects.toThrow();

        workflow.nodes = null;
        await expect(parseComfyWorkflow(JSON.stringify(workflow))).rejects.toThrow();

        workflow.nodes = [];
        await expect(parseComfyWorkflow(JSON.stringify(workflow))).resolves.not.toThrow();
    });

    it("workflow.version", async () => {
        const workflow = JSON.parse(JSON.stringify(defaultGraph));
        workflow.version = undefined;
        await expect(parseComfyWorkflow(JSON.stringify(workflow))).rejects.toThrow();

        workflow.version = "1.0.1"; // Invalid format.
        await expect(parseComfyWorkflow(JSON.stringify(workflow))).rejects.toThrow();

        workflow.version = 1;
        await expect(parseComfyWorkflow(JSON.stringify(workflow))).resolves.not.toThrow();
    });

    it("workflow.extra", async () => {
        const workflow = JSON.parse(JSON.stringify(defaultGraph));
        workflow.extra = undefined;
        await expect(parseComfyWorkflow(JSON.stringify(workflow))).resolves.not.toThrow();

        workflow.extra = null;
        await expect(parseComfyWorkflow(JSON.stringify(workflow))).resolves.not.toThrow();

        workflow.extra = {};
        await expect(parseComfyWorkflow(JSON.stringify(workflow))).resolves.not.toThrow();

        workflow.extra = { foo: "bar" }; // Should accept extra fields.
        await expect(parseComfyWorkflow(JSON.stringify(workflow))).resolves.not.toThrow();
    });
});
