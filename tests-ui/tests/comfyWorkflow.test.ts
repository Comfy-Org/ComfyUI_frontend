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

    it("workflow.nodes.pos", async () => {
        const workflow = JSON.parse(JSON.stringify(defaultGraph));
        workflow.nodes[0].pos = [1, 2, 3];
        await expect(parseComfyWorkflow(JSON.stringify(workflow))).rejects.toThrow();

        workflow.nodes[0].pos = [1, 2];
        await expect(parseComfyWorkflow(JSON.stringify(workflow))).resolves.not.toThrow();

        // Should automatically transform the legacy format object to array.
        workflow.nodes[0].pos = {"0": 3, "1": 4};
        let parsedWorkflow = await parseComfyWorkflow(JSON.stringify(workflow));
        expect(parsedWorkflow.nodes[0].pos).toEqual([3, 4]);

        workflow.nodes[0].pos = {0: 3, 1: 4};
        parsedWorkflow = await parseComfyWorkflow(JSON.stringify(workflow));
        expect(parsedWorkflow.nodes[0].pos).toEqual([3, 4]);
    });

    it("workflow.nodes.widget_values", async () => {
        const workflow = JSON.parse(JSON.stringify(defaultGraph));
        workflow.nodes[0].widgets_values = ["foo", "bar"];
        await expect(parseComfyWorkflow(JSON.stringify(workflow))).resolves.not.toThrow();

        workflow.nodes[0].widgets_values = "foo";
        await expect(parseComfyWorkflow(JSON.stringify(workflow))).rejects.toThrow();

        workflow.nodes[0].widgets_values = undefined;
        await expect(parseComfyWorkflow(JSON.stringify(workflow))).resolves.not.toThrow();

        // The object format of widgets_values is used by VHS nodes to perform
        // dynamic widgets display.
        workflow.nodes[0].widgets_values = {"foo": "bar"};
        const parsedWorkflow = await parseComfyWorkflow(JSON.stringify(workflow));
        expect(parsedWorkflow.nodes[0].widgets_values).toEqual({"foo": "bar"});
    });
});
