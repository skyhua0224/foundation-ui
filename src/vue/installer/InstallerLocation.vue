<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import MButton from '../MButton.vue'
import MIcon from '../MIcon.vue'

// The install-location row of the first page and the maintenance page: where the program goes, how much room the drive has, and (a fresh install only) the Change button that makes the host open the
// system folder picker and a field to type the path in. The picker adds the product's folder name to what was picked (as Inno Setup and NSIS do after Browse); what is typed is the folder as it stands.
// A refused folder shows its reason under the row; a folder that only carries a warning shows the risk and the safe place one press away (the question that follows an install is InstallerDirConfirm).
// The host owns every check (installDir.error, installDir.warning); the row only draws what it was told and sends what the person typed or pressed.
const props = defineProps({ model: { type: Object, required: true }, busy: { type: Boolean, default: false } })
const emit = defineEmits(['action'])

const input = ref(null)
const draft = ref(props.model.path)
let timer = null
// every snapshot of the host sets the field to the folder it has, unless the person is typing in it: what they typed stays until they leave the field, and the answer to it
// (the folder as the host tidied it: quotes and spaces at the ends dropped) is what the field shows then
watch(() => props.model, (model) => { if (typeof document === 'undefined' || document.activeElement !== input.value) draft.value = model.path })
function commit() {
  clearTimeout(timer)
  if (draft.value !== props.model.path) emit('action', { type: 'set-dir', path: draft.value })
}
// checked a moment after the last key, on Enter and when the field is left
function typed() {
  clearTimeout(timer)
  timer = setTimeout(commit, 450)
}
// Enter confirms the path, but not the Enter that picks a candidate in an input method (a Chinese path is typed with one): that one belongs to the input method
function enter(event) {
  if (event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  commit()
}
function leave() {
  commit()
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="m-inst__loc" :class="{ 'is-error': !!model.error, 'is-warning': !!model.warning }" data-inst-location>
    <div class="m-inst__loc-row">
      <span class="m-inst__loc-icon"><MIcon name="folder" /></span>
      <span class="m-inst__loc-text">
        <span class="m-inst__loc-top"><b>{{ model.label }}</b><span v-if="model.free" class="m-inst__loc-free">{{ model.free }}</span></span>
        <input
          v-if="model.editable" ref="input" v-model="draft" class="m-inst__loc-input" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" inputmode="url"
          :aria-label="model.field" :aria-invalid="model.error ? 'true' : undefined" data-inst-path @input="typed" @keydown.enter="enter" @keydown.esc.stop="draft = model.path" @blur="leave"
        >
        <span v-else class="m-inst__loc-path" :title="model.path"><span class="m-inst__loc-head">{{ model.head }}</span><span class="m-inst__loc-tail">{{ model.tail }}</span></span>
      </span>
      <MButton v-if="model.editable" variant="tonal" class="m-inst__loc-change" :loading="busy" @click="emit('action', { type: 'choose-dir' })">{{ model.change }}</MButton>
    </div>
    <p v-if="model.error" class="m-inst__loc-error" role="alert" :data-code="model.error.code"><MIcon name="error" fill /><span>{{ model.error.text }}</span></p>
    <p v-else-if="model.warning" class="m-inst__loc-warn" role="alert" :data-warning="model.warning.code"><MIcon name="warning" fill /><span>{{ model.warning.text }}</span></p>
    <p v-else-if="model.note" class="m-inst__loc-note" role="status" data-inst-note>{{ model.note }}</p>
    <div v-if="model.useSelected || model.safe" class="m-inst__loc-links">
      <MButton v-if="model.useSelected" variant="text" class="m-inst__loc-use" data-inst-use-selected @click="emit('action', { type: 'use-picked-dir' })">{{ model.useSelected }}</MButton>
      <MButton v-if="model.safe" variant="text" class="m-inst__loc-safe" :title="model.safe.path" data-inst-safe @click="emit('action', { type: 'use-safe-dir' })">{{ model.safe.label }}</MButton>
    </div>
  </div>
</template>
