<script setup>
import { UNIT_GAP, gridWidthOf } from './homeSizes.js'

// The tile grid before its tiles exist: every tile as a rounded surface at its final box, with the mark and the two lines a tile starts with, and a slow light sweep. It has no delay:
// it is only put where the tiles are known to come late (the first frame of the page), and the tiles take its place box for box.
defineProps({
  /** [{ key, width, units, template, autoRows, cells: [{ style, cls, big }] }], from dash/dashSkeleton.js */
  blocks: { type: Array, required: true },
})
</script>

<template>
  <div class="m-dash__blocks m-dskel" role="status" aria-busy="true">
    <section v-for="b in blocks" :key="b.key" class="m-dash__block" :style="b.unit ? { flex: '0 1 auto', width: `${gridWidthOf(b.units, b.unit)}px`, maxWidth: '100%' } : b.width ? { width: `${b.width}px`, maxWidth: '100%' } : undefined">
      <div class="m-dash__grid" :style="{ '--m-dash-gap': `${UNIT_GAP}px`, gridTemplateColumns: `repeat(${b.units}, minmax(0, 1fr))`, gridTemplateRows: b.template || undefined, gridAutoRows: b.autoRows, gridAutoFlow: 'dense' }">
        <div v-for="(c, i) in b.cells" :key="i" class="m-dskel__tile" :class="{ 'is-big': c.big, 'is-strip': c.cls === 'strip', 'is-journey': c.cls === 'journey' }" :style="c.style">
          <i class="m-dskel__mark" /><b /><b />
        </div>
      </div>
    </section>
  </div>
</template>
