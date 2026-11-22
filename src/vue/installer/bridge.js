// Installer bridge: the contract between the installer host (Foundation Sunshine setup, a Tauri 2 window driven by
// the native installer shell) and the installer pages in src/vue/installer/*.
//
// Direction host -> UI: a whole InstallerView snapshot every time something changes (no deltas). The UI renders
// from the latest snapshot only; it keeps no install state of its own besides transient UI state (hover, focus,
// scroll, the open/closed state of a disclosure).
// Direction UI -> host: InstallerAction objects. The host is the only one that changes the view; an action never
// changes the page by itself on the UI side. A toggle comes back as a new snapshot within one frame.
//
// Transport (real host): Tauri 2 with app.withGlobalTauri = true.
//   snapshot on demand:   window.__TAURI__.core.invoke('installer_view')            -> InstallerView
//   snapshot push:        window.__TAURI__.event.listen('installer://view', e => e.payload: InstallerView)
//   action:               window.__TAURI__.core.invoke('installer_action', { action: InstallerAction })
// Transport (no Tauri: dev server, gallery, tests): createMockBridge(), a scripted host with the same state machine
// as the native shell (tools/installer_shell_ui.inc click(), begin_install(), finish_run(), poll_run()).
//
// Page root (built by the pages agent): src/vue/installer/MInstaller.vue, default export, one prop `bridge`
// (InstallerBridge). The host entry is `createApp(MInstaller, { bridge: createBridge() })`; MInstaller sends
// {type:'ready'} once it has painted its first frame: the host keeps the window cloaked until then (3 s after the page
// loaded at the latest), so the person never sees an empty WebView. Only a page that has not loaded within 15 s makes
// the installer use its native window instead (nothing has been shown by then).
// Window: 820 x 560 logical px, fixed (not resizable, no maximise), no system caption. The page draws the whole
// window including its own title bar: brand + title on the left, only Minimise and Close on the right (no maximise).
// The draggable title-bar area carries the attribute `data-tauri-drag-region` (Tauri 2 drag regions); its buttons
// do not. Win11 rounds the window corners itself (DWM, about 8 px): the page fills the window edge to edge with the
// surface colour and draws no outer radius, border or shadow of its own. Light/dark follows prefers-color-scheme
// (WebView2 reports the Windows app mode); `view.locale` is the Windows UI language.
//
// The scripted mock host is in bridgeMock.js (re-exported here).
//
// The native shell is the source of truth for the semantics below; the field names are the JSON form of
// tools/installer_d2d.h `struct view` and its reduction of events.jsonl (apply_events, group_state).

import { createMockBridge } from './bridgeMock.js'

export { createMockBridge, MOCK_SCENARIOS } from './bridgeMock.js'

/**
 * @typedef {'welcome'|'maintenance'|'components'|'uac'|'installing'|'failed'|'done'} InstallerPage
 *   welcome      fresh install (no installed copy found)
 *   maintenance  an installed copy was found: update / reinstall / older package, modify, uninstall
 *   components   the component list (custom install / modify)
 *   uac          the elevated worker was asked for; waiting for the UAC consent (no events yet)
 *   installing   events are arriving from the worker
 *   failed       the engine ended with a failure (see `failure`, `exitCode`)
 *   done         success, or success that needs a restart (see `restart`)
 */

/** @typedef {'vdd'|'gamepad'|'usbip'|'vmouse'|'firewall'|'autostart'|'tools'|'desktopicon'} ComponentId */

/**
 * Component order, as on the native components page. Groups: drivers = vdd..vmouse, system = firewall..desktopicon.
 * @type {ReadonlyArray<ComponentId>}
 */
export const COMPONENT_IDS = Object.freeze(['vdd', 'gamepad', 'usbip', 'vmouse', 'firewall', 'autostart', 'tools', 'desktopicon'])
/** @type {Readonly<Record<string, ReadonlyArray<ComponentId>>>} */
export const COMPONENT_GROUPS = Object.freeze({
  drivers: Object.freeze(['vdd', 'gamepad', 'usbip', 'vmouse']),
  system: Object.freeze(['firewall', 'autostart', 'tools', 'desktopicon']),
})

/** @typedef {'pending'|'running'|'done'|'failed'|'reboot'} StepState */

/**
 * Engine phases (events.jsonl `phase`), grouped into the four progress groups.
 * @typedef {'worker'|'engine'|'wizard'|'prepare'|'files'|'path'|'config'|'permissions'|'vdd'|'gamepad'|'usbip'|'vmouse'|'firewall'|'service'|'autostart'|'reboot'} StepId
 */
