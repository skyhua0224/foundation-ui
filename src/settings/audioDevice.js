// The audio device a setting points at, as a person reads it. `audio_sink` and `virtual_sink` store what the picker chose: the id
// of the playback endpoint, such as {0.0.0.00000000}.{29dd7668-45b2-4846-882d-950f55bf7eb8}. That is the host's key for the device
// and means nothing to a person, so a row, a tile or a search result shows the device by its name, or says "selected device"
// when the name is not known (the list of devices is not loaded, or the device is gone). Pure: no DOM, no Vue.

const ENDPOINT_ID = /^\{[0-9a-f.]+\}\.\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i

/** Whether text is a playback endpoint id (what the picker stores), not a device name. */
export const looksLikeEndpointId = (value) => ENDPOINT_ID.test(String(value ?? '').trim())

const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()

/**
 * The name to show for a stored device value.
 *   value    the stored setting ('' = the system default)
 *   devices  the playback endpoints of the host ([{ id, name, description, adapter }], GET /api/audio/devices `render`), or null when not read
 *   unknown  the words for an id nothing matches ("selected device")
 * Returns '' for an empty value, the device name when the list knows the device (by id, name, description or adapter, like the host),
 * the stored text itself when someone typed a name, and `unknown` for an id that is not in the list.
 */
export function audioDeviceName(value, devices, unknown = '') {
  const stored = String(value ?? '').trim()
  if (!stored) return ''
  const list = Array.isArray(devices) ? devices : []
  for (const field of ['id', 'name', 'description', 'adapter']) {
    const hit = list.find((d) => same(d?.[field], stored))
    if (hit?.name) return String(hit.name)
  }
  return looksLikeEndpointId(stored) ? unknown : stored
}
