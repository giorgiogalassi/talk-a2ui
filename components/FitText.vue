<template>
  <span ref="el" class="fit-text" :class="{ 'fit-serif': serif }" :style="style"><slot /></span>
</template>

<script setup>
// A display line that sizes itself to span its container's full width
// (the "typography as architecture" pattern). Measured at its final weight/width.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  // Defaults follow the blog's display type (ggalassi.dev, Cream & Ink): Roboto Flex 600.
  weight: { type: Number, default: 600 },
  wdth: { type: Number, default: 100 },
  opsz: { type: Number, default: 144 },
  // The blog's accent: Instrument Serif italic with a hand-drawn underline.
  serif: { type: Boolean, default: false },
})

const el = ref()
const size = ref(100)
let observer

const style = computed(() => props.serif
  ? { fontSize: `${size.value}px` }
  : {
      fontSize: `${size.value}px`,
      fontWeight: props.weight,
      fontVariationSettings: `"wdth" ${props.wdth}, "opsz" ${props.opsz}`,
    })

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
  line-height: 0.95;
  letter-spacing: -0.045em;
}
.fit-serif {
  position: relative;
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.01em;
  padding-right: 0.06em;
  line-height: 1;
}
.fit-serif::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0.02em;
  height: 0.07em;
  background-color: var(--ta-accent);
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 12' preserveAspectRatio='none'%3E%3Cpath d='M3 9 C 80 2, 200 1, 297 6' stroke='black' stroke-width='5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") center / 100% 100% no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 12' preserveAspectRatio='none'%3E%3Cpath d='M3 9 C 80 2, 200 1, 297 6' stroke='black' stroke-width='5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") center / 100% 100% no-repeat;
}
</style>