/** @typedef {'prepare'|'files'|'drivers'|'system'} GroupId */
/** @type {ReadonlyArray<{id: GroupId, steps: ReadonlyArray<StepId>}>} */
export const PROGRESS_GROUPS = Object.freeze([
  Object.freeze({ id: 'prepare', steps: Object.freeze(['worker', 'engine', 'wizard', 'prepare']) }),
  Object.freeze({ id: 'files', steps: Object.freeze(['files', 'path', 'config', 'permissions']) }),
  Object.freeze({ id: 'drivers', steps: Object.freeze(['vdd', 'gamepad', 'usbip', 'vmouse']) }),
  Object.freeze({ id: 'system', steps: Object.freeze(['firewall', 'service', 'autostart', 'reboot']) }),
])

/**
 * @typedef {object} InstallerProgress
 * @property {Array<{id: GroupId, state: StepState}>} groups  always four, in PROGRESS_GROUPS order
 * @property {number} current           index of the running group (0..3)
 * @property {Partial<Record<StepId, StepState>>} steps  only steps the engine reported; a missing step is pending
 *                                       (a step for a component that is not selected never appears)
 * @property {StepId|null} lastStep      the step the latest event was about
 * @property {boolean} finished          the engine reported its final event
 * @property {StepId[]} planned          the steps this run takes, in flow order: the engine's own plan once it has
 *                                       started (its real component selection), before that the host's estimate from
 *                                       the selection; a step that runs without being planned is added. Overall
 *                                       progress = settled planned steps / planned.length.
 * @property {Partial<Record<StepId, number>>} fraction  0..1 for a step that reports its own progress (today: files,
 *                                       from the engine's file copy); a step without an entry has no fraction
 */

/**
 * @typedef {object} InstallerMaintenance
 * @property {string} installedVersion   'unknown' when the registry has no version
 * @property {string} packageVersion     version of this package
 * @property {boolean} downgrade         this package is older than the installed copy
 * @property {boolean} same              same version (reinstall / repair)
 * @property {boolean} hasUninstaller    the uninstall action is available
 */

/**
 * @typedef {'invalid'|'chars'|'not-fixed'|'fs'|'root'|'system'|'synced'|'not-empty'|'too-long'|'no-space'|'no-access'} InstallDirError
 *   A problem: the folder cannot be used, whatever the person says. The install buttons stay off.
 *   invalid     the path is not usable (not a full path, characters Windows does not allow)
 *   chars       a character the installer's scripts cannot carry (! % ^ & ; , = ' ` { } $)
 *   not-fixed   not a fixed disk of this PC (network, removable, mapped, optical)
 *   fs          the volume is not NTFS or ReFS (no permissions to protect the program with)
 *   root        the root of a disk
 *   system      inside the Windows folder
 *   synced      inside a synced folder (OneDrive and the like)
 *   not-empty   the folder has files and is not an existing Foundation Sunshine folder (it would be taken over, and an uninstall would remove them)
 *   too-long    the longest path of the package would pass `maxLength`
 *   no-space    the drive has less than `neededBytes` free
 *   no-access   the folder cannot be opened or created
 *
 * @typedef {'parent'|'user'} InstallDirWarning
 *   A warning: the folder works and is protected itself, but sits where others can replace it from above. Usable after the person confirmed it once (`confirm`), with a safe place offered instead (`safePath`).
 *   parent      a folder above it can be renamed, replaced or re-permissioned by ordinary users, so the program could be swapped out from above
 *   user        inside a user's folder (the profile, Desktop, Documents, Downloads): the user and the programs that run as that user can replace the whole folder
 */

/**
 * @typedef {object} InstallerLocation
 * @property {string} path               the folder the install goes to: the default on a fresh install, the picked one (with the product's folder name added: Inno Setup and NSIS do the same after Browse), the typed one as typed, or the installed copy's
 * @property {boolean} editable          a fresh install on its first page: the Change button shows. false = the place of an installed copy (an upgrade keeps it; to move, uninstall and install again)
 * @property {number|null} freeBytes     free space of the drive of `path`; null when it could not be read
 * @property {number} neededBytes        the space the install needs
 * @property {number} maxLength          the longest path of the folder that is accepted
 * @property {InstallDirError|null} error  why the folder cannot be used; the install buttons stay off while it is set
 * @property {InstallDirWarning|null} warning  why the folder is a risk; null while `error` is set. Install stays on and asks once (`confirm`)
 * @property {string|null} safePath      the safe place for a `warning` (the default folder on the system drive, else the product folder directly on the drive); null without a warning
 * @property {string|null} pickedPath    the folder that was picked when `path` is that folder with the product's name added: one press (`use-picked-dir`) uses it as it is; null after the person typed or pressed it
 * @property {'redirected'|null} note    `redirected`: the picked folder has files in it, so a folder inside it is used
 * @property {boolean} confirm           the question about a `warning` is open (the page draws it, `confirmSeconds` of countdown); the host takes the answer only after that time too
 * @property {number} confirmSeconds     how long "Install anyway" stays closed
 */

