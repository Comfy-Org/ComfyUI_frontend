<template>
  <SideBarIcon
    icon="pi pi-cog"
    @click="showSetting"
    :tooltip="$t('sideToolBar.settings')"
  />
</template>

<script setup lang="ts">
import { app } from "@/scripts/app";
import SideBarIcon from "./SideBarIcon.vue";

const showSetting = () => {
  app.ui.settings.show();
};
</script>
