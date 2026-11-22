import { canonicalLocale } from '../locale/texts/resolve.js'
// The words of the context menu (src/contextmenu), in the words of the pages. Any language but Chinese reads English.
export const CONTEXT_TEXTS = Object.freeze({
  zh: {
    undo: '撤销', redo: '重做', cut: '剪切', copy: '复制', paste: '粘贴', pastePlain: '粘贴为纯文本', delete: '删除', selectAll: '全选',
    searchSelection: '搜索设置「{text}」', explain: '用米塔 AI 解释', open: '打开', openBrowser: '在浏览器中打开', copyLink: '复制链接地址',
    copyImage: '复制图片', copyImageUrl: '复制图片地址', saveImage: '另存为',
    back: '后退', forward: '前进', reload: '刷新', print: '打印', inspect: '检查元素', copyRoute: '复制当前路由', developer: '开发者', feedbackHere: '反馈此处的问题', devTools: '开发者工具', devToolsHint: '按 F12 打开浏览器的开发者工具', devReport: '在 Issue 中报告此处', page: '页面', backToMenu: '返回',
    search: '搜索', connect: '连接设备', doctor: '运行体检', appearance: '外观', light: '浅色', dark: '深色', system: '跟随系统',
    pet: '桌宠', restartHost: '重启 Sunshine', openWebUi: '打开 Web UI', restartConfirm: '重启 Sunshine？正在进行的串流会中断。',
    resize: '调整大小', sizeS: '方形', sizeM: '中', sizeL: '大', sizeXL: '特大', removeTile: '移除', removeTileConfirm: '移除这个磁贴？需要时可以在编辑概览里加回。', editOverview: '编辑概览',
    restoreDefault: '恢复默认', copySettingLink: '复制设置项链接', locateInSearch: '在搜索中定位', whatIsThis: '这是什么？',
    noHistory: '没有可后退的页面', pasteDenied: '请按 Ctrl+V 粘贴', copied: '已复制', ok: '好', cancel: '取消',
    pin: '固定到概览', unpin: '取消固定', addToStack: '加入轮换组', editStack: '编辑轮换组', switchTo: '切换到', smartRotate: '智能轮换', dissolveStack: '拆散轮换组', dissolveConfirm: '拆散这个轮换组？磁贴会回到概览。',
    copyDeviceId: '复制设备 ID', copyLine: '复制此行', copyAll: '复制整段', analyze: '用米塔 AI 分析', exportDiag: '导出诊断', petSettings: '桌宠设置',
  },
  en: {
    undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', pastePlain: 'Paste as plain text', delete: 'Delete', selectAll: 'Select all',
    searchSelection: 'Search settings for “{text}”', explain: 'Explain with Mita AI', open: 'Open', openBrowser: 'Open in browser', copyLink: 'Copy link address',
    copyImage: 'Copy image', copyImageUrl: 'Copy image address', saveImage: 'Save as',
    back: 'Back', forward: 'Forward', reload: 'Reload', print: 'Print', inspect: 'Inspect element', copyRoute: 'Copy current route', developer: 'Developer', feedbackHere: 'Report a problem here', devTools: 'Developer tools', devToolsHint: 'Press F12 for the browser developer tools', devReport: 'Report this in an issue', page: 'Page', backToMenu: 'Back',
    search: 'Search', connect: 'Connect a device', doctor: 'Run the health check', appearance: 'Appearance', light: 'Light', dark: 'Dark', system: 'Follow system',
    pet: 'Desktop pet', restartHost: 'Restart Sunshine', openWebUi: 'Open the Web UI', restartConfirm: 'Restart Sunshine? A running stream will stop.',
    resize: 'Resize', sizeS: 'Square', sizeM: 'Medium', sizeL: 'Large', sizeXL: 'Extra large', removeTile: 'Remove', removeTileConfirm: 'Remove this tile? You can add it back from Edit the overview.', editOverview: 'Edit the overview',
    restoreDefault: 'Restore the default', copySettingLink: 'Copy the link to this setting', locateInSearch: 'Find in search', whatIsThis: 'What is this?',
    noHistory: 'There is no page to go back to', pasteDenied: 'Press Ctrl+V to paste', copied: 'Copied', ok: 'OK', cancel: 'Cancel',
    pin: 'Pin to the overview', unpin: 'Unpin', addToStack: 'Add to a stack', editStack: 'Edit the stack', switchTo: 'Switch to', smartRotate: 'Smart rotation', dissolveStack: 'Break up the stack', dissolveConfirm: 'Break up this stack? Its tiles go back to the overview.',
    copyDeviceId: 'Copy the device ID', copyLine: 'Copy this line', copyAll: 'Copy the whole log', analyze: 'Analyze with Mita AI', exportDiag: 'Export diagnostics', petSettings: 'Desktop pet settings',
  },
})

