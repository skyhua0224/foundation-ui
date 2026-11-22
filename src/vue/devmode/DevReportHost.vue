<script setup>
import MFeedbackPanel from '../feedback/MFeedbackPanel.vue'
import MFeedbackDecision from '../feedback/MFeedbackDecision.vue'
import DevSignIn from './DevSignIn.vue'
import MFeedbackReplySheet from '../feedback/MFeedbackReplySheet.vue'

// Mounted once at the root of a product, next to MErrorHost: draws the one feedback panel, the short decision dialog that can come before it, the sign-in sheet (devReport.js decides when they open) and the sheet of a developer's answer (useFeedbackReplies opens it from the status button).
defineProps({ locale: { type: String, default: 'zh' } })
</script>

<template>
  <MFeedbackPanel :locale="locale" />
  <MFeedbackDecision :locale="locale" />
  <DevSignIn :locale="locale" />
  <MFeedbackReplySheet :locale="locale" />
</template>
