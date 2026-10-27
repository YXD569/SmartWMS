<script setup lang="ts">
import BillPage from '@/components/BillPage.vue'
defineOptions({ name: 'Sale' })
</script>

<template>
  <BillPage biz-type="SALE" partner-label="客户" item-mode="normal" />
</template>
