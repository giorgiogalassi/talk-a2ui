<template>
  <span ref="el" class="fit-text" :style="style"><slot /></span>
</template>

<script setup>
// A display line that sizes itself to span its container's full width
// (the "typography as architecture" pattern). Measured at its final weight/width.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  weight: { type: Number, default: 900 },
  wdth: { type: Number, default: 100 },
  opsz: { type: Number, default: 144 },
})

const el = ref()
const size = ref(100)
let observer

const style = computed(() => ({
  fontSize: `${size.value}px`,
  fontWeight: props.weight,
  fontVariationSettings: `"wdth" ${props.wdth}, "opsz" ${props.opsz}`,
}))

function fit() {
  const node = el.value
  const box = node?.parentElement
  if (!box) return
  const cs = getComputedStyle(box)
  const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  node.style.fontSize = '100px'
  const width = node.offsetWidth
  if (width > 0 && avail > 0) size.value = +((100 * avail) / width * 0.995).toFixed(2)
  node.style.fontSize = `${size.value}px`
}

onMounted(async () => {
  await document.fonts?.ready
  fit()
  // Slides mount while hidden; refit once the container has a real size.
  observer = new ResizeObserver(fit)
  observer.observe(el.value.parentElement)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.fit-text {
  display: block;
  width: max-content;
  white-space: nowrap;
  font-family: 'Roboto Flex', Roboto, system-ui, sans-serif;
  line-height: 0.82;
  letter-spacing: -0.035em;
}
</style>
