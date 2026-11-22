// Foundation UI: Material 3 Expressive components. Material Web (Apache-2.0) supplies only what has no Expressive
// replacement here yet: text fields, select, checkbox, radio and the menu.
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/select/outlined-select.js'
import '@material/web/select/select-option.js'
import '@material/web/checkbox/checkbox.js'
import '@material/web/radio/radio.js'
import '@material/web/menu/menu.js'
import '@material/web/menu/menu-item.js'
import '@material/web/menu/sub-menu.js'
import '@material/web/divider/divider.js'

export { default as MIcon } from './MIcon.vue'
export { default as MNav } from './MNav.vue'
export { default as MButton } from './MButton.vue'
export { default as MIconButton } from './MIconButton.vue'
export { default as MLoading } from './MLoading.vue'
export { default as MChip } from './MChip.vue'
export { default as MChipRow } from './MChipRow.vue'
export { default as MPage } from './MPage.vue'
export { default as MUpdatedStamp } from './MUpdatedStamp.vue'
export { providePageStamp, usePageStamp } from './usePageStamp.js'
export { default as MSection } from './MSection.vue'
export { default as MGroup } from './MGroup.vue'
export { default as MItem } from './MItem.vue'
export { default as MSourceList } from './MSourceList.vue'
export { default as MSwitch } from './MSwitch.vue'
export { default as MSwitchItem } from './MSwitchItem.vue'
export { default as MSlider } from './MSlider.vue'
export { default as MSliderItem } from './MSliderItem.vue'
export { default as MSeg } from './MSeg.vue'
export { default as MSplitButton } from './MSplitButton.vue'
export { default as MFabMenu } from './MFabMenu.vue'
export { default as MSceneFab } from './MSceneFab.vue'
export { default as MClientTag } from './MClientTag.vue'
export { startAutoReport, currentFingerprint } from './useAutoReport.js'
export { default as MToolbar } from './MToolbar.vue'
export { default as MEditToolbar } from './MEditToolbar.vue'
export { default as MProgress } from './MProgress.vue'
export { default as MBanner } from './MBanner.vue'
export { default as MSheet } from './MSheet.vue'
export { default as MBadge } from './MBadge.vue'
export { default as MSnackbar } from './MSnackbar.vue'
export { default as MCoverGrid } from './MCoverGrid.vue'
export { default as MCarousel } from './MCarousel.vue'
export { default as MTable } from './MTable.vue'
export { default as MActions } from './MActions.vue'
export { default as MRail } from './MRail.vue'
export { default as MContextMenu } from './MContextMenu.vue'
export { default as MScene } from './MScene.vue'
export { default as MNavList } from './MNavList.vue'
export { default as MTile } from './MTile.vue'
export { default as MTileGrid } from './MTileGrid.vue'
export { default as MPromo } from './MPromo.vue'
export { default as MNotice } from './MNotice.vue'
export { default as MEmpty } from './MEmpty.vue'
export { default as MSkeleton } from './MSkeleton.vue'
export { default as MPageLoading } from './MPageLoading.vue'
export { default as MDashSkeleton } from './MDashSkeleton.vue'
export { default as MMarkdown } from './MMarkdown.vue'
export { default as MErrorHost } from './MErrorHost.vue'
export { installErrorHandlers, reportError, reportFeedback, reportHostStop, reportHostHung, dismissHostHung, onError, setErrorContext, useErrors, dismissError } from './useErrors.js'
export { errorTexts } from './errorTexts.js'
export { useTelemetryConsent, CONSENT_EVENT, ERRORS_EVENT, ERRORS_REQUEST_EVENT } from './useTelemetryConsent.js'
export { default as MDialog } from './MDialog.vue'
export { default as MField } from './MField.vue'
export { default as MHero } from './MHero.vue'
export { default as MFieldItem } from './MFieldItem.vue'
export { default as MValueItem } from './MValueItem.vue'
export { default as MValueDialog } from './MValueDialog.vue'
export { default as MStat } from './MStat.vue'
export { default as MSparkline } from './MSparkline.vue'
export { default as MGauge } from './MGauge.vue'
export { default as MInfo } from './MInfo.vue'
export { default as MFab } from './MFab.vue'
export { default as MSwatches } from './MSwatches.vue'
export { default as MChoiceItem } from './MChoiceItem.vue'
export { default as MFooter } from './MFooter.vue'
export { default as MOverflow } from './MOverflow.vue'
export { default as MMenuChip } from './MMenuChip.vue'
export { default as MBrand } from './MBrand.vue'
export { default as MStartupProblems } from './MStartupProblems.vue'
export { default as MHostOffline } from './MHostOffline.vue'
export { useHostConnection } from './useHostConnection.js'
export { playPageEnter, PAGE_ENTER } from '../nav/pageEnter.js'
export { offlineTexts } from '../status/offlineTexts.js'
export { connection as hostConnection, initialConnection as initialHostConnection } from '../status/hostConnection.js'
export { micIsReady, padIsReady } from './deviceTiles.js'
export { default as MMasterSwitch } from './MMasterSwitch.vue'
export { default as MSplitItem } from './MSplitItem.vue'
export { default as MStatusPill } from './MStatusPill.vue'
export { default as MTrayMenu } from './MTrayMenu.vue'
export { default as MTrayRow } from './MTrayRow.vue'
export { default as MTraySliders } from './MTraySliders.vue'
export { default as MTrayPopup } from './MTrayPopup.vue'
export { default as MTraySettings } from './MTraySettings.vue'
export { default as MTrayLayoutEditor } from './MTrayLayoutEditor.vue'
export { default as MTrayThumb } from './MTrayThumb.vue'
export { default as MProgressRing } from './MProgressRing.vue'
export { default as MRing } from './MRing.vue'
export { default as MBar } from './MBar.vue'
export { default as MCheckItem } from './MCheckItem.vue'
export { default as MPinPad } from './MPinPad.vue'
export { default as MWelcome } from './MWelcome.vue'
export { PIN_ROWS, pinAppend, pinBackspace, pinComplete, pinDots, pinKeyAction } from './pinpad.js'
export { default as MDashCard } from './MDashCard.vue'
export { default as MDashCurve } from './MDashCurve.vue'
export { default as MDashHero } from './MDashHero.vue'
export { default as MDashStrip } from './MDashStrip.vue'
export { default as MDashSwitch } from './MDashSwitch.vue'
export { default as MDashInfo } from './MDashInfo.vue'
export { default as MDashTable } from './MDashTable.vue'
export { default as MDashApps } from './MDashApps.vue'
export { default as MChart } from './MChart.vue'
export { default as MTimerRing } from './MTimerRing.vue'
export { default as MClockDial } from './MClockDial.vue'
export { default as MRoll } from './MRoll.vue'
export { default as MHomeDash } from './MHomeDash.vue'
export { useDashLayout } from './useDashLayout.js'
export { createPairQr } from './usePairQr.js'
export { curvePaths, niceMax, scalePoints, smoothPath } from './curve.js'
export { useSubpage } from './useSubpage.js'
export { useTiles, TILE_SIZES } from './useTiles.js'
export { createNav } from '../nav/backstack.js'
export { createJumpHistory, backVariant, useBackVariant, showsButton, showsChip, BACK_VARIANTS, BACK_KEY } from '../nav/jumpHistory.js'
export { captionTexts } from '../nav/captionTexts.js'
export { useCaptionRoom, SEARCH_MIN, roomFor, isTight } from './useCaptionRoom.js'
export { default as MCaptionVersion } from './MCaptionVersion.vue'
export { default as MCaptionBack } from './MCaptionBack.vue'
export { default as MBackChip } from './MBackChip.vue'
export { BREAKPOINTS, RAIL_WIDTH, SHORT_HEIGHT, barSideOf, isCompactNav, navigationOf, railWidthOf, calculateScene, listDetailStrategy, supportingPaneStrategy, singlePaneStrategy, listWidth, layoutOf } from '../nav/scenes.js'

