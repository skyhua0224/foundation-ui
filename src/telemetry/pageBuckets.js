// The fixed bucket bounds of the page experience sketches (docs/telemetry-plan.zh.md, "Panel 与 Web UI"). A visit is reduced to one bucket index per metric, and the counts of the visits of one route add up bucket by bucket
// (the explicit-bucket histogram rule of the OpenTelemetry metrics data model: the same bounds, so the points can be summed). The Worker (src/pagevitals.ts) has the same table and a test with the same example values.
//
// Where the web.dev thresholds exist, they are bounds of the list so "good" and "poor" are read from the counts without guessing:
//   LCP   good <= 2500 ms, poor > 4000 ms      INP  good <= 200 ms, poor > 500 ms      CLS  good <= 0.1, poor > 0.25   (web.dev/articles/vitals, 2026-11-15)
// A bucket i holds the values v with bounds[i-1] < v <= bounds[i]; the last bucket holds everything above the last bound.

export const PAGE_BUCKETS = Object.freeze({
  lcp: Object.freeze([1000, 1500, 2000, 2500, 3000, 4000, 6000]),
  inp: Object.freeze([50, 100, 150, 200, 300, 400, 500]),
  cls: Object.freeze([0.01, 0.025, 0.05, 0.1, 0.15, 0.25, 0.5]),
  loaf: Object.freeze([50, 75, 100, 150, 200, 300, 500]),
  fpaint: Object.freeze([250, 500, 750, 1000, 1500, 2500, 4000]),
  tti: Object.freeze([250, 500, 1000, 1500, 2500, 4000, 8000]),
  heap: Object.freeze([32, 64, 128, 192, 256, 512, 1024]),
  /** the latency of a loopback API call, ms */
  api: Object.freeze([10, 25, 50, 100, 250, 500, 1000]),
})
export const BUCKET_COUNT = 8
export const PAGE_METRICS = Object.freeze(Object.keys(PAGE_BUCKETS).filter((k) => k !== 'api'))

/** The index of the bucket that holds `value` (0..7), or -1 when the value is not a finite non-negative number. */
export function bucketOf(metric, value) {
  const bounds = PAGE_BUCKETS[metric]
  if (!bounds || typeof value !== 'number' || !Number.isFinite(value) || value < 0) return -1
  for (let i = 0; i < bounds.length; i += 1) if (value <= bounds[i]) return i
  return bounds.length
}

export const emptyBuckets = () => new Array(BUCKET_COUNT).fill(0)

/** Frame intervals (ms) of a scroll or an animation: at most 17 (a 60 Hz frame), up to 34, up to 50, above 50. */
export const FRAME_CLASS_BOUNDS = Object.freeze([17, 34, 50])
export const frameClassOf = (ms) => (ms <= FRAME_CLASS_BOUNDS[0] ? 0 : ms <= FRAME_CLASS_BOUNDS[1] ? 1 : ms <= FRAME_CLASS_BOUNDS[2] ? 2 : 3)
