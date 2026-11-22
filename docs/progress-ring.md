# MProgressRing: the one ring of the kit

Every round data visual (帧时间占用, 温度, 串流时长, 帧率, 码率, 编码器, 内存, the Wi-Fi signal, the ring widgets, the home guide, the timer, the component status) is `MProgressRing`, a determinate Material 3 circular progress indicator. `MTileRing`, `MRing`, `MArcGauge` and `MGauge` are wrappers that keep their old props and only delegate to it; none of them draws an arc.

## Geometry (as Jetpack Compose Material3 draws it)

- Start at 12 o'clock, clockwise. The active indicator and the track are separate arcs with round caps. Nothing is drawn for the active part at 0.
- Flat ring: a box of 40, stroke 4, track gap 4 (`CircularProgressIndicatorTokens` `Size`, `ActiveThickness`, `TrackActiveSpace`). The gap is measured along the circumference of the whole box and the stroke is added to it because the caps are round: `gapSweep = (gap + stroke) / (π · size) · 360` = 22.9°.
- The track starts one gap after the active indicator and ends one gap before its start: `start = sweep + min(sweep, gapSweep)`, `length = 360 − sweep − 2 · min(sweep, gapSweep)`. Near 0 the gaps shrink with the sweep; the track is gone at 100 %.
- Wavy ring (Material 3 Expressive, optional `wavy`): a box of 48 (`WaveSize`), stroke 4, amplitude 1.6, wavelength 15 rounded to a whole wave count (8); flat below 10 % and from 95 % (`WavyProgressIndicatorDefaults.indicatorAmplitude`).
- The box scales with the element, so the stroke is a tenth of the diameter (a twelfth when wavy) at every size. Colours are theme roles: the active indicator `primary` (the tile's accent), the track `secondaryContainer`.
- Parts of a whole (内存) are `segments`: each is an active indicator, a gap apart, and the track fills the rest.
- The value text is the slot. It sits in the inner circle (`--mpr-inner`, the share of the radius inside the stroke); the ring is a size container so a numeral is set in `cqw`. `test/ringgeom.test.js` and the gate `ringfit` check that the text never reaches the stroke.
- The value moves over 420 ms (ease-out) and not at all under reduced motion.

## Sources

| What | Where | Version |
| --- | --- | --- |
| Progress indicators, circular, specs and Expressive | https://m3.material.io/components/progress-indicators/specs (a client-rendered page: its text could not be fetched without a browser, so the numbers below come from the token files generated from it) | page checked 2026-11-16 |
| `CircularProgressIndicator` (determinate), `drawCircularIndicator`, gap and cap rule | androidx `compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/ProgressIndicator.kt` | androidx-main, commit of 2026-11-04 |
| `CircularWavyProgressIndicator`, `WavyProgressIndicatorDefaults` (`CircularContainerSize` 48, `CircularWavelength`, `indicatorAmplitude`) | `.../material3/WavyProgressIndicator.kt` | same |
| Tokens: `ActiveThickness` 4, `Size` 40, `WaveSize` 48, `ActiveWaveAmplitude` 1.6, `ActiveWaveWavelength` 15, `TrackActiveSpace` 4, `TrackThickness` 4 | `.../material3/tokens/CircularProgressIndicatorTokens.kt` | same |
| `md-circular-progress`: start at -90°, a track and an active circle, 4800 box, dash offset | material-web `progress/internal/circular-progress.ts`, `_circular-progress.scss` | 2.5.0 |

## When a ring is the right form

A ring shows a share of a whole or a value against a cap it can reach: 帧时间占用 (the share of the frame the encoder takes), 内存 (parts of a whole), 温度 (against its scale), the Wi-Fi signal, the steps of the first-run guide, the session bitrate against its cap. A value that has no natural full is not a ring: an elapsed time (串流时长) is the time itself in large digits, and a frame rate (帧率) is its recent history as a curve behind the number with the target as a dashed line.