/** Consumers must compile `md-*` tags as custom elements: compilerOptions.isCustomElement = (tag) => tag.startsWith('md-'). */
export const isMaterialWebElement = (tag) => tag.startsWith('md-')
export { codecChips, buildStartSteps, guidePlatforms, guideRecommended, BUILTIN_APPS, buildHomeModel, parseSessionLog, parseErrorLog, recentErrorCount, formatDuration, homeTexts, DEFAULT_TEXTS as HOME_TEXTS } from "./homeModel.js"
export { default as MSupportSheet } from "./MSupportSheet.vue"
export { default as MAnnouncementStrip } from "./MAnnouncementStrip.vue"
export { default as MAnnouncementSheet } from "./MAnnouncementSheet.vue"
export { useAnnouncements, useAnnouncementBadge } from "./useAnnouncements.js"
export { useCommunityLinks } from "./useCommunityLinks.js"
export { default as MHomeGuide } from "./MHomeGuide.vue"
export { useGuideCard } from "./useGuideCard.js"
export { default as MGuideFlow } from './MGuideFlow.vue'
export { GUIDE_STEP_IDS, GUIDE_CLIENTS, GUIDE_DEVICES, CONNECT_CHECKS, PIN_LENGTH as GUIDE_PIN_LENGTH, buildGuideSteps, readProgress, writeProgress, clearProgress, startIndex, shouldAutoOpen, isSetupCompleted, validateAccount, clientFor, deviceOf, pickLanAddresses, lanRank, isLoopbackHost, canPair, normalizeClients, findNewClient, normalizeSessions, pickSession, sessionLine, qrPath, scallopPoints } from './guideModel.js'
export { guideEntry, upgradeSkips, addressKind } from './guideEntry.js'
export { hostProgressOf, hostPatchOf, saveGuideHost, createHostSaver, deviceId as guideDeviceId, resumeIndex, unionDone as unionGuideDone, isPhoneLike } from './guideHost.js'
export { checkPortsViaDoctor, PORT_CHECK_IDS } from './guidePortCheck.js'
export { guideTexts, fillText } from './guideTexts.js'
export { LOCALE_SYSTEM, LOCALE_KEY, normalizeTag, resolveSystemLocale, readLocalePref, writeLocalePref, resolveLocale, choiceOf, watchSystemLanguage } from '../locale/localePref.js'
export { default as MUpdateSheet } from './MUpdateSheet.vue'
export { UPDATE_PHASES, detectDriverNotes, downloadView, formatBytes, parseReleaseNotes, previewNotes, sheetFromGithubRelease, sheetFromPanelInfo, updateTexts } from '../update/index.js'
export { default as MLightbar } from "./MLightbar.vue"
export { default as MScallop } from "./MScallop.vue"
export { default as MDashVdd } from "./MDashVdd.vue"
export { default as MDashGuide } from "./MDashGuide.vue"
export { default as MDashDownload } from "./MDashDownload.vue"
export { default as MDashSponsor } from "./MDashSponsor.vue"
export { default as MDashCardView } from "./MDashCardView.vue"
export { default as MDashCatalogue } from "./MDashCatalogue.vue"
export { guideCardData, downloadCardData, starPromptTexts, sponsorCardData, GUIDE_TARGET, buildCards, packDash, rowTemplate, CARD_META, DEFAULT_ORDER, GROUPS } from "./homeCards.js"
export { useSettingsList, recentKeys, rememberRecent, scopeRecent, hostRecentKey } from "./useSettingsList.js"
export { default as MAppearance } from "./MAppearance.vue"
export { useAppearance, registerModeHandler } from "./useAppearance.js"
export { appearanceTexts } from "./appearanceTexts.js"
export { default as MSponsorButton } from "./MSponsorButton.vue"
export { default as MChartX } from "./MChartX.vue"
export { default as MEventStrip } from "./MEventStrip.vue"
export { default as MHeatStrip } from "./MHeatStrip.vue"
export { monotonePath, histogram, domainOf } from "../charts/chartMath.js"
export { default as MAbout } from "./MAbout.vue"
export { MASCOT } from "../about/mascot.js"
export { aboutTexts } from "../about/texts.js"
export { default as MPickSheet } from './MPickSheet.vue'
export { default as MChoiceCards } from './MChoiceCards.vue'
export { default as MChipSet } from './MChipSet.vue'
export { default as MExpertItem } from './MExpertItem.vue'
export { default as MListEditor } from './MListEditor.vue'
export { default as MPathItem } from './MPathItem.vue'
export { default as MControllerArt } from './MControllerArt.vue'
export { default as MDsPlot } from './MDsPlot.vue'
export { default as MComponentStatus } from "./MComponentStatus.vue"
export { default as MServiceStatus } from "./MServiceStatus.vue"
export { default as MDashComponent } from "./MDashComponent.vue"
export { COMPONENT_IDS, FEED_IDS, COMPONENT_ICONS, EXTENSION_COMPONENTS, fromEnhancement, componentRow, healthResult, statusTexts, microphoneState, createComponentStatus, registerComponentStatus, registeredComponentStatus } from "../status/index.js"
export { default as MLogViewer } from "./MLogViewer.vue"
export { default as MErrorCentre } from "./MErrorCentre.vue"
export { default as MDiagExport } from "./MDiagExport.vue"
export { default as MDiagnostics } from "./MDiagnostics.vue"
export { default as MResetSettings } from "./MResetSettings.vue"
export { default as MResetConfirm } from "./MResetConfirm.vue"
export { default as MResetEntry } from "./MResetEntry.vue"
export { useCountdown } from "./useCountdown.js"
export { RESET_KEYWORDS, RESET_SECONDS, backupTime, countdownLabel, createCountdown, createResetClient, failureText, latestBackup, resetTexts } from "../reset/index.js"
export { default as MFeedbackRow } from "./MFeedbackRow.vue"
export { default as MFeedbackCard } from "./feedback/MFeedbackCard.vue"
export { default as MFeedbackButton } from "./feedback/MFeedbackButton.vue"
export { default as MFeedbackDecision } from "./feedback/MFeedbackDecision.vue"
export { default as MFeedbackPanel } from "./feedback/MFeedbackPanel.vue"
export { default as MFeedbackReplySheet } from "./feedback/MFeedbackReplySheet.vue"
export { useFeedbackReplies, replySheet } from "./feedback/useFeedbackReplies.js"
export { default as MDoctor } from "./MDoctor.vue"
export { default as MDriverGuardNotice } from './MDriverGuardNotice.vue'
export { DOCTOR_GROUPS, LOCAL_GROUPS as DOCTOR_LOCAL_GROUPS, FIX_LEVEL as DOCTOR_FIX_LEVEL, hostSource as doctorHostSource, STATUS_LOOK as DOCTOR_STATUS_LOOK, createDoctor, doctorSnapshot, doctorText, doctorTexts, normalizeReport as normalizeDoctorReport, sortItems as sortDoctorItems, MOCK_DOCTOR, MOCK_DOCTOR_LOCAL, MOCK_DOCTOR_LOCAL_DOWN, mockDoctorRequest, mockLocalSource } from "../doctor/index.js"
export { diagnosticsTexts, startupProblems, parseLog, findSessions, buildErrorCentre, problemSummary, issueUrl, redactAll, redactSecrets, redactConfig, maskNetwork, prepareBundle, finalizeBundle, zipStore, zipList, decodeLogBytes, decodeLogLine, createLogByteDecoder, parseRecords, parseHostText, parsePanelLogs, recordsToRows, recordsToText, formatRecord, createRecord, severityOf, levelOf, recordOf, isRecord, isErrorRecord, attributeOf, setAttribute, SEVERITY_NUMBER, SEVERITY_TEXT, DOMAINS, FIELD_CLASS, classifyKey, redactRecord, redactRecords, registerAdapter, adapterById, listAdapters, HOST_TEXT_ADAPTER_ID, PANEL_ADAPTER_ID } from "../diagnostics/index.js"
export { default as MRoute } from './MRoute.vue'
export { default as MInlineBar } from "./MInlineBar.vue"
export { default as MArcGauge } from "./MArcGauge.vue"
export { default as MVirtualDisplay } from './MVirtualDisplay.vue'
export { createVddStore, createHttpVddAdapter } from './useVddStore.js'
export { vddTexts, VDD_TEXTS } from '../settings/vddTexts.js'
export { VDD_MODES, VDD_PROTECTED, VDD_KEYS, vddModeOf, vddPatchForMode, vddSummary, vddStatusOf } from '../settings/virtualDisplay.js'
export { default as MDashWidget } from "./MDashWidget.vue"
export { buildCatalogue, buildCatalogueDetails, CATALOGUE_IDS, LINKS } from "./homeCatalogue.js"
export { PIPELINE_FIELDS, pipelineAverages, perfExtras } from "./homePerfInputs.js"
export { saveSettingKey } from "../settings/save.js"
export { createHistory, pushSample, heatDays, errorsByHour, logDays, recentApps } from "./homeHistory.js"
export { sessionSummary, rowText, selectionText } from "../diagnostics/logs.js"
export { default as MFpsPresets } from './MFpsPresets.vue'
export { default as MModeList } from './MModeList.vue'
export { default as MModeListDialog } from './MModeListDialog.vue'
export { default as MModeListRow } from './MModeListRow.vue'
export { modeListTexts, MODE_LIST_TEXTS } from '../settings/modeListTexts.js'
export * as modeList from '../settings/modeList.js'
export { default as MStatusPills } from './MStatusPills.vue'
export { default as MMascot } from "./MMascot.vue"
export { VIVI, viviImage, viviClip } from "../about/mascot.js"
export { WALLPAPERS, autoPick, wallpaperBox, freeGaps } from "../appearance/wallpaper.js"
export { relayoutWallpaper } from "../appearance/apply.js"
export { default as MUnifiedSearch } from "./MUnifiedSearch.vue"
export { default as MSearchResults } from "./MSearchResults.vue"
export { useUnifiedSearch } from "./useUnifiedSearch.js"
export { buildIndex, search as unifiedSearch, highlight as highlightMatch, TYPES as SEARCH_TYPES } from "../search/index.js"
export { searchTexts, actionDocs, ACTION_DEFS } from "../search/texts.js"
export { jumpToRow, HIT_CLASS } from "../search/jump.js"
export { settingDocs, pageDocs, clientDocs, appDocs, tileDocs } from "../search/docs.js"
export { addTileToHome, HOME_LAYOUT_EVENT } from "../search/home.js"
export { usePageFilter } from "./usePageFilter.js"
export { requestPageFilter, takePageFilter, filterHash, readFilterHash, PAGE_FILTER_EVENT } from "../search/pageFilter.js"
export { default as MOnboardWindow } from "./MOnboardWindow.vue"
export { default as MPrepArt } from "./MPrepArt.vue"
export { vddPageTexts } from "../settings/vddPageTexts.js"
export { VDD_PREP, VDD_RULES, vddOn } from "../settings/virtualDisplay.js"
export { default as MRemoteAccess } from "./MRemoteAccess.vue"
export { default as MRemotePublic } from "./MRemotePublic.vue"
export { remoteTexts } from "./remoteTexts.js"
export { default as MWebAccess } from "./MWebAccess.vue"
export { webAccessTexts } from "./webAccessTexts.js"
export { DEFAULT_BASE_PORT as HOST_DEFAULT_PORT, BASE_PORT_MIN, BASE_PORT_MAX, PORT_OFFSETS, basePortOf, isDefaultPort, derivedPorts, webPort, formatHostAddress, parseHostPort, validateBasePort, portRunText } from "./hostAddress.js"
export { addressPlan } from "./guideEntry.js"
export { WEB_ACCESS_SCOPES, scopeOf, webUrl, webPortOf, webAddresses, scopeChange, accessPending, bindValid } from "./webAccess.js"
export { default as MReachCard } from "./MReachCard.vue"
export { normalizeReport, reachView, reachSummary, publicAddress, meshAddress, firewallCommand, parseReason, REASON_FIX, VERDICT_LOOK } from "../settings/reachability.js"
export { reachTexts } from "../settings/reachTexts.js"
export { createReachability } from "./useReachability.js"
export { default as MRemoteWindow } from "./MRemoteWindow.vue"
export { default as MPinHost } from "./MPinHost.vue"
export { PIN_SETTINGS, ACTION_TILES, PAGE_TILES, MAX_PINS, pinTexts, pinSpecForSetting, pinSpecForAction, pinSpecForPage } from "../pins/registry.js"
export { pinToHome, unpinFromHome, isPinnedOnHome, tileIdOfSpec } from "../pins/home.js"
export { pinCards, pinTileTexts } from "./homePins.js"
export { default as MCaption } from "./MCaption.vue"
export { default as MConnectDialog } from "./MConnectDialog.vue"
export { default as MConnectPanel } from "./MConnectPanel.vue"
export { default as MDashJourney } from "./MDashJourney.vue"
export { default as MPinEntry } from "./MPinEntry.vue"
export { JOURNEY_STEPS, journeyActive, journeyAfterCount, journeyOpened, journeyStale, readJourney, writeJourney } from "./journey.js"
export { readsPairQr, connectTexts, clientUrl, whyOf, QR_PAIRING } from "../clients/recommend.js"
export { useConnectDialog } from "./useConnectDialog.js"
export { useJourneyHome } from "./useJourneyHome.js"
export { default as MReachVerdict } from "./MReachVerdict.vue"
export { default as MPublicEndpoints } from "./MPublicEndpoints.vue"
export { validateEndpoint, parseEndpoints, serializeEndpoints, endpointsOfConfig } from "../settings/reachability.js"
export { default as MReachOverview } from "./MReachOverview.vue"
export { default as MEndpointList } from "./MEndpointList.vue"
export { lanView, reachOverview } from "../settings/reachability.js"
export { default as MNetworkOverview } from "./MNetworkOverview.vue"
export { normalizeOverview, networkOverviewView, networkOverviewSummary, stunRows } from "../settings/networkOverview.js"
export { networkOverviewTexts } from "../settings/networkOverviewTexts.js"
export { createNetworkOverview } from "./useNetworkOverview.js"
export { default as MOsChips } from "./MOsChips.vue"
export { default as MClientAssets } from "./MClientAssets.vue"
export { default as MClientCard } from "./MClientCard.vue"
export { useReleaseAssets } from "./useReleaseAssets.js"
export { recommendForOs, CONNECT_OS, QR_INSTALL_OS } from "../clients/recommend.js"
export { default as MCoachMarks } from "./MCoachMarks.vue"
export { coachTexts } from "./coachTexts.js"
export { default as MPairPrompt } from "./MPairPrompt.vue"
export { createPairingPending } from "./usePairingPending.js"
export { default as MLinkActions } from "./MLinkActions.vue"
export { default as MAnnouncementPopup } from "./MAnnouncementPopup.vue"
export { default as MAnnouncementButton } from "./MAnnouncementButton.vue"
export { default as MAnnouncementPage } from "./MAnnouncementPage.vue"
export { announcementTexts } from "./announcementTexts.js"
export { feedbackTexts } from "../feedback/texts.js"
export { useDeveloperMode, tapOnVersion, usableSource, TAPS_NEEDED } from "./useDeveloperMode.js"
export { ackedAt } from "../announcements/store.js"
export { firstImage } from "../announcements/markdown.js"
export { default as MStarPrompt } from "./MStarPrompt.vue"
export { default as MClientPrompt } from "./MClientPrompt.vue"
export { sessionClientLabel, clientFamilyLabel, isPlaceholderName } from "./clientLabel.js"
export { clientRecommendation, clientInUse, isRecommended, OPTIONS_BY_OS, readClientRec, markClientRec } from "./clientPrompt.js"
export { default as MGithubMark } from "./MGithubMark.vue"
export { default as MBilibiliMark } from "./MBilibiliMark.vue"
export { BOOT_KEY, parseBoot, persistBoot, endBoot, bootLayersCss, prefixThemeCss } from "../appearance/boot.js"
export { useStarCard, readStar, STAR_HOST_URL, STAR_HOST, starClientFor, osFromClientName } from "./starCard.js"
export { realSession, isSessionClient, onlineClients } from "./clientsLive.js"
export { useFitText, fitScale, fitElement, fitDetail, FIT_SELECTOR, FIT_MIN } from "./fitText.js"
export { useFitRows, fitRows, FIT_ROWS_SELECTOR } from "./fitRows.js"
export { useSessionClock, anchorOf, untilNextSecond, CLOCK_JITTER_MS } from "./sessionClock.js"
export { coverOk, coverKnown } from "./coverOk.js"
export { heroArtReady } from "./tiles/cal/heroTintCache.js"
export { useSystemInfo } from "./useSystemInfo.js"
export { reachProblemOf, speedText } from "./homeSystemTiles.js"
export { smartPlan, scenarioOf, suggestions, purposeOf } from "./homeSmart.js"
export { fitDash, unitsFor, sectionedOf, sectionLayout, emptiness } from "./homeFit.js"
export { useTileUsage } from "./useTileUsage.js"

