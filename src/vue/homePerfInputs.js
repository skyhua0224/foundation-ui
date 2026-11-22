// What the overview tiles read from one perf session (/api/perf/current), the same function for the control panel and the Web UI so a tile never exists in one and not in the other
// for want of a field: the stages of the host pipeline as flat fields, and what the host reports beyond them (the frame rates per stage, the capture method). Absent fields stay out.

// The overview (the 帧时间占用 tile's frame-budget split) reads the stages as flat fields of the session it is given; each is the average of the stage in
// milliseconds, absent while the host has no samples for it (a host that does not report the stage leaves the field out).
export const PIPELINE_FIELDS = Object.freeze({
  capture_to_convert: 'pipeCaptureToConvertMs',
  convert: 'pipeConvertMs',
  encode_queue: 'pipeEncodeQueueMs',
  encode: 'pipeEncodeMs',
  packet_to_broadcast: 'pipePacketToBroadcastMs',
  total: 'pipeTotalMs',
})

/** The fields above for one perf session (/api/perf/current): `{ pipeConvertMs: 0.8, ... }`, only the stages that have samples and a finite average. */
export function pipelineAverages(session) {
  const out = {}
  for (const [key, field] of Object.entries(PIPELINE_FIELDS)) {
    const stats = session?.pipeline?.[key]
    const avg = stats?.samples > 0 ? Number(stats.avg_ms) : NaN
    if (Number.isFinite(avg) && avg >= 0) out[field] = avg
  }
  return out
}

/** What the overview tiles read beyond the pipeline stages, from one perf session: the frame rates per stage (as the host sent them) and the capture method. */
export function perfExtras(session) {
  const out = {}
  if (!session) return out
  if (session.frame_rates != null) out.frameRates = session.frame_rates
  if (typeof session.capture === 'string') out.perfCapture = session.capture
  return out
}
