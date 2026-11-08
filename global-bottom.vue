<template>
  <footer v-if="visible" class="talk-footer">ggalassi.dev</footer>
</template>

<script setup>
import { computed } from 'vue'
import { useSlideContext } from '@slidev/client'

const { $slidev } = useSlideContext()

// Hide on the title slide and on the closing "Thank you" slide,
// where the same information is already on screen.
// Global layers must read nav.currentPage: $page is always 1 here during export.
const visible = computed(() => {
  const page = $slidev?.nav?.currentPage ?? 0
  const total = $slidev?.nav?.total ?? 0
  return page !== 1 && page !== total
})
</script>

<style scoped>
.talk-footer {
  position: absolute;
  right: 1.1rem;
  bottom: 0.75rem;
  z-index: 20;
  font-size: 0.7rem;
  letter-spacing: 0.02em;
  color: rgba(120, 120, 120, 0.55);
  user-select: none;
  pointer-events: none;
}
</style>
