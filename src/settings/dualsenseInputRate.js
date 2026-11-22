// The confirm before the DualSense input report rate goes above 250 Hz (key ds5.compat.inputReportRate): one text for the host's web
// page (and so the Panel, which shows that page) and any other surface, so none writes its own. The figures are measured, not promised:
// FIGURES says how.

import { localizedOptionLabel } from './dualsenseLabels.js'

export const INPUT_RATE_KEY = 'ds5.compat.inputReportRate'
export const INPUT_RATE_WARNING_SECONDS = 5

// the option that is the 250 Hz rhythm; anything else answers faster than that
const SAFE_OPTION = 'hz250'

/** Whether moving a controller's input report rate from @p from to @p to needs the confirm: only going from 250 Hz to something faster. */
export function inputRateNeedsConfirm(key, from, to) {
  return key === INPUT_RATE_KEY && String(from) === SAFE_OPTION && String(to) !== SAFE_OPTION
}

/**
 * What was measured (2026-11-19, a Windows 11 virtual machine, the host's USB/IP channel, one controller, a stick that changes every 2 ms; 12 s per option):
 * latencyMs is the mean time from the host receiving a stick change to the game's read returning it; lostPercent is the share of the host's reports
 * the system dropped while the game paused reading for 160 ms out of every 200 ms; fourPadsGainMs is the latency gain over 250 Hz with four controllers
 * active; tapsRead counts the 30 ms button taps (across pauses of 0, 80, 120 and 160 ms) the game read, out of as many injected.
 */
export const INPUT_RATE_FIGURES = Object.freeze({
  hz250: Object.freeze({ latencyMs: 2.2, lostPercent: 7.5 }),
  hz500: Object.freeze({ latencyMs: 1.5, lostPercent: 25, tapsRead: 344 }),
  auto: Object.freeze({ latencyMs: 0.1, lostPercent: 26, tapsRead: 344 }),
  fourPadsGainMs: 0.5,
  stallMs: 160,
})

const number = (value) => String(Number(value.toFixed(1)))

/** The dialog text for @p option (the option being chosen): a title, the lines and the buttons ({seconds} while the countdown runs). */
export function inputRateWarning(locale, option = 'auto', figures = INPUT_RATE_FIGURES) {
  const zh = String(locale || '').startsWith('zh')
  const chosen = figures[option] || figures.auto
  const safe = figures.hz250
  const name = localizedOptionLabel(option, locale)
  const gain = number(safe.latencyMs - chosen.latencyMs)
  const four = number(figures.fourPadsGainMs)
  const lost = number(chosen.lostPercent)
  const lostSafe = number(safe.lostPercent)
  if (zh) {
    return {
      title: '提高手柄输入回报频率',
      lines: [
        `改成「${name}」后，摇杆变化平均早 ${gain} ms 到达游戏（250 Hz 时平均 ${number(safe.latencyMs)} ms）。同时用 4 个手柄只早约 ${four} ms。`,
        `代价：游戏卡顿（每 200 ms 停读 ${figures.stallMs} ms）时，会丢掉 ${lost}% 的摇杆中间报告（250 Hz 丢 ${lostSafe}%）。按键点按不丢（${chosen.tapsRead} 次点按全部读到），游戏恢复后读到的是最新状态。`,
        `测法：Windows 11 虚拟机内走 USB/IP 通道，1 个手柄，摇杆每 2 ms 变化一次，摇杆每档测 12 秒；按键点按为 30 ms 一次，每档 344 次。`,
      ],
      cancel: '取消',
      confirm: '继续',
      wait: '继续（{seconds}）',
    }
  }
  return {
    title: 'Raise the controller input report rate',
    lines: [
      `With “${name}” a stick change reaches the game ${gain} ms sooner on average (${number(safe.latencyMs)} ms at 250 Hz). With 4 controllers in use it is about ${four} ms sooner.`,
      `Cost: when the game stalls (it stops reading for ${figures.stallMs} ms out of every 200 ms), ${lost}% of the in-between stick reports are dropped (${lostSafe}% at 250 Hz). Button taps are not dropped (all ${chosen.tapsRead} taps were read), and the game reads the latest state when it resumes.`,
      `Measured in a Windows 11 virtual machine over the USB/IP channel, 1 controller, a stick changing every 2 ms for 12 seconds per option; button taps of 30 ms, 344 per option.`,
    ],
    cancel: 'Cancel',
    confirm: 'Continue',
    wait: 'Continue ({seconds})',
  }
}
