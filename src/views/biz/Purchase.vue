<script setup lang="ts">
import BillPage from '@/components/BillPage.vue'
defineOptions({ name: 'Purchase' })
</script>

<template>
  <BillPage biz-type="PURCHASE" partner-label="供应商" item-mode="normal" />
</template>
