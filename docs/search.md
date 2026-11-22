# The settings search

One search for everything a person can look for (settings, pages, the navigation, actions, clients, applications, the tiles of the overview). The code is in
`src/search/`; it is plain functions, so a product, a test and a later Platform use it as it is. It runs in the page: nothing a person types is sent anywhere,
no model is asked, and no network is touched.

## What it finds

A query is cut into words; **every word has to match**, in any order. Each doc gets the tier of its worst word (lower is better), and results are grouped by type.

| Tier | A word matches | Example |
| --- | --- | --- |
| 0 | the title or the key, exactly | `音频` finds 音频 |
| 1 | the start of the title; the title spelled in pinyin from its start (1.1, 1.3) | `音` / `yinpin` find 音频输出 |
| 2, 3 | a word of the title; inside it | `码率` finds 最大码率 |
| 4 | the keywords of the doc (the other language, the words of its key) | `bitrate` finds 最大码率 |
| 4.05, 4.1 | the doc's own **aliases** (a whole alias, then part of one) | `喇叭` finds 采集哪个扬声器 |
| 4.5, 4.6 | the **synonym table**: the word's group, then the groups below it | `声音` finds 音频 and 扬声器 and 麦克风 |
| 5, 6 | pinyin, whole syllables, initials or a mix, from the start or inside | `yp`, `yinp`, `shengyin` |
| 7 | the place (the breadcrumb) | `encoders` finds what is inside 编码器 |
| 7.5 | two parts of a run of Han characters, in another order | `启用音频` finds 音频启用 |
| 8 | a slip: a letter wrong, missing, extra or swapped; a character left out or added; a homophone | `sepaker`, `麦风`, `音平` |

Also: full-width letters and capitals are the same as ASCII (`ＨＤＲ`, `Hdr`); filler words are dropped when they match nothing (`怎么调分辨率`, `麦克风没声音`,
`how to change the speaker`, `mic not working`); a word of up to four Latin letters has to start a word (`mic` is not in `dynamic`).

The slip tier is looked for only when there is no answer, or only a short and weak one, so it never crowds out a real hit.

**Did you mean.** When nothing matches, `search()` returns `suggest`: the three nearest settings, pages and actions (similarity of the characters, of the pinyin, of the
words of the doc), or nothing when no doc is near enough. `MSearchResults` shows them under 「你是不是要找」.

## What a product adds

* **Aliases of a setting** (`aliases` of `provideSettingsData`, see [settings-data.md](settings-data.md)): words people use for **one** setting. Three to ten, in both languages.
* **Aliases of a page or action**: `aliases` on the doc (`pageDocs`), or the `keywords` of the action texts.
* **The synonym table** (`src/search/synonyms.js`) is for words that name a **kind** of thing (声音, audio, 码率). A doc belongs to the groups whose words occur in its title, its
  other-language label, its keywords or its aliases (not its place). Rules at the top of the file: lower case, no word of one character, no word in two groups.

## Pinyin

`src/search/pinyinTable.js` holds the toneless pinyin of the Han characters of what the products let people search for (about 600 characters, under 4 KB). It is generated from the Unicode
Character Database (Unihan, `kMandarin` and `kHanyuPinyin`; Unicode License v3, `LICENSES/Unicode-3.0.txt`; recorded in `docs/authority/source-index.tsv`):

```
node --import ./scripts/register.mjs scripts/gen-pinyin.mjs --unihan Unihan_Readings.txt --text <the search texts of a product> [--text <more>]
```

The characters are those of this package's own words (the synonym table, the actions, the tiles, the categories) and of the text files given with `--text`, which a product writes from its own
search docs (titles, places, keywords, aliases of its settings and pages). The names of a person's own clients and applications are not in the table: their initials still work.

Characters read two ways in settings words (重 zhong/chong, 行 xing/hang, 率 lv/shuai ...) have both readings. A character the table lacks still gives its initial through the browser's
own pinyin collation, so nothing breaks; `test/searchsmart.test.js` fails when a text of this package uses a character the table lacks, and each product tests its own texts the same way
(`uncoveredHan()`).

## The evaluation set

What people typed and did not find is kept as test cases: *[interface language, query, the docs that answer it]*, passing when one of them is among the first three results. The set of
Foundation Sunshine (`tests/helpers/searchEvalCases.mjs` there, with real settings data) has the audio words first, then the other areas and the reset words; add a case whenever a real
search finds nothing. The hit rate of the same set can be run against any checkout of this package (`FOUNDATION_UI_DIR`), which is how a change of the matcher is compared with the one before.

## Cost

An index is built once from the docs (a few milliseconds for about 400 docs) and again only when the docs change. A keystroke scores every doc: about 0.2-0.7 ms for the real-sized index here, slips and
"did you mean" included. `test/searchsmart.test.js` prints the numbers and fails when the 95th percentile is over 5 ms. The search module gains about 8 KB gzipped once built (3.8 KB before, 12.0 KB after: the synonym table, the pinyin table, the matcher).
