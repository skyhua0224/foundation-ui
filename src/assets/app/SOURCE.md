# app-icon.svg

- What: the product icon, the sun without clouds (the earlier app-icon-*.png set had two clouds beside the sun; the group feedback of 2026-11-08 asked for the cloudless art and for vector files).
- Source: https://github.com/AlkaidLab/SunshineQ, file 素材/无云.svg, commit 9c5f5873722f6354955216da41cdf1e0c7df52a1 (AlkaidLab is the team that owns the repository).
- Permission: 暗檬 (AlkaidLab) in the group chat, 2026-11-08 01:58-02:01 (CST): "这个用无云版本吧", "你可以放心用svg", "反正优化成svg吧".
- Changes: none; the file is used as it is. Not for use outside the products.
- Where the sun is used (): only the smallest icons: the tray icons with their play / pause / lock badge variants, the browser favicon (16/32) and the title-bar glyph in the app (MBrand, MTrayRow). Everything else (app, exe and installer .ico, icns, apple-touch, the about page) is Vivi (brand assets of AlkaidLab, kept outside this repository). tools/app-icons/gen.py generates the sun files (sizes up to 32 px from a hinted copy of the SVG; the badges are drawn by the generator).
