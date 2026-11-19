<template>
  <span class="ng-word" :class="display ? 'ng-display' : 'ng-kicker'"><svg class="ng-a" role="img" aria-label="A" viewBox="0 0 223 236"><defs><linearGradient :id="gid" x1="49.009" x2="225.829" y1="213.75" y2="129.722" gradientUnits="userSpaceOnUse"><stop stop-color="#E40035"/><stop offset=".24" stop-color="#F60A48"/><stop offset=".352" stop-color="#F20755"/><stop offset=".494" stop-color="#DC087D"/><stop offset=".745" stop-color="#9717E7"/><stop offset="1" stop-color="#6C00F5"/></linearGradient></defs><path :fill="`url(#${gid})`" d="m222.077 39.192-8.019 125.923L137.387 0l84.69 39.192Zm-53.105 162.825-57.933 33.056-57.934-33.056 11.783-28.556h92.301l11.783 28.556ZM111.039 62.675l30.357 73.803H80.681l30.358-73.803ZM7.937 165.115 0 39.192 84.69 0 7.937 165.115Z"/></svg><span class="ng-text">ngular</span></span>
</template>

<script setup>
// "Angular" in the brand: the logo as its A, the rest in the logo's gradient.
// Logo: official SVG from angular/angular (adev/shared-docs/.../assets/angular.svg).
// `display` sizes the logo for a big FitText line; the default suits the small uppercase rule.
import { useId } from 'vue'
defineProps({ display: { type: Boolean, default: false } })
// Slidev keeps neighbouring slides mounted: one gradient id per instance.
const gid = `ng-grad-${useId()}`
</script>

<style scoped>
.ng-word { white-space: nowrap; }
.ng-a { display: inline-block; width: auto; }
.ng-kicker .ng-a { height: 1.35em; vertical-align: -0.32em; margin-right: 0.04em; }
.ng-display .ng-a { height: 0.74em; vertical-align: -0.04em; margin-right: 0.01em; }
.ng-text {
  background: linear-gradient(90deg, #F60A48 0%, #DC087D 45%, #9717E7 80%, #6C00F5 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
</style>