/**
 * @typedef {object} InstallerView
 * @property {1} schema
 * @property {number} seq                  increases with every snapshot; drop a snapshot older than the last one
 * @property {InstallerPage} page
 * @property {'zh'|'en'} locale            from the Windows UI language; the UI may follow its own locale pref instead
 * @property {boolean} upgrade             an installed copy exists (maintenance or a plain upgrade)
 * @property {InstallerMaintenance|null} maintenance  null on a fresh install
 * @property {Record<ComponentId, boolean>} components  current selection (pre-filled from the installed copy)
 * @property {boolean} allSelected         every component is selected (the engine then uses its defaults)
 * @property {Partial<Record<ComponentId, string>>} unsupported  components this Windows cannot run, with the minimum Windows
 *                                         version each needs (for example, 'Windows 10 1803' or 'Windows 11'): shown disabled and unticked
 * @property {number} windowsBuild         the Windows build (0 = unknown)
 * @property {boolean} uacCancelled        the last attempt was cancelled at the UAC prompt (show a note on welcome/maintenance)
 * @property {InstallerLocation} installDir  where the program goes (first page and maintenance page)
 * @property {InstallerProgress} progress
 * @property {'none'|'optional'} restart   done page: 'optional' = Windows asked for a restart (the weak Restart PC button);
 *                                         never shown as a blocking step
 * @property {string[]} rebootReasons      e.g. ['vdd','vigem']; [] when none
 * @property {'generic'|'driver'|'service'|null} failure  failed page only
 * @property {number} exitCode             engine exit code (failed page, copy details)
 * @property {string} runId                run id (copy details)
 * @property {boolean} guidePending        done page: the Panel start guide is not finished on this machine; the primary
 *                                         button opens the Panel at the guide. false on an upgrade with a finished guide:
 *                                         the button just opens the Panel.
 * @property {boolean} opening             done page: the Panel is being started (show progress on the button)
 * @property {boolean} panelFailed         done page: the Panel could not be started
 * @property {boolean} busy                the worker runs (uac/installing): closing the window minimises it instead
 */

/**
 * Actions, UI -> host. Unknown actions and actions that do not fit the current page are ignored by the host.
 * @typedef {{type:'ready'}                                  // the page is mounted; the host answers with a snapshot
 *   | {type:'install'}                                      // welcome/maintenance/components: start the elevated worker with the selection
 *   | {type:'retry'}                                        // failed: start the worker again
 *   | {type:'customize'}                                    // welcome/maintenance -> components
 *   | {type:'back'}                                         // components -> welcome or maintenance
 *   | {type:'toggle-component', id: ComponentId}            // components
 *   | {type:'select-all'}                                   // components: all on, or all off when all are on
 *   | {type:'choose-dir'}                                   // welcome (fresh install): the host opens the system folder picker, adds the product's folder name to the pick, checks it and answers with a new `installDir`
 *   | {type:'set-dir', path: string}                        // welcome (fresh install): the path as typed; the host takes it as it is, checks it and answers with a new `installDir`
 *   | {type:'use-picked-dir'}                               // welcome: the picked folder as it is, without the product's folder name (`installDir.pickedPath`)
 *   | {type:'use-safe-dir'}                                 // welcome or the question: the safe place for a warning (`installDir.safePath`)
 *   | {type:'confirm-dir-risk'}                             // the question: install into the folder with the warning (not before `confirmSeconds` have passed)
 *   | {type:'cancel-dir-risk'}                              // the question: back to the page
 *   | {type:'uninstall'}                                    // maintenance: start the installed uninstaller, then the host exits
 *   | {type:'open-panel'}                                   // done: start the Panel (at the guide when guidePending)
 *   | {type:'restart-pc'}                                   // done: Windows restart (Windows asks open apps to close)
 *   | {type:'copy-details'}                                 // failed: run id + exit code to the clipboard
 *   | {type:'open-log-folder'}                              // failed: the run directory in Explorer
 *   | {type:'minimise'}                                     // title bar
 *   | {type:'exit'}                                         // title bar close / Cancel: exits, or minimises while busy
 * } InstallerAction
 */

