import { derivedPorts } from './hostAddress.js'
// Remote access as the guide tells it: how a client reaches this computer from outside the network, the ports, UPnP, what the host's own check says about the way that fits, and the mesh tools.
// No DOM and no Vue (re-exported by guideModel.js, so every import of it keeps working).

/** How a client reaches this computer: only inside the network (nothing to set up), over the internet (UPnP or a port forward), or over a mesh network. */
export const REMOTE_MODES = Object.freeze(['lan', 'public', 'mesh'])
export const MESH_TOOLS = Object.freeze(['tailscale', 'zerotier', 'easytier'])

/**
 * The ports a client uses, from the base port the host is configured with (47989 by default), as the host maps them (hostAddress.js, PORT_OFFSETS): TCP the HTTPS pairing port (base - 5), the
 * base port, the management page (base + 1, not needed for streaming: leave it closed) and RTSP (base + 21); UDP video, control, audio and the microphone (base + 9 .. base + 12).
 * `needed` is false for the one port a stream does not need.
 */
export function remotePorts(base = 47989) {
  const ports = derivedPorts(base)
  const first = ports[0].port + 5
  const tcp = ports.filter((p) => p.proto === 'tcp').sort((a, b) => a.port - b.port).map((p) => ({ port: p.port, needed: p.needed }))
  const udp = ports.filter((p) => p.proto === 'udp').map((p) => p.port)
  return { base: first, tcp, udp: [{ port: Math.min(...udp), to: Math.max(...udp), needed: true }] }
}

/** One port line for the text: `47998` or `47998-48000`. */
export const portText = (entry) => (entry.to ? `${entry.port}-${entry.to}` : String(entry.port))

/** The state of UPnP from the listener answer: what runs now, what is saved, and whether a restart is needed to apply the saved one. */
export function upnpState(network) {
  const active = typeof network?.upnpActive === 'boolean' ? network.upnpActive : null
  const saved = typeof network?.upnpSaved === 'boolean' ? network.upnpSaved : active
  if (active === null && saved === null) return { known: false, on: false, pending: false }
  return { known: true, on: !!saved, active: !!active, pending: active !== null && saved !== active }
}

/**
 * What the host's own reachability check says about the two ways to reach this computer from outside, as one recommendation (the remote page of the done page, variant B):
 * { direct: 'works' | 'possible' | 'no' | 'unknown', recommended: 'mesh' | 'public', meshTool: name of an installed mesh adapter or '' }.
 * Direct works when the host reached itself from outside (verdict verified); it is possible when the router holds a public address; a private or shared (CGNAT) address cannot be reached
 * from outside at all, so a mesh network is the only way there. Anything unknown recommends the mesh network too: it needs nothing opened on the router.
 */
export function remoteAdvice(report) {
  const pub = report?.public
  const wan = pub?.router?.wanClass || 'unknown'
  const direct = pub?.verdict === 'verified' ? 'works' : wan === 'public' ? 'possible' : wan === 'cgnat' || wan === 'private' ? 'no' : 'unknown'
  const adapter = (report?.mesh?.adapters || []).find((a) => a.up)
  return { direct, recommended: direct === 'works' ? 'public' : 'mesh', meshTool: adapter ? adapter.name.replace(/\s*\[.*$/, '').trim() : '' }
}

/** Download pages and the commands the other mesh tools need (official ones). */
export const MESH_LINKS = Object.freeze({
  tailscale: 'https://tailscale.com/download',
  zerotier: 'https://www.zerotier.com/download/',
  easytier: 'https://easytier.cn/',
})
export const MESH_COMMANDS = Object.freeze({
  tailscale: { join: 'tailscale up', address: 'tailscale ip -4' },
  zerotier: { join: 'zerotier-cli join <network-id>', address: 'zerotier-cli listnetworks' },
  easytier: { join: 'easytier-core -d --network-name <name> --network-secret <secret> -p tcp://public.easytier.top:11010', address: 'easytier-cli peer' },
})