const CTX = {
  zh_TW: { developer: '開發者', devTools: '開發者工具', devToolsHint: '按 F12 開啟瀏覽器的開發者工具', devReport: '在 Issue 中報告此處', pin: '固定到概覽', unpin: '取消固定', addToStack: '加入輪換組', editStack: '編輯輪換組', switchTo: '切換到', smartRotate: '智慧輪換', dissolveStack: '拆散輪換組', dissolveConfirm: '拆散這個輪換組？磁貼會回到概覽。' },
  de: { developer: 'Entwickler', devTools: 'Entwicklerwerkzeuge', devToolsHint: 'F12 für die Entwicklerwerkzeuge des Browsers', devReport: 'Hier in einem Issue melden', pin: 'An die Übersicht heften', unpin: 'Lösen', addToStack: 'Zum Stapel', editStack: 'Stapel bearbeiten', switchTo: 'Wechseln zu', smartRotate: 'Intelligentes Wechseln', dissolveStack: 'Stapel auflösen', dissolveConfirm: 'Diesen Stapel auflösen? Die Kacheln kehren zur Übersicht zurück.' },
  fr: { developer: 'Développeur', devTools: 'Outils de développement', devToolsHint: 'F12 pour les outils de développement du navigateur', devReport: 'Signaler ceci dans un issue', pin: "Épingler à l'aperçu", unpin: 'Détacher', addToStack: 'Ajouter à une pile', editStack: 'Modifier la pile', switchTo: 'Passer à', smartRotate: 'Rotation intelligente', dissolveStack: 'Dissoudre la pile', dissolveConfirm: 'Dissoudre cette pile ? Ses tuiles reviennent à l\'aperçu.' },
  es: { developer: 'Desarrollador', devTools: 'Herramientas de desarrollo', devToolsHint: 'F12 para las herramientas de desarrollo del navegador', devReport: 'Informar de esto en un issue', pin: 'Fijar al resumen', unpin: 'Quitar', addToStack: 'Añadir a una pila', editStack: 'Editar la pila', switchTo: 'Cambiar a', smartRotate: 'Rotación inteligente', dissolveStack: 'Deshacer la pila', dissolveConfirm: '¿Deshacer esta pila? Sus mosaicos vuelven al resumen.' },
  it: { developer: 'Sviluppatore', devTools: 'Strumenti di sviluppo', devToolsHint: 'F12 per gli strumenti di sviluppo del browser', devReport: 'Segnala questo in un issue', pin: 'Fissa alla panoramica', unpin: 'Stacca', addToStack: 'Aggiungi a una pila', editStack: 'Modifica la pila', switchTo: 'Passa a', smartRotate: 'Rotazione intelligente', dissolveStack: 'Sciogli la pila', dissolveConfirm: 'Sciogliere questa pila? Le tessere tornano alla panoramica.' },
  ja: { developer: '開発者', devTools: '開発者ツール', devToolsHint: 'ブラウザの開発者ツールは F12', devReport: 'ここを Issue で報告', pin: '概要に固定', unpin: '固定を解除', addToStack: 'スタックに追加', editStack: 'スタックを編集', switchTo: '切り替え', smartRotate: 'スマート切替', dissolveStack: 'スタックを解除', dissolveConfirm: 'このスタックを解除しますか？タイルは概要に戻ります。' },
  ko: { developer: '개발자', devTools: '개발자 도구', devToolsHint: '브라우저 개발자 도구는 F12', devReport: '여기를 Issue로 보고', pin: '개요에 고정', unpin: '고정 해제', addToStack: '스택에 추가', editStack: '스택 편집', switchTo: '전환', smartRotate: '스마트 회전', dissolveStack: '스택 해제', dissolveConfirm: '이 스택을 해제할까요? 타일은 개요로 돌아갑니다.' },
  ru: { developer: 'Разработчик', devTools: 'Инструменты разработчика', devToolsHint: 'F12 — инструменты браузера', devReport: 'Сообщить об этом в issue', pin: 'Закрепить в обзоре', unpin: 'Открепить', addToStack: 'В стопку', editStack: 'Изменить стопку', switchTo: 'Перейти к', smartRotate: 'Умное чередование', dissolveStack: 'Разобрать стопку', dissolveConfirm: 'Разобрать эту стопку? Плитки вернутся в обзор.' },
  pt_BR: { developer: 'Desenvolvedor', devTools: 'Ferramentas de desenvolvimento', devToolsHint: 'F12 para as ferramentas do navegador', devReport: 'Relatar isto em um issue', pin: 'Fixar na visão geral', unpin: 'Desafixar', addToStack: 'Adicionar a uma pilha', editStack: 'Editar a pilha', switchTo: 'Mudar para', smartRotate: 'Rotação inteligente', dissolveStack: 'Desfazer a pilha', dissolveConfirm: 'Desfazer esta pilha? Os blocos voltam para a visão geral.' },
  pt: { developer: 'Programador', devTools: 'Ferramentas de programador', devToolsHint: 'F12 para as ferramentas do navegador', devReport: 'Comunicar isto num issue', pin: 'Fixar no resumo', unpin: 'Soltar', addToStack: 'Adicionar a uma pilha', editStack: 'Editar a pilha', switchTo: 'Mudar para', smartRotate: 'Rotação inteligente', dissolveStack: 'Desfazer a pilha', dissolveConfirm: 'Desfazer esta pilha? Os mosaicos voltam ao resumo.' },
  bg: { developer: 'Разработчик', devTools: 'Инструменти за разработчик', devToolsHint: 'F12 отваря инструментите на браузъра', devReport: 'Съобщете това в issue', pin: 'Закачи към прегледа', unpin: 'Откачи', addToStack: 'Добави към купчина', editStack: 'Редактирай купчината', switchTo: 'Премини към', smartRotate: 'Интелигентно завъртане', dissolveStack: 'Развали купчината', dissolveConfirm: 'Да се развали ли тази купчина? Плочките се връщат в прегледа.' },
  cs: { developer: 'Vývojář', devTools: 'Nástroje vývojáře', devToolsHint: 'F12 otevře nástroje prohlížeče', devReport: 'Nahlásit to v issue', pin: 'Připnout k přehledu', unpin: 'Odepnout', addToStack: 'Přidat do sady', editStack: 'Upravit sadu', switchTo: 'Přepnout na', smartRotate: 'Chytré otáčení', dissolveStack: 'Rozpustit sadu', dissolveConfirm: 'Rozpustit tuto sadu? Dlaždice se vrátí do přehledu.' },
  pl: { developer: 'Programista', devTools: 'Narzędzia programisty', devToolsHint: 'F12 otwiera narzędzia przeglądarki', devReport: 'Zgłoś to w issue', pin: 'Przypnij do przeglądu', unpin: 'Odepnij', addToStack: 'Dodaj do stosu', editStack: 'Edytuj stos', switchTo: 'Przełącz na', smartRotate: 'Inteligentny obrót', dissolveStack: 'Rozwiąż stos', dissolveConfirm: 'Rozwiązać ten stos? Kafelki wrócą do przeglądu.' },
  sv: { developer: 'Utvecklare', devTools: 'Utvecklarverktyg', devToolsHint: 'F12 för webbläsarens utvecklarverktyg', devReport: 'Rapportera det här i ett issue', pin: 'Fäst i översikten', unpin: 'Lossa', addToStack: 'Lägg till i en hög', editStack: 'Redigera högen', switchTo: 'Byt till', smartRotate: 'Smart växling', dissolveStack: 'Lös upp högen', dissolveConfirm: 'Lösa upp den här högen? Rutorna går tillbaka till översikten.' },
  tr: { developer: 'Geliştirici', devTools: 'Geliştirici araçları', devToolsHint: 'Tarayıcı araçları için F12', devReport: 'Bunu bir issue içinde bildir', pin: 'Genel bakışa sabitle', unpin: 'Sabitlemeyi kaldır', addToStack: 'Yığına ekle', editStack: 'Yığını düzenle', switchTo: 'Geç', smartRotate: 'Akıllı dönüş', dissolveStack: 'Yığını dağıt', dissolveConfirm: 'Bu yığın dağıtılsın mı? Karolar genel bakışa döner.' },
  uk: { developer: 'Розробник', devTools: 'Інструменти розробника', devToolsHint: 'F12 — інструменти браузера', devReport: 'Повідомити про це в issue', pin: 'Закріпити в огляді', unpin: 'Відкріпити', addToStack: 'Додати до стосу', editStack: 'Змінити стос', switchTo: 'Перейти до', smartRotate: 'Розумне обертання', dissolveStack: 'Розпустити стос', dissolveConfirm: 'Розпустити цей стос? Плитки повернуться в огляд.' },
}
export const contextTexts = (locale = 'en') => {
  const code = canonicalLocale(locale)
  if (code === 'zh') return CONTEXT_TEXTS.zh
  if (code === 'en' || code === 'en_GB' || code === 'en_US') return CONTEXT_TEXTS.en
  const base = code === 'zh_TW' ? CONTEXT_TEXTS.zh : CONTEXT_TEXTS.en
  const extra = CTX[code]
  return extra ? { ...base, ...extra } : base
}

