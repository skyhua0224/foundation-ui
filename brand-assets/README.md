# brand-assets

The brand artwork of AlkaidLab that the Foundation products show: 薇薇 (Vivi, the mascot), the lion mascot files and the two wallpapers.

**These files are not under MPL-2.0.** The licence of this repository (MPL-2.0, the file `LICENSE` at the root) covers the source code and the other
files of foundation-ui. Everything in this directory is licensed on its own terms, in the file [`LICENSE`](./LICENSE) next to this one:
[Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International](https://creativecommons.org/licenses/by-nc-nd/4.0/) (CC BY-NC-ND 4.0).

- Copyright: © AlkaidLab.
- What is covered: `vivi/` (the figure of 薇薇 in the sizes the products draw her, her two wallpapers `vivi-wallpaper-1.webp` and `vivi-wallpaper-2.webp`,
  the window buttons `btn-*.svg` drawn with her), `mascot/` (the lion mascot, three sizes).
- In short: you may copy and share these files unchanged, with the credit above and a link to the licence, for non-commercial use. You may not use
  them commercially, and you may not share changed versions. The licence text decides; this paragraph does not replace it.
- Technical changes: section 2(a)(4) of the licence allows the technical modifications that are necessary to exercise the licensed rights in other media and
  formats, such as scaling or converting the file format. Files changed only in this way are not adapted material. Any other changed version may not be shared.
- No trademark right comes with them: the names and marks are covered by [TRADEMARKS.md](../TRADEMARKS.md).

## How a Product uses them

The library itself ships no picture. The shell and the components draw 薇薇 and offer her wallpapers only after the Product registers them:

```js
import { registerViviAssets } from 'foundation-ui/brand-assets'
registerViviAssets() // once, before the first mount
```

A Product that does not import this module carries none of the files in its build. A Product that does import it takes on the licence of this
directory for these files: it needs the right to use them under CC BY-NC-ND 4.0, or a separate permission from AlkaidLab.

`registerViviAssets` calls `registerMascot` and `registerWallpapers` of `foundation-ui/registry`; a Product with its own art registers that the same way.

## Files

| Path | What | Source |
| --- | --- | --- |
| `vivi/vivi-logo-*.png`, `vivi/vivi-avatar-*.webp`, `vivi/vivi-clip-*`, `vivi/vivi-bg.webp`, `vivi/vivi-loading.webp` | 薇薇 in every size the products draw | Original art of AlkaidLab; resized files made with `scripts/build-vivi-assets.py` |
| `vivi/vivi-wallpaper-1.webp`, `vivi/vivi-wallpaper-2.webp` | the two wallpapers | Original art of AlkaidLab |
| `vivi/btn-*.svg` | close, maximize, minimize and restore buttons of the window caption, drawn with her | Original art of AlkaidLab |
| `mascot/lion-*.png` | the lion mascot | Original art of AlkaidLab |
