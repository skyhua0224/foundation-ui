# Settings data: what a product supplies

foundation-ui draws the settings area (the list pane, the search, the recent list, the pins), but it carries no settings of any product: no search index, no label text, no page templates. The product hands them over at start, once, before anything is drawn.

```js
import { provideSettingsData } from 'foundation-ui/settings'

provideSettingsData({
  searchIndex: [
    { id: 'max_bitrate', title: 'config.max_bitrate', path: ['tabs.display', 'shell.display_encoders'],
      icon: 'speed', keywords: 'max_bitrate speed', route: 'config', params: { tab: 'display', sub: 'encoders', focus: 'max_bitrate' } },
  ],
  labels: { en: { 'config.max_bitrate': 'Bitrate ceiling', /* … */ }, zh: { /* … */ } },
})
```

| Part | Type | Meaning |
| --- | --- | --- |
| `searchIndex` | `SearchEntry[]` | One entry per setting: `id` (the configuration key), `title` (a label key), `path` (the label keys of the places above it), `icon`, `keywords`, `route`, `params` (`tab`, optional `sub`, `focus`). |
| `labels` | `Record<locale, Record<key, text>>` | The text tables of the interface languages. `en` is required: it fills the gaps of the other languages. |
| `aliases` | `Record<id, string \| string[]>` (optional) | What people call a setting instead of its label, by `id`, in any language: `audio_sink: ['喇叭', 'headphones']`. The search finds the row by them (see [search.md](search.md)). |

The types are JSDoc typedefs in `src/settings/provider.js` (`SearchEntry`, `LabelTables`, `SettingsData`). `provideSettingsData` checks the shape and throws a `TypeError` that names the problem (`settingsDataProblems(data)` returns the same list without throwing). A second call replaces the data and calls the subscribers (`onSettingsData(fn)`); `useSettingsList` redraws on it.

Reading: `getSearchIndex()`, `getLabels()`, `getAliases()`, `labelOf(locale, key)` (English when the language lacks the key, the key itself when nobody has it), `labelsFor(locale)`, `hasSettingsData()`, `settingsDataVersion()`. Until data is supplied the index is empty and `labelOf` answers the key, so a page that is drawn too early shows keys instead of failing.

The data of Foundation Sunshine is generated in that project from its tab templates and locale files (`scripts/gen-config-index.mjs`) and lives in its Web UI (`config/settingsData/`), under its own licence. The control panel takes it from the same place at build time. The tests of this package use the small made-up data set in `test/helpers/settingsFixture.js`.