/** @type {ReadonlyArray<InstallerAction['type']>} */
export const ACTION_TYPES = Object.freeze(['ready', 'install', 'retry', 'customize', 'back', 'toggle-component', 'select-all', 'choose-dir', 'set-dir', 'use-picked-dir', 'use-safe-dir',
  'confirm-dir-risk', 'cancel-dir-risk', 'uninstall', 'open-panel', 'restart-pc', 'copy-details', 'open-log-folder', 'minimise', 'exit'])

/**
 * @typedef {object} InstallerBridge
 * @property {'tauri'|'mock'} kind
 * @property {() => Promise<InstallerView>} view               the latest snapshot
 * @property {(fn: (v: InstallerView) => void) => () => void} subscribe  every new snapshot; returns unsubscribe
 * @property {(a: InstallerAction) => Promise<void>} send
 */

/** @returns {InstallerView} */
export function emptyView() {
  return {
    schema: 1,
    seq: 0,
    page: 'welcome',
    locale: 'zh',
    upgrade: false,
    maintenance: null,
    components: Object.fromEntries(COMPONENT_IDS.map((id) => [id, true])),
    allSelected: true,
    unsupported: {},
    windowsBuild: 0,
    uacCancelled: false,
    installDir: { path: 'C:\\Program Files\\Sunshine', editable: true, freeBytes: null, neededBytes: 0, maxLength: 0, error: null, warning: null, safePath: null, pickedPath: null, note: null, confirm: false, confirmSeconds: 5 },
    progress: {
      groups: PROGRESS_GROUPS.map((g) => ({ id: g.id, state: 'pending' })),
      current: 0,
      steps: {},
      lastStep: null,
      finished: false,
      planned: [],
      fraction: {},
    },
    restart: 'none',
    rebootReasons: [],
    failure: null,
    exitCode: 0,
    runId: '',
    guidePending: true,
    opening: false,
    panelFailed: false,
    busy: false,
  }
}

/** Group state from step states, as group_state() in installer_d2d.h. */
export function groupState(progress, groupIndex) {
  const g = PROGRESS_GROUPS[groupIndex]
  let seen = false, fail = false, reb = false
  for (const s of g.steps) {
    const st = progress.steps[s]
    if (!st) continue
    seen = true
    if (st === 'failed') fail = true
    if (st === 'reboot') reb = true
  }
  if (fail) return 'failed'
  if (reb) return 'reboot'
  if (!seen) return 'pending'
  const lastGroup = progress.lastStep ? PROGRESS_GROUPS.findIndex((x) => x.steps.includes(progress.lastStep)) : -1
  if (!progress.finished && lastGroup === groupIndex) return 'running'
  return 'done'
}

export function validAction(a) {
  if (!a || typeof a !== 'object' || !ACTION_TYPES.includes(a.type)) return false
  if (a.type === 'toggle-component') return COMPONENT_IDS.includes(a.id)
  if (a.type === 'set-dir') return typeof a.path === 'string' && a.path.length <= 4096
  return true
}

/** @returns {InstallerBridge} */
export function createTauriBridge(tauri = globalThis.window?.__TAURI__) {
  const listeners = new Set()
  let last = null
  const accept = (v) => {
    if (!v || (last && v.seq < last.seq)) return
    last = v
    for (const fn of listeners) fn(v)
  }
  tauri.event.listen('installer://view', (e) => accept(e.payload))
  return {
    kind: 'tauri',
    async view() {
      const v = await tauri.core.invoke('installer_view')
      accept(v)
      return last
    },
    subscribe(fn) {
      listeners.add(fn)
      if (last) fn(last)
      return () => listeners.delete(fn)
    },
    async send(action) {
      if (!validAction(action)) return
      await tauri.core.invoke('installer_action', { action })
    },
  }
}

/**
 * The bridge for this page: Tauri when the installer host loaded it, otherwise the mock. `?scenario=` and `?page=`
 * in the URL pick the mock scenario (gallery and dev server).
 * @returns {InstallerBridge}
 */
export function createBridge() {
  const w = globalThis.window
  if (w?.__TAURI__?.core && w.__TAURI__.event) return createTauriBridge(w.__TAURI__)
  const q = new URLSearchParams(w?.location?.search || '')
  return createMockBridge({
    scenario: /** @type {MockScenario} */ (q.get('scenario') || 'fresh'),
    page: /** @type {InstallerPage|undefined} */ (q.get('page') || undefined),
    locale: q.get('lang') === 'en' ? 'en' : 'zh',
  })
}