export { default as MLoginPage } from "./MLoginPage.vue"
export { default as MSecurityLogin } from "./MSecurityLogin.vue"
export { useAuthSession } from "./useAuthSession.js"
export { default as MCaptionAvatar } from "./MCaptionAvatar.vue"
export { pixelSize, avatarState } from "./captionAvatar.js"

// one notification system, one unsaved state, one menu, tooltips in the top layer
import { installTips } from './tips.js'
export { showTip } from './tips.js'
installTips()
export { default as MNotifyHost } from './MNotifyHost.vue'
export { default as MPageBanners } from './MPageBanners.vue'
export { default as MStatusBell } from './MStatusBell.vue'
export { default as MPendingHost } from './MPendingHost.vue'
export { default as MMenu } from './MMenu.vue'
export { createPendingStore, usePending } from '../pending/store.js'
export { createNotifyStore, useNotify } from '../notify/store.js'
export { pendingTexts } from '../pending/texts.js'
export { exposePending, mountPendingBridge } from '../pending/bridge.js'
export { useSystemNotices } from './useSystemNotices.js'
export { default as MDialogHost } from './MDialogHost.vue'
export { createDialogStore, useDialogs } from '../dialog/store.js'
// the latency test clock (toolbox, 延迟测试时钟)
export { default as MLatencyClock } from "./MLatencyClock.vue"
export { latencyClockTexts } from "../latency/texts.js"
// tile kit (docs/tile-kit.md)
export { default as MTileChart } from './MTileChart.vue'
export { default as MTileShape } from './MTileShape.vue'
export { default as MTileNumeral } from './MTileNumeral.vue'
export { default as MTileChip } from './MTileChip.vue'
export { default as MTileRing } from './MTileRing.vue'
export { default as MTileStack } from './MTileStack.vue'
export { default as MTileEmpty } from './MTileEmpty.vue'
export { default as MTileHead } from './MTileHead.vue'
export { default as MTileCover } from './MTileCover.vue'
export { coverOf } from './tileCover.js'
export { springOf, morphShape, SHAPES as TILE_SHAPES } from './tileMotion.js'

