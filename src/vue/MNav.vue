<script setup>
import { computed } from 'vue'
import MIcon from './MIcon.vue'

const props = defineProps({
  /** [{ id, label, icon, href?, dot?: 'ok'|'warn'|'none', title?: string (group heading before this item) }] */
  items: { type: Array, required: true },
  footer: { type: Array, default: () => [] },
  current: { type: String, default: '' },
  brandName: { type: String, default: '' },
  brandSub: { type: String, default: '' },
  label: { type: String, default: 'Main' },
  /** Items shown in the bottom bar on narrow screens (ids); default: the first five. */
  barIds: { type: Array, default: () => [] },
})
const emit = defineEmits(['navigate'])
const bar = computed(() => {
  const all = [...props.items, ...props.footer]
  if (props.barIds.length) return props.barIds.map((id) => all.find((i) => i.id === id)).filter(Boolean)
  return props.items.slice(0, 5)
})
const go = (item, event) => {
  if (!item.href) event.preventDefault()
  emit('navigate', item)
}
</script>

<template>
  <nav class="m-nav" :aria-label="label">
    <div class="m-nav__brand"><span class="m-nav__mark" /><span class="m-nav__name"><b v-if="brandName">{{ brandName }}</b><small v-if="brandSub">{{ brandSub }}</small></span></div>
    <div class="m-nav__list">
      <template v-for="item in items" :key="item.id">
        <div v-if="item.title" class="m-nav__title">{{ item.title }}</div>
        <component :is="item.href ? 'a' : 'button'" class="m-nav-item" :href="item.href" :type="item.href ? undefined : 'button'" :aria-current="current === item.id ? 'page' : undefined" @click="go(item, $event)">
          <MIcon :name="item.icon" :fill="current === item.id" />
          <span class="m-nav-item__label">{{ item.label }}</span>
          <i v-if="item.dot" class="m-nav-item__dot" :class="`m-nav-item__dot--${item.dot}`" />
        </component>
      </template>
    </div>
    <div class="m-nav__foot">
      <component :is="item.href ? 'a' : 'button'" v-for="item in footer" :key="item.id" class="m-nav-item" :href="item.href" :type="item.href ? undefined : 'button'" :aria-current="current === item.id ? 'page' : undefined" @click="go(item, $event)">
        <MIcon :name="item.icon" :fill="current === item.id" />
        <span class="m-nav-item__label">{{ item.label }}</span>
      </component>
      <slot name="foot" />
    </div>
  </nav>
  <nav class="m-bar" :aria-label="label">
    <component :is="item.href ? 'a' : 'button'" v-for="item in bar" :key="item.id" class="m-nav-item" :href="item.href" :type="item.href ? undefined : 'button'" :aria-current="current === item.id ? 'page' : undefined" @click="go(item, $event)">
      <MIcon :name="item.icon" :fill="current === item.id" />
      <span class="m-nav-item__label">{{ item.label }}</span>
    </component>
  </nav>
</template>
