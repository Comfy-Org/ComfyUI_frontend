import { expect, mergeTests } from "@playwright/test";

import { webSocketFixture } from "@e2e/fixtures/ws";
import { agentTest } from "@e2e/tests/agent/agentPanelMocks";
import enMessages from "@/locales/en/main.json" with { type: "json" };

const test = mergeTests(agentTest, webSocketFixture);

test.describe(
  "Agent entry button follows ComfyUI's agent",
  {
    tag: "@cloud",
    annotation: {
      type: "issue",
      description:
        "https://github.com/Comfy-Org/ComfyUI_frontend/pull/20971: the panel mounts from the agent feature ComfyUI publishes, and unit tests only cover that with a mocked store",
    },
  },
  () => {
    test.use({ connectWebSocketToServer: false });

    test("stays inert while the agent starts or fails, then opens once it is ready", async ({
      page,
      agentPanel,
      getWebSocket,
    }) => {
      const ws = await getWebSocket();
      const publish = (agent: { state: string; reason: string | null }) =>
        ws.send(JSON.stringify({ type: "feature_flags", data: { agent } }));

      await test.step("a starting agent shows on the button, inert", async () => {
        publish({ state: "starting", reason: null });
        const starting = page.getByRole("button", {
          name: enMessages.agent.entryStarting,
          exact: true,
        });
        await expect(starting).toHaveAttribute("aria-disabled", "true");
        await expect(agentPanel.openButton).toHaveCount(0);
        await starting.click();
        await expect(starting).toHaveAttribute("aria-pressed", "false");
      });

      await test.step("a failed agent names its reason, inert", async () => {
        publish({ state: "failed", reason: "not_found" });
        const failed = page.getByRole("button", {
          name: enMessages.agent.entryFailed,
          exact: true,
        });
        await expect(failed).toHaveAttribute("aria-disabled", "true");
        await expect(failed).toHaveAttribute(
          "title",
          enMessages.agent.entryFailedReason.replace("{reason}", "not_found"),
        );
        await failed.click();
        await expect(failed).toHaveAttribute("aria-pressed", "false");
      });

      await test.step("a ready agent opens the panel", async () => {
        publish({ state: "ready", reason: null });
        await agentPanel.open();
        await expect(agentPanel.root).toBeVisible();
      });
    });
  },
);