export { default as MContextProvider } from './MContextProvider.vue'
export { registerContext } from '../contextmenu/registry.js'
// the menu window of a host that shows context menus in a window of its own (SPEC-context-menu, "beyond the window"): presenter, frame bridge, the page of the window
export { default as MMenuPopup } from './MMenuPopup.vue'
export { setMenuPresenter, menuPresenter, presentMenu, toMenuModel, itemAtPath, installFramePresenter, handleFrameMenuMessage } from '../contextmenu/presenter.js'
export { themeSnapshot, applyThemeSnapshot, POPUP_PAD } from '../contextmenu/popup.js'
export { contextTexts } from '../contextmenu/texts.js'
export { default as MTestTools } from './testtools/MTestTools.vue'
export { testToolTexts } from '../testtools/texts.js'
export { createQueuedCalls, createSerialCalls } from './queuedCalls.js'
export { default as MDeveloperPage } from './MDeveloperPage.vue'

export { default as MDisplayCards } from './MDisplayCards.vue'
export { default as MPrepSeg } from './MPrepSeg.vue'
export { default as MModeCard } from './MModeCard.vue'
export { default as MHdrStatus } from './MHdrStatus.vue'
export { default as MModeChips } from './MModeChips.vue'
export { default as MModePicker } from './MModePicker.vue'
export { default as MVddDevice } from './MVddDevice.vue'
export { default as MExpander } from './MExpander.vue'
export { displayTreeTexts } from '../settings/displayTreeTexts.js'
export { default as MInstaller } from './installer/MInstaller.vue'
export { default as DevIssues } from './devmode/DevIssues.vue'
export { default as DevReportHost } from './devmode/DevReportHost.vue'
export { default as DevLogs } from './devmode/DevLogs.vue'
export { default as DevApi } from './devmode/DevApi.vue'
export { default as DevFlags } from './devmode/DevFlags.vue'
export { default as DevBuild } from './devmode/DevBuild.vue'
export { default as DevTests } from './devmode/DevTests.vue'
export { default as DevHostSim } from './devmode/DevHostSim.vue'
export { default as DevSimBanner } from './devmode/DevSimBanner.vue'
export { default as DevSimChip } from './devmode/DevSimChip.vue'
export { default as DevSimConfirm } from './devmode/DevSimConfirm.vue'
export { useHostSimulation, createHostSimulation, SIMULATION_MS, SIMULATIONS } from './useHostSimulation.js'
export { default as DevHub } from './devmode/DevHub.vue'
export { devReport, devReportReady, registerDevReport, openDevReport, openFeedbackHere, currentPageName, askDevReport, clearDevReportAsk, closeDevReport, openDevSignIn, closeDevSignIn, addManualMask, undoManualMask, clearManualMasks } from './devmode/devReport.js'
export { useDevAccount } from './devmode/useDevAccount.js'
export { answerRedactRequests } from '../devmode/frameRects.js'
export { devmodeTexts, fillText as devmodeFill } from '../devmode/texts.js'
export { DEV_REPOS, repoOf as devRepoOf, repoSlug as devRepoSlug, repoForArea, newIssueUrl } from '../devmode/repos.js'
export { configureDevBackend, devBackend } from '../devmode/config.js'
export { useDevActivity } from './devmode/useDevActivity.js'

// the launch splash (启动画面): shown on the streamed display while a game starts
export { default as MLaunchSplash } from "./MLaunchSplash.vue"
export { launchSplashTexts, launchLine, LAUNCH_STAGES } from "../launchsplash/texts.js"
