<template>
  <div class="slidev-layout ruled ta-deck">
    <div v-if="rule" class="ta-rule">
      <span>{{ rule[0] }}</span>
      <span>{{ rule[1] }}</span>
    </div>
    <div class="ruled-body"><slot /></div>
  </div>
</template>

<script setup>
// Typography-as-architecture layout: an optional labelled rule on top
// (frontmatter `rule: [left, right]`), content below.
defineProps({
  rule: { type: Array, default: undefined },
})
</script>

<style scoped>
.ruled {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.ruled-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
