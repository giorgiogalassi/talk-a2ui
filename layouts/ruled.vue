<template>
  <div class="slidev-layout ruled ta-deck">
    <div v-if="rule" class="ta-rule">
      <span v-for="(label, i) in rule" :key="i">
        <template v-if="ngRule && label.startsWith('Angular')"><NgWord />{{ label.slice('Angular'.length) }}</template>
        <template v-else>{{ label }}</template>
      </span>
    </div>
    <div class="ruled-body"><slot /></div>
  </div>
</template>

<script setup>
// Typography-as-architecture layout: an optional labelled rule on top
// (frontmatter `rule: [left, right]`), content below.
// `ngRule: true` draws a label's leading "Angular" in the brand (components/NgWord.vue).
import NgWord from '../components/NgWord.vue'
defineProps({
  rule: { type: Array, default: undefined },
  ngRule: { type: Boolean, default: false },
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
