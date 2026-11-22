import { lanRank, pickLanAddresses, shouldAutoOpen } from './guideModel.js'
import { activeElsewhere, unionDone } from './guideHost.js'
import { formatHostAddress } from './hostAddress.js'
// What the first-run guide does when a product starts (a first install or an upgrade) and how an address is named. Pure: no DOM, no Vue.

/**
 * What the guide does when the product starts: { mode: 'fresh' | 'upgrade' } or null (it stays closed). Decided from real state only:
 *  - `version`: the version of the product (panel or Web UI, each with its own stored progress); without one the old rule stands (a first run only, see shouldAutoOpen);
 *  - the stored progress: the version the flow was last shown for, whether it was finished, and how it was shown;
 *  - `setupCompleted` (the host's setup flag, undefined when the host could not be read), `pairedCount` (null when unknown) and `configExists` (the host answered with a configuration).
 * A first install (setup not completed and nobody paired) gets the whole flow, and where it was left unfinished it opens again where it was. An install that exists (setup completed, a
 * client paired, or a flow finished before) gets the upgrade flow once per version, closed or not: the version is stored when it is closed, skipped or finished.
 */
export function guideEntry({ progress = null, version = '', setupCompleted, pairedCount = null, configExists = true, host = null, device = '', now = Date.now() } = {}) {
  const local = progress || {}
  // what the host remembers is shared by every device: finished or closed on one is finished or closed on all, and the steps done on any count
  const p = { ...local, finished: !!(local.finished || host?.finished), visited: unionDone(local.visited || [], local.done || [], host?.done || []) }
  const mark = version || '-'
  // closed with the X for this version (here or on another device): it does not open on its own again until the version changes
  if (local.closed === mark || host?.closed === mark) return null
  // another device is running the guide right now: this one stays closed
  if (activeElsewhere(host, device, now)) return null
  const established = Number.isInteger(pairedCount) && pairedCount > 0
  const fresh = setupCompleted === false && Number.isInteger(pairedCount) && pairedCount === 0
  // a run left unfinished continues where it was, but only for the same version, or on a host nobody has paired with yet: after an over-install of an installed host (a client is paired) the old position is not used
  const unfinishedFresh = !p.finished && p.visited.length > 0 && p.mode !== 'upgrade' && (!established || p.version === version)
  if (!version) return shouldAutoOpen({ setupCompleted, pairedCount, finished: !!p.finished, resuming: unfinishedFresh }) ? { mode: 'fresh' } : null
  if (setupCompleted === undefined || !configExists) return null
  if (unfinishedFresh) return { mode: 'fresh' }
  if (p.version === version) return null
  if (fresh && !p.finished) return { mode: 'fresh' }
  const existing = setupCompleted === true || established || p.finished === true
  return existing ? { mode: 'upgrade' } : null
}

/**
 * The steps an upgrade leaves out because they are done: the account when a password is set, the update channel when the person chose one before (`channelChosen`: the product knows whether the
 * choice was ever saved). An upgrade is what is new, the channel when it was never chosen, and the done page; the client steps are not part of it.
 */
export function upgradeSkips({ accountExists = true, channelChosen = false } = {}) {
  return [
    ...(accountExists ? ['account'] : []),
    ...(channelChosen ? ['channel'] : []),
  ]
}

/** How the client reaches this address: the private network (`lan`), a mesh network by the name of its adapter (`zerotier`, `tailscale`, `easytier`), a public address (`public`) or something else (`other`). */
export function addressKind(entry) {
  const name = String(entry?.name || '')
  if (/zerotier/i.test(name)) return 'zerotier'
  if (/tailscale/i.test(name)) return 'tailscale'
  if (/easytier/i.test(name)) return 'easytier'
  const rank = entry?.rank ?? lanRank(entry?.address)
  if (rank === 0) return 'lan'
  if (rank === 1) return 'other'
  return rank === 2 ? 'public' : 'other'
}


/**
 * The address step for an ordinary person: ONE recommended address and the others behind a fold, so nobody has to tell a local network from a mesh network.
 * The host lists its adapters with their names; the recommended one is the private-network address of a real adapter (a mesh, virtual or container adapter is left out unless nothing else is
 * left); the others are labelled by their adapter (`kind` from addressKind, `name` the adapter's own). A public address is not offered here (the remote access step owns it).
 * `port` is the base port the host listens on: a non-default one is part of every `text`. -> { main: { address, text, name, kind } | null, others: [...], none: boolean }
 */
export function addressPlan(addresses, port) {
  const entry = (a) => ({ address: a.address, text: formatHostAddress(a.address, port), name: a.name, kind: addressKind(a) })
  const all = pickLanAddresses(addresses).filter((a) => a.rank !== 2)
  const best = pickLanAddresses(addresses, { lanOnly: true }).filter((a) => a.rank !== 2)[0] || all[0] || null
  return { main: best ? entry(best) : null, others: all.filter((a) => !best || a.address !== best.address).map(entry), none: !all.length }
}
