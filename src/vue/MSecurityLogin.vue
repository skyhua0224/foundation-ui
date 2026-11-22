<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import MPage from './MPage.vue'
import MSection from './MSection.vue'
import MGroup from './MGroup.vue'
import MItem from './MItem.vue'
import MFieldItem from './MFieldItem.vue'
import MBanner from './MBanner.vue'
import MButton from './MButton.vue'
import MChip from './MChip.vue'
import MDialog from './MDialog.vue'
import MEmpty from './MEmpty.vue'
import MLoading from './MLoading.vue'
import MSnackbar from './MSnackbar.vue'
import { deviceLabel, endsAt, passwordIssues, spanText } from '../auth/model.js'
import { agoText, authTexts, fill } from '../auth/texts.js'
import { clockText } from '../settings/reachability.js'
import { useAuthSession } from './useAuthSession.js'

// 安全与登录: the page that is the same in the Web UI and in the control panel. This sign-in (who, since when, how long it lasts, sign out), the other devices that are signed in (each can be
// signed out, or all of them), and the password. On the host itself (loopback) there is no session: the page says so and keeps the password and the list of the other devices.
// A host without the session API (older) shows that, and the product keeps its old password page.
const props = defineProps({
  client: { type: Object, required: true },
  locale: { type: String, default: 'en' },
  /** called after this sign-in ended or when no account exists: the product goes to its sign-in/create-account page */
  signedOut: { type: Function, default: null },
  /** the page is deeper than a list row (a back arrow) */
  back: { type: Boolean, default: false },
})
const emit = defineEmits(['back'])
const T = computed(() => authTexts(props.locale))
const auth = useAuthSession(props.client)
const now = ref(Date.now())
let timer = 0
onMounted(() => { auth.load(); timer = setInterval(() => { now.value = Date.now() }, 30000) })
onBeforeUnmount(() => clearInterval(timer))

const s = computed(() => auth.session.value)
const setupRequired = computed(() => s.value?.setupRequired === true)
const mine = computed(() => auth.signedIn.value && !auth.local.value)
const others = computed(() => auth.list.sessions.filter((x) => !x.current))
const lifetime = computed(() => {
  if (!mine.value) return ''
  const idle = s.value.expiresAt, hard = s.value.absoluteExpiresAt
  if (idle && hard && hard <= idle) return fill(T.value.endsAtMost, { span: spanText(hard - now.value, T.value) })
  return fill(T.value.endsIn, { span: spanText(Math.max(0, endsAt(s.value) - now.value), T.value) })
})
const rows = computed(() => auth.list.sessions.filter((x) => !x.current).map((x) => ({
  ...x, title: [deviceLabel(x.agent), x.ip].filter(Boolean).join(' · ') || x.id.slice(0, 8), text: fill(T.value.lastSeen, { time: x.lastSeen && now.value - x.lastSeen < 45000 ? T.value.ago.now : agoText(x.lastSeen, now.value, T.value) }),
})))

const note = ref('')
const askOut = ref(false)
const askAll = ref(false)
const askOne = ref(null)
const say = (text) => { note.value = text }
async function doOut() {
  askOut.value = false
  const r = await auth.signOut()
  if (r.ok) props.signedOut?.()
}
async function doAll() {
  askAll.value = false
  const r = await auth.revokeAll()
  // the control panel (a trusted local surface) has no sign-in to go back to: it stays on the page and the list is read again
  if (r.ok) { if (auth.local.value) { say(T.value.revokedAll); await auth.loadSessions() } else if (mine.value) props.signedOut?.(); else say(T.value.revokedAll) }
}
async function doOne() {
  const id = askOne.value?.id; askOne.value = null
  if (!id) return
  const r = await auth.revoke(id)
  if (r.ok) say(T.value.revoked)
}

const open = ref(false)
const current = ref(''); const next = ref(''); const repeat = ref(''); const touched = ref(false)
// the account form: the user name (the current one, to keep or to change), the CURRENT password (always asked, in the control panel too: the host checks it), and a new password (empty keeps it)
const username = ref('')
const renamed = computed(() => username.value.trim() !== '' && username.value.trim() !== (s.value?.username || ''))
const issues = computed(() => (next.value === '' && renamed.value ? [] : passwordIssues(next.value, { username: username.value || s.value?.username || '', confirm: repeat.value })))
const fieldError = computed(() => (touched.value && issues.value.length ? T.value.issues[issues.value[0]] : ''))
const canChange = computed(() => current.value !== '' && (next.value !== '' || renamed.value) && !auth.busy.value)
const toggleForm = () => { open.value = !open.value; if (open.value) { username.value = s.value?.username || ''; current.value = next.value = repeat.value = ''; touched.value = false } }
const passwordError = computed(() => {
  const e = auth.error.value
  if (!e || auth.busy.value === 'password') return ''
  if (e.kind === 'invalid') return T.value.wrongCurrent
  if (e.kind === 'throttled') return fill(T.value.errors.throttled, { time: spanText(e.retryAfter * 1000, T.value) })
  return T.value.errors[e.kind] || T.value.errors.server
})
async function save() {
  touched.value = true
  if (issues.value.length || !canChange.value) return
  const r = await auth.changePassword({ current: current.value, next: next.value, confirm: next.value ? repeat.value : undefined, username: renamed.value ? username.value.trim() : '' })
  if (r.ok) { open.value = false; current.value = next.value = repeat.value = ''; touched.value = false; say(T.value.changed) }
  else current.value = ''
}
const started = computed(() => (s.value?.createdAt ? fill(T.value.startedAt, { time: clockText(new Date(s.value.createdAt).toISOString()) }) : ''))
const failure = computed(() => (auth.state.value === 'error' ? T.value.failed : ''))
const lastError = computed(() => { const e = auth.error.value; return e && !passwordError.value ? T.value.errors[e.kind] || '' : '' })
</script>

