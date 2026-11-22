// DualSense tuning keys as settings: the everyday cards and the advanced groups on the gamepad page of 输入, and the
// search entries of every key of the host's tuning snapshot (`/api/dualsense/tuning`). There is no page of its own:
// a card or a group is a sub-page of the gamepad page, the way is 输入 › 手柄 › 触觉与震动.
import { localizedKeyLabel } from './dualsenseLabels.js'
import { SETTINGS_CATEGORIES } from './model.js'
import { ds5Availability } from './availability.js'

/** Everyday options, one card each (key ids). Keys 82-84 are the lightbar colour, edited by the colour row. */
export const DS5_CARDS = Object.freeze([
  { id: 'haptics', icon: 'mobile_vibrate', titleKey: 'ds5.cards.haptics', keys: Object.freeze([2, 3, 13, 14]) },
  { id: 'triggers', icon: 'touch_app', titleKey: 'ds5.cards.triggers', keys: Object.freeze([24, 25]) },
  { id: 'motion', icon: 'sensors', titleKey: 'ds5.cards.motion', keys: Object.freeze([64, 75]) },
  { id: 'lighting', icon: 'lightbulb', titleKey: 'ds5.cards.lighting', keys: Object.freeze([81, 82, 83, 84]), lighting: true },
  { id: 'audio', icon: 'volume_up', titleKey: 'ds5.cards.audio', keys: Object.freeze([95]) },
])

/** Sub-page ids of the gamepad page: `ds5-<card>` for an everyday card, `ds5-g<n>` for an advanced group. */
export const DS5_SUB = Object.freeze({
  card: (id) => `ds5-${id}`,
  group: (n) => `ds5-g${n}`,
  // keys this host build does not apply: one small page behind 高级
  pending: 'ds5-pending',
  // the sub-pages behind the advanced warning
  isGroup: (sub) => /^ds5-g\d+$/.test(sub) || sub === 'ds5-pending',
})

/** A key the client executes: the host does not store it, the page shows it as the client's (authority client or shared client). */
export const isClientKey = (descriptor) => descriptor.implemented === false && (descriptor.authority === 'client' || descriptor.authority === 'shared_client')

/** Where a tuning key lives: { sub } for the sub-page of the card or the advanced group, '' sub = the gamepad page itself. */
export function ds5PlaceOf(descriptor) {
  const card = DS5_CARDS.find((c) => c.keys.includes(descriptor.id))
  if (card && descriptor.implemented !== false) return { sub: DS5_SUB.card(card.id), titleKey: card.titleKey }
  // not applied by this host build: the page of its own, whatever group it belongs to
  if (descriptor.implemented === false) return { sub: DS5_SUB.pending, titleKey: 'ds5.pending.title' }
  if (descriptor.tier === 'advanced' && descriptor.group >= 1) return { sub: DS5_SUB.group(descriptor.group), titleKey: `ds5.groups.${descriptor.group}` }
  return { sub: '', titleKey: '' }
}

/** The way to the gamepad page: ['输入', '手柄']. */
export const gamepadPath = (label) => [label(SETTINGS_CATEGORIES.input.labelKey), label('config.input_gamepad_title')]

/**
 * Search entries of the DualSense keys. label(key) resolves a locale key; locale picks the key labels (zh or en);
 * altLocale adds the other language as keywords so either finds the row. Every entry says whether the key can be used (`availability`, settings/availability.js): the host's own status and reason code,
 * `nativePath` false when the host has no native DualSense path, and `requiresOf(descriptor)` -> { key, title, on } for a key that needs another setting on.
 */
export function dualsenseEntries({ keys = [], label, locale, altLocale = null, nativePath = true, requiresOf = null }) {
  const where = gamepadPath(label)
  return keys.map((descriptor) => {
    const place = ds5PlaceOf(descriptor)
    const availability = ds5Availability(descriptor, { locale, nativePath, requires: requiresOf ? requiresOf(descriptor) : null })
    return {
      id: `ds5:${descriptor.key}`,
      keyName: descriptor.key,
      title: localizedKeyLabel(descriptor, locale),
      path: [...where, place.titleKey && availability?.state !== 'unavailable' ? label(place.titleKey) : ''].filter(Boolean).join(' › '),
      icon: 'sports_esports',
      keywords: [altLocale ? localizedKeyLabel(descriptor, altLocale) : '', descriptor.label, descriptor.key.replace(/[._]/g, ' ')].filter(Boolean).join(' '),
      route: 'config',
      params: { tab: 'input', ...(place.sub ? { sub: place.sub } : {}), focus: `ds5:${descriptor.key}` },
      availability,
    }
  })
}
