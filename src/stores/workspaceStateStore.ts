import { defineStore } from "pinia";

interface WorkspaceState {
  activeSidebarTab: string | null;
  sidebarTabsOrder: string[]; // Array of tab IDs in order
}

export const useWorkspaceStore = defineStore("workspace", {
  state: (): WorkspaceState => ({
    activeSidebarTab: null,
    sidebarTabsOrder: [],
  }),
  actions: {
    updateActiveSidebarTab(tabId: string) {
      this.activeSidebarTab = tabId;
    },
    updateSidebarOrder(newOrder: string[]) {
      this.sidebarTabsOrder = newOrder;
    },
    serialize() {
      return JSON.stringify({
        activeSidebarTab: this.activeSidebarTab,
        sidebarTabsOrder: this.sidebarTabsOrder,
      });
    },
    deserialize(state: string) {
      const parsedState = JSON.parse(state);
      this.sidebarTabsOrder = parsedState.sidebarTabsOrder;
      this.activeSidebarTab = parsedState.activeSidebarTab;
    },
  },
});
