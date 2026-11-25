# Contributor avatars: source status

Status listing only. Nothing in `src/about/avatars/` was changed or removed.

- What: 134 image files in `src/about/avatars/` (80 png, 54 jpg): one 96 px file for each of the 130 people in `src/about/contributors.json`
  (3 of them bots, 4 team members) and a 256 px file for each of the 4 team members.
- Names: the GitHub numeric user id (`<id>.<ext>`, `<id>-256.<ext>`); the id, login and profile link of each person are in `contributors.json`.
- Origin: the avatar each person has on GitHub, downloaded by `scripts/build-about.mjs` from `avatars.githubusercontent.com/u/<id>` (sizes 96 and 256).
  The list of people comes from the contributors block of the README of Foundation Sunshine at commit `91d9d555980c2ec6d47abac8b877b01eb24fd6c5`
  (2026-11-02, recorded in `contributors.json`).
- What is recorded: the host commit of the list. Not recorded: the retrieval date of each file, a checksum of each file, and any statement of permission
  or licence from the people shown. GitHub's own terms do not make a user's avatar a freely licensed image.
- Where they are used: the About page's contributors and team sections (`src/about/avatars.js`, `friends.js`), cropped to a circle and never redrawn.
- Status: source known (GitHub avatar of the listed person), licence and consent not recorded. They are personal likenesses, which is a separate
  question from copyright.
- Decision pending: keep with a recorded basis (for example the contributors' consent or GitHub's terms), switch to generated placeholders, or load them
  from GitHub at run time instead of shipping the files.
