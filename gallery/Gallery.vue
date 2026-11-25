<script setup>
import { ref } from 'vue'
import { MNav, MPage, MSection, MGroup, MItem, MSwitchItem, MSliderItem, MSeg, MChip, MNotice, MButton, MDialog, MEmpty, MSkeleton, MLoading, MIcon } from '../src/vue/index.js'

const current = ref('gamepad')
const nav = [
  { id: 'overview', label: '概览', icon: 'home' },
  { id: 'stream', label: '串流', icon: 'cast_connected' },
  { id: 'gamepad', label: '输入与外设', icon: 'sports_esports', dot: 'ok' },
  { id: 'display', label: '显示', icon: 'desktop_windows' },
  { id: 'system', label: '系统', icon: 'build' },
]
const footer = [{ id: 'panel', label: '面板设置', icon: 'settings' }, { id: 'help', label: '帮助与关于', icon: 'help' }]
const type = ref('ds5')
const rumble = ref(true)
const gain = ref(1)
const strength = ref(0.8)
const lightMode = ref('follow')
const dialog = ref(false)
const q = new URLSearchParams(location.search)
if (q.get('dialog')) setTimeout(() => (dialog.value = true), 50)
</script>

<template>
  <div class="m-app m-app--shell m-app--scroll">
    <MNav brand-name="Foundation UI" :items="nav" :footer="footer" :current="current" @navigate="(i) => (current = i.id)" />
    <main class="m-app__main">
      <MPage title="手柄" lead="选择串流时游戏识别的手柄，并调校 DualSense。" eyebrow="输入与外设" back back-label="返回" @back="() => {}">
        <template #status>
          <MChip tone="ok" icon="check_circle">DualSense 已就绪</MChip>
          <MChip icon="sports_esports">当前没有手柄在使用</MChip>
        </template>
        <MSection title="串流时的手柄类型">
          <MGroup>
            <MItem action :selected="type === 'auto'" icon="wand_stars" title="自动（推荐）" text="不确定时选这个，优先采用兼容性最好的输出。" @click="type = 'auto'" />
            <MItem action :selected="type === 'x360'" icon="sports_esports" title="Xbox 360" text="兼容大多数 Windows 游戏，适合优先考虑兼容性的场景。" @click="type = 'x360'" />
            <MItem action :selected="type === 'ds4'" icon="sports_esports" title="DualShock 4" text="适合需要 PlayStation 按键布局、触控板或体感的游戏。" @click="type = 'ds4'" />
            <MItem action :selected="type === 'ds5'" icon="sports_esports" title="DualSense（DS5 / PS5 手柄）" text="支持触控板、体感与自适应扳机；由 Sunshine 内置的原生通道提供。" @click="type = 'ds5'" />
          </MGroup>
          <MGroup><MItem action chevron icon="tune" title="每个游戏的单独设置" text="为个别串流应用指定不同的手柄类型" /></MGroup>
        </MSection>
        <MSection title="触觉与震动">
          <MGroup>
            <MSliderItem v-model="gain" icon="graphic_eq" title="触觉增益" :min="0" :max="2" />
            <MSwitchItem v-model="rumble" icon="mobile_vibrate" title="启用震动" text="游戏发出的震动会传到手柄" />
            <MSliderItem v-model="strength" icon="bolt" title="震动强度" :min="0" :max="2" />
          </MGroup>
        </MSection>
        <MSection title="灯光">
          <MGroup>
            <MItem icon="lightbulb" title="灯条模式" stack>
              <template #control><MSeg v-model="lightMode" block label="灯条模式" :options="[{ value: 'follow', label: '跟随游戏' }, { value: 'fixed', label: '固定' }, { value: 'off', label: '关闭' }]" /></template>
            </MItem>
          </MGroup>
        </MSection>
        <MSection title="状态与反馈">
          <MNotice tone="warn" title="需要重新连接">改动会在手柄下次连接时生效。</MNotice>
          <MGroup spaced>
            <MItem icon="memory" tone="success" title="USB/IP 传输" text="0.9.8.1，可用"><template #trail><MChip tone="ok" icon="check_circle">已就绪</MChip></template></MItem>
            <MItem icon="key" tone="error" title="驱动签名" text="读取失败"><template #trail><MChip tone="error" icon="error">错误</MChip></template></MItem>
          </MGroup>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <MButton>主要操作</MButton><MButton variant="tonal" icon="refresh">刷新</MButton><MButton variant="outlined">次要</MButton><MButton variant="text">文字</MButton><MButton variant="danger">删除</MButton><MButton disabled>不可用</MButton><MButton loading>加载</MButton>
            <MButton variant="tonal" @click="dialog = true">打开警告对话框</MButton>
          </div>
          <MSkeleton :rows="2" />
          <div class="m-loading-host"><MLoading label="加载中" /></div>
          <MEmpty icon="usb" title="没有挂载的设备" text="在客户端选择要共享的 USB 设备后，会显示在这里。"><MButton variant="tonal">查看说明</MButton></MEmpty>
        </MSection>
      </MPage>
    </main>
    <MDialog v-model="dialog" title="修改高级选项之前" icon="warning">
      <p>这些选项决定虚拟手柄如何与 Windows 和游戏通信。填错数值可能引发难以追溯到这里的问题：</p>
      <ul><li>游戏可能认不出手柄。</li><li>手柄可能在游戏中消失或需要重新接入。</li></ul>
      <template #actions><MButton variant="text" @click="dialog = false">取消</MButton><MButton variant="warning" disabled>显示高级选项（5）</MButton></template>
    </MDialog>
  </div>
</template>