<template>
  <MPage :title="T.title" :back="back" @back="emit('back')">
    <div v-if="auth.state.value === 'loading'" class="m-sec__wait"><MLoading size="40px" /></div>
    <MBanner v-else-if="auth.state.value === 'unavailable'" tone="info" icon="info"><b>{{ T.unavailable }}</b> {{ T.unavailableText }}</MBanner>
    <MEmpty v-else-if="auth.state.value === 'error'" icon="error" :title="failure" :text="T.errors[auth.error.value?.kind] || ''"><MButton variant="tonal" icon="refresh" @click="auth.load()">{{ T.retry }}</MButton></MEmpty>
    <template v-else>
      <MBanner v-if="lastError" tone="error" icon="error">{{ lastError }}</MBanner>

      <!-- a browser that is signed out is sent to the sign-in page; an installation without an account is sent to the
           same place, where the host's setup_required answer turns the form into account creation -->
      <MEmpty v-if="!auth.signedIn.value && !auth.local.value" :icon="setupRequired ? 'person_add' : 'lock'" :title="setupRequired ? T.setupTitle : T.signedOutTitle" :text="setupRequired ? T.setupLead : T.signedOutText">
        <MButton v-if="signedOut" :icon="setupRequired ? 'person_add' : 'login'" @click="signedOut()">{{ setupRequired ? T.create : T.signIn }}</MButton>
      </MEmpty>

      <MSection v-if="mine || s.username || auth.local.value" :title="mine ? T.now : T.local">
        <MGroup>
          <MItem v-if="mine" icon="verified_user" :title="fill(T.signedAs, { name: s.username })" :text="[started, lifetime].filter(Boolean).join(' · ')">
            <template #trail><MChip v-if="s.remember" tone="info" icon="check">{{ T.remembered }}</MChip></template>
          </MItem>
          <MItem v-else icon="computer" :title="s.username ? fill(T.signedAs, { name: s.username }) : T.local" :text="auth.signedIn.value ? '' : T.errors['signed-out']" />
          <MItem v-if="mine" action icon="logout" :title="T.signOut" @click="askOut = true" />
        </MGroup>
      </MSection>

      <MSection v-if="auth.signedIn.value" :title="T.sessions">
        <MGroup v-if="rows.length">
          <MItem v-for="x in rows" :key="x.id" icon="devices" :title="x.title" :text="x.text">
            <template #trail>
              <MChip v-if="x.remember" icon="check">{{ T.remembered }}</MChip>
              <MButton variant="text" size="sm" :disabled="!!auth.busy.value" @click="askOne = x">{{ T.revoke }}</MButton>
            </template>
          </MItem>
        </MGroup>
        <MGroup v-else><MItem icon="devices" :title="T.sessionsEmpty" /></MGroup>
        <MGroup v-if="mine || others.length"><MItem action icon="logout" :title="T.revokeAll" tone="error" @click="askAll = true" /></MGroup>
      </MSection>

      <MSection v-if="auth.signedIn.value" :title="T.password2">
        <MGroup>
          <MItem action icon="key" :title="T.change" :text="T.passwordText" data-sec="change" @click="toggleForm" />
          <template v-if="open">
            <MFieldItem v-model="username" :label="T.username" name="username" autocomplete="username" required data-sec="username" />
            <MFieldItem v-model="current" :label="T.current" type="password" name="current" autocomplete="current-password" required :error="passwordError" data-sec="current" />
            <MFieldItem v-model="next" :label="T.next" type="password" name="new" autocomplete="new-password" :supporting="fieldError ? '' : T.passwordRule" :error="fieldError" data-sec="next" />
            <MFieldItem v-model="repeat" :label="T.repeat" type="password" name="repeat" autocomplete="new-password" data-sec="repeat" />
          </template>
        </MGroup>
        <div v-if="open" class="m-sec__cta"><MButton icon="save" :loading="auth.busy.value === 'password'" :disabled="!canChange" data-sec="save" @click="save">{{ T.save }}</MButton></div>
      </MSection>
    </template>

    <MDialog v-model="askOut" :title="T.signOutAsk" icon="logout" tone="error">
      <p>{{ T.signOutAsk2 }}</p>
      <template #actions><MButton variant="text" @click="askOut = false">{{ T.cancel }}</MButton><MButton variant="danger" icon="logout" @click="doOut">{{ T.confirm2 }}</MButton></template>
    </MDialog>
    <MDialog :model-value="!!askOne" :title="T.revokeAsk" icon="logout" tone="error" @update:model-value="(v) => { if (!v) askOne = null }">
      <p>{{ askOne?.title }}</p>
      <template #actions><MButton variant="text" @click="askOne = null">{{ T.cancel }}</MButton><MButton variant="danger" @click="doOne">{{ T.confirm2 }}</MButton></template>
    </MDialog>
    <MDialog v-model="askAll" :title="T.revokeAllAsk" icon="logout" tone="error">
      <p>{{ T.revokeAllText }}</p>
      <template #actions><MButton variant="text" @click="askAll = false">{{ T.cancel }}</MButton><MButton variant="danger" @click="doAll">{{ T.confirm2 }}</MButton></template>
    </MDialog>
    <MSnackbar :model-value="!!note" :message="note" :timeout="4000" @update:model-value="(v) => { if (!v) note = '' }" />
  </MPage>
</template>
