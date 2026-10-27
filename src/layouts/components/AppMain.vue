<script setup lang="ts">
import { useTagsViewStore } from '@/stores/tagsView'
import { useRoute } from 'vue-router'

const tagsStore = useTagsViewStore()
const route = useRoute()
</script>

<template>
  <section class="app-main">
    <RouterView v-slot="{ Component }">
      <Transition name="fade-transform" mode="out-in">
        <KeepAlive :include="tagsStore.cached">
          <component :is="Component" :key="route.fullPath" />
        </KeepAlive>
      </Transition>
    </RouterView>
  </section>
</template>

<style scoped>
.app-main {
  padding-top: calc(var(--sw-navbar-height) + var(--sw-tagsview-height));
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}
</style>
