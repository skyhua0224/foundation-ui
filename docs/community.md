# Community links

The about page shows two addresses that change without a release: the QQ group and the documentation.
They come from one small JSON file published beside the announcements file, so the maintainers can
change them without shipping a build. The code lives in `src/community/` (import
`foundation-ui/community`); the panel and the Web UI share it through `useCommunityLinks`.

## Where the file lives

| Host | URL |
| --- | --- |
| Primary | `https://www.alkaidlab.com/release-metadata/foundation-sunshine-community.json` |
| Mirror | `https://www.alkaidlab.cn/release-metadata/foundation-sunshine-community.json` |

Publish the same file on both hosts, next to `foundation-sunshine-announcements.json`, with
`Access-Control-Allow-Origin: *` (the Web UI needs it). The file is fetched the way the announcements
are (see `announcements.md`): one host is asked first (the `.cn` mirror for a Chinese interface, the
`.com` host otherwise), the other only when the first failed, a 404 counts as an answer, the request goes
through the HTTP cache (set `Cache-Control` and an `ETag` on the file), the answer is kept locally for
30 minutes and the network is asked at most once per app start plus a manual refresh. No cookies,
headers, referrer, query string or identifier is sent.

## What the app shows without the file

The addresses of the README of the host repository are built in, so the page is complete offline and
before the file exists (a 404 is the normal state):

| id | Built-in address | Source |
| --- | --- | --- |
| `qq` | `https://qm.qq.com/q/vIVhpjDMic` | README, top line, "QQ 交流群" |
| `docs` | `https://www.alkaidlab.com/docs/` (`.cn` mirror for a Chinese interface) | the project site |

The QQ row is always the group's official join link, never a typed group number.

## File format

```json
{
  "schema": 1,
  "links": {
    "qq": { "url": "https://qm.qq.com/cgi-bin/qm/qr?k=...&jump_from=webapi" },
    "docs": { "url": "https://www.alkaidlab.com/docs/", "zh": "https://www.alkaidlab.cn/docs/" }
  }
}
```

A complete example is in `community.sample.json`.

| Field | Required | Rules |
| --- | --- | --- |
| `schema` | yes | The number `1`. Any other value makes the whole file be ignored. |
| `links` | yes | Object. Only the ids below are read; any other id is ignored (so a newer file stays readable by an older app). |
| `links.<id>.url` | yes, per link | `https:` only, at most 500 characters, no user name, password or port, no control characters. For `qq` the host must be `qm.qq.com` or `qun.qq.com`. |
| `links.<id>.zh` | no | The address for a Chinese interface, same rules as `url`. When it is missing, `url` is used for every language. |

Ids: `qq` (the QQ group row) and `docs` (the documentation row).

### Validation

Every link is checked on its own. A link that breaks a rule is dropped and the app keeps the address it
already has for that row (the built-in one, or the last good one from the file for up to 24 hours when
the network is down); the other links are used. A file that is not JSON, larger than 16 KB, or whose
`schema` or `links` have the wrong shape is ignored as a whole. The file can only replace an address
of a row the app already has: it cannot add rows, change texts or point a row at another scheme.

## Publishing a change

1. Edit the file (the QQ join link comes from the group's own "join link" page of QQ).
2. Upload the same file to both hosts.
3. Running apps pick the change up within about 30 minutes of their next check, after a restart, or at once
   after a manual refresh.

Developer mode (`foundation-ui.dev` = `1` in the local storage) may point to a local file with
`foundation-ui.community.source` (a plain `http:` address on this computer is accepted there).
