<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MBrand from './MBrand.vue'
import MButton from './MButton.vue'
import MField from './MField.vue'
import MLoading from './MLoading.vue'
import { passwordIssues, safeNext, spanText } from '../auth/model.js'
import { authTexts, fill } from '../auth/texts.js'
import { useAuthSession } from './useAuthSession.js'
import { submitOnEnter } from './submitOnEnter.js'

// The sign-in page of the Web UI, standing alone (no rail, no caption bar): the brand, one card, one primary button. It asks the host what this browser is (GET /api/auth/session):
// signed in already -> straight on to `next`; no account yet -> the create-account form (the host allows that only while there is none); otherwise the sign-in form.
// The host never says whether the user name or the password was wrong, so neither does this page. After five wrong tries the host answers 429 with Retry-After: the button waits it out.
const props = defineProps({
  /** the auth client (auth/client.js) */
  client: { type: Object, required: true },
  locale: { type: String, default: 'en' },
  /** the return path from the address (`?next=`); only a same-origin path is followed */
  next: { type: String, default: '' },
  /** the product's name beside the brand mark */
  name: { type: String, default: '' },
  /** the languages of the footer's selector: [{ value, label }]; none, no selector */
  languages: { type: Array, default: () => [] },
  /** the links of the footer, small, at the right: [{ id: 'site' | 'bilibili' | 'docs' | 'github', url }] */
  links: { type: Array, default: () => [] },
})
const emit = defineEmits(['done', 'language'])
const T = computed(() => authTexts(props.locale))
const auth = useAuthSession(props.client)
const mode = computed(() => (auth.session.value?.setupRequired ? 'setup' : 'signin'))
const username = ref('')
const password = ref('')
const confirm = ref('')
const remember = ref(false)
const reveal = ref(false)
const touched = ref(false)
const forgot = ref(false) // 忘记密码？ opens its answer in place: the password is reset in the Panel on the host, a web page cannot do it, so there is no link to leave for
const left = ref(0) // seconds of waiting the host asked for
let tick = 0

const issues = computed(() => (mode.value === 'setup' ? passwordIssues(password.value, { username: username.value, confirm: confirm.value }) : []))
const issueText = computed(() => (touched.value && issues.value.length ? T.value.issues[issues.value[0]] : ''))
const canSend = computed(() => username.value.trim() !== '' && password.value !== '' && !auth.busy.value && left.value === 0 && (mode.value === 'signin' || issues.value.length === 0))
const hasError = computed(() => !!message.value)
const message = computed(() => {
  const e = auth.error.value
  if (!e) return ''
  if (e.kind === 'throttled') return fill(T.value.errors.throttled, { time: spanText(left.value > 0 ? left.value * 1000 : e.retryAfter * 1000, T.value) })
  return T.value.errors[e.kind] || T.value.errors.server
})

function wait(seconds) {
  clearInterval(tick); left.value = seconds
  tick = setInterval(() => { left.value = Math.max(0, left.value - 1); if (left.value === 0) clearInterval(tick) }, 1000)
}
watch(() => auth.error.value, (e) => { if (e?.kind === 'throttled') wait(e.retryAfter) })
// the rules show once the second entry is typed (not while the first is still being written), and at submit
watch(confirm, (v) => { if (v) touched.value = true })

const go = () => emit('done', safeNext(props.next, '/'))
async function submit() {
  touched.value = true
  if (!canSend.value) return
  const input = { username: username.value.trim(), password: password.value, remember: remember.value }
  const r = mode.value === 'setup' ? await auth.setup(input) : await auth.login(input)
  if (r.ok) { password.value = ''; confirm.value = ''; go(); return }
  if (r.error?.kind === 'setup-done') await auth.load()
  password.value = ''; confirm.value = ''
}
onMounted(async () => {
  if (await auth.load() && auth.session.value?.authenticated) go()
})
onBeforeUnmount(() => clearInterval(tick))
</script>

<template>
  <main class="m-login" :aria-busy="auth.state.value === 'loading'">
    <section class="m-login__card" :aria-labelledby="'m-login-title'">
      <div class="m-login__aside">
        <MBrand class="m-login__brand" :name="name" :size="40" />
        <h1 id="m-login-title" class="m-login__title">{{ mode === 'setup' ? T.setupTitle : T.signInTitle }}</h1>
        <p v-if="mode === 'setup' ? T.setupLead : T.signInLead" class="m-login__lead">{{ mode === 'setup' ? T.setupLead : T.signInLead }}</p>
      </div>
      <div v-if="auth.state.value === 'loading'" class="m-login__wait"><MLoading size="40px" /></div>
      <form v-else class="m-login__form" novalidate @submit.prevent="submit" @keydown="submitOnEnter">
        <div class="m-login__fields">
          <MField v-model="username" :label="T.username" :error="hasError ? '\u200b' : ''" :disabled="left > 0" />
          <MField v-model="password" :label="T.password" :type="reveal ? 'text' : 'password'" :disabled="left > 0" :supporting="mode === 'setup' && !issueText ? T.passwordRule : ''" :error="message || (mode === 'setup' ? issueText : '')" />
          <MField v-if="mode === 'setup'" v-model="confirm" :label="T.confirm" :type="reveal ? 'text' : 'password'" />
        </div>
        <div class="m-login__checks">
          <label class="m-login__check"><md-checkbox touch-target="wrapper" :checked="reveal" @change="reveal = $event.target.checked" /><span class="m-login__checktext">{{ T.showPassword }}</span></label>
          <label class="m-login__check"><md-checkbox touch-target="wrapper" :checked="remember" @change="remember = $event.target.checked" /><span class="m-login__checktext">{{ T.remember }}<small>{{ T.rememberHint }}</small></span></label>
        </div>
        <div class="m-login__actions">
          <button v-if="mode === 'signin'" type="button" class="m-login__forgot" :aria-expanded="forgot" aria-controls="m-login-forgot" @click="forgot = !forgot">{{ T.forgot }}</button>
          <MButton type="submit" class="m-login__submit" :icon="mode === 'setup' ? 'person_add' : ''" :loading="!!auth.busy.value" :disabled="!canSend && !auth.busy.value">
            {{ auth.busy.value ? T.checking : mode === 'setup' ? T.create : T.signIn }}
          </MButton>
        </div>
        <p v-if="mode === 'signin' && forgot" id="m-login-forgot" class="m-login__hint" role="note">{{ T.forgotHint }}</p>
      </form>
    </section>
    <footer class="m-login__foot">
      <label v-if="languages.length" class="m-login__lang"><span class="m-login__sr">{{ T.language }}</span>
        <select :value="locale" :aria-label="T.language" @change="emit('language', $event.target.value)"><option v-for="l in languages" :key="l.value" :value="l.value">{{ l.label }}</option></select>
      </label>
      <nav v-if="links.length" class="m-login__links" :aria-label="T.docs"><a v-for="l in links" :key="l.id" :href="l.url" target="_blank" rel="noopener noreferrer">{{ T[l.id] }}</a></nav>
    </footer>
  </main>
</template>
