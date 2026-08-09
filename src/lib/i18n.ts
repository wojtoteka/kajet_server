/*
  Język strony: polski albo angielski.

  Polski jest domyślny i taki zostaje, dopóki ktoś nie wybierze inaczej -
  odwrotnie niż w aplikacji, która pyta o język system. Strona nie ma o co
  pytać: kto ją otwiera, ten najczęściej właśnie po polsku ją dostał.

  Wybór siedzi w CIASTECZKU, nie w localStorage – inaczej niż motyw. Powód jest
  konkretny: napisy składa serwer (to są komponenty serwerowe Next.js), więc
  musi znać język JESZCZE PRZED wysłaniem strony. localStorage czyta dopiero
  przeglądarka i cała strona przyjechałaby po polsku, żeby zaraz przemrugnąć na
  angielski.

  Napisy stoją w jednym obiekcie na język – tak samo jak w aplikacji
  (core/text/Words.kt). Nazwy pól mówią, GDZIE napis stoi, nie co znaczy.
*/

export type Language = "pl" | "en";

/** Nazwa ciasteczka. Zmiana skasuje ludziom dotychczasowy wybór. */
export const LANGUAGE_COOKIE = "kajet-jezyk";

/** Rok – język ma przeżyć zamknięcie przeglądarki. */
export const LANGUAGE_MAX_AGE = 60 * 60 * 24 * 365;

export const DEFAULT_LANGUAGE: Language = "pl";

export function knownLanguage(value: string | null | undefined): Language {
  return value === "en" ? "en" : DEFAULT_LANGUAGE;
}

export const LANGUAGE_CHOICES: { id: Language; label: string }[] = [
  { id: "pl", label: "Polski" },
  { id: "en", label: "English" },
];

export type Words = {
  // --- Rzeczy wspólne ---
  save: string;
  cancel: string;
  close: string;
  back: string;
  delete: string;
  rename: string;
  create: string;
  open: string;
  search: string;
  settings: string;
  account: string;
  signIn: string;
  signOut: string;
  untitled: string;
  language: string;

  // --- Zapis ---
  saved: string;
  saving: string;
  unsavedWillSave: string;
  unsavedPressSave: string;
  autosaveOn: string;
  autosaveOff: string;
  saveFailed: string;
  willSaveWhenYouType: string;

  // --- Biblioteka ---
  library: string;
  folders: string;
  allNotes: string;
  favorites: string;
  noFolder: string;
  newFolder: string;
  folderName: string;
  folderSettings: string;
  trash: string;
  moveNoteToFolder: string;
  emptyLibrary: string;
  emptyLibraryHint: string;

  // --- Notatka ---
  noteTitle: string;
  noteContent: string;
  writeHere: string;
  bold: string;
  italic: string;
  strike: string;
  underline: string;
  highlight: string;
  textColour: string;
  textColourOfSelection: string;
  noColour: string;
  ownColour: string;
  collapse: string;
  linkAddress: string;
  insertWord: string;

  // --- Kod ---
  codeRun: string;
  codeRunning: string;
  codeLanguage: string;
  codeTitle: string;
  codePreview: string;
  codePreviewAbout: string;
  codeRunDisabled: string;


  /** Format daty i godziny; służy też za znacznik języka w pomocnikach. */
  locale: string;

  // --- Biblioteka ---
  myNotes: string;
  libraryTitle: string;
  nothingMatchesFilters: string;
  noFavoritesYet: string;
  nothingHereYet: string;
  inTrash: string;
  noLimit: string;
  until: string;
  newText: string;
  mindMap: string;
  handwritten: string;
  newCode: string;
  app: string;
  admin: string;
  searchPlaceholder: string;
  folder: string;
  all: string;
  kind: string;
  kindText: string;
  kindCode: string;
  kindHandwritten: string;
  kindMindMaps: string;
  filterButton: string;
  filtersLabel: string;
  emptyPageTitle: string;
  emptyPageHeading: string;
  backToStart: string;
  favoritesEmptyHeading: string;
  favoritesEmptyAbout: string;
  emptyEyebrow: string;
  emptyHeading: string;
  emptyAbout: string;
  textNote: string;
  codeFile: string;
  columnNote: string;
  columnKind: string;
  columnFolder: string;
  columnSize: string;
  columnChanged: string;
  columnActions: string;
  tagFavorite: string;
  tagShared: string;
  attachmentsWord: string;
  versionWord: string;
  openNote: string;
  starIt: string;
  unstarIt: string;
  moveToTrash: string;
  confirmTrash: string;
  pagerLabel: string;
  earlier: string;
  next: string;
  pageWord: string;
  ofWord: string;


  // --- Kosz i foldery ---
  trashTitle: string;
  trashAbout: string;
  backToList: string;
  emptyTrashButton: string;
  confirmEmptyTrash: string;
  trashEmptyHeading: string;
  trashEmptyAbout: string;
  columnTrashed: string;
  restore: string;
  forGood: string;
  confirmPurge: string;
  trashPagerLabel: string;
  folderSettingsOf: string;
  deleteFolder: string;
  saveLook: string;
  createFolderButton: string;
  folderColourGroup: string;
  folderIconGroup: string;


  // --- Nowa notatka ---
  newNoteEyebrow: string;
  newTextNoteTitle: string;
  newTextNoteAbout: string;
  newCodeNoteTitle: string;
  newCodeNoteAbout: string;
  newMindMapTitle: string;
  newMindMapAbout: string;
  newHandwritingTitle: string;
  newHandwritingAbout: string;
  createNoteButton: string;
  createFileButton: string;
  createMapButton: string;
  metaNewText: string;
  metaNewCode: string;
  metaNewMindMap: string;
  metaNewHandwriting: string;
  codeDisabledHere: string;
  codeDisabledForAccount: string;

  // --- Nie ma takiej strony ---
  metaNoteNotFound: string;
  metaPageNotFound: string;
  error404: string;
  noteNotFoundHeading: string;
  noteNotFoundAbout: string;
  lookInTrash: string;
  pageNotFoundHeading: string;
  pageNotFoundLead: string;
  pageNotFoundWrite: string;
  pageNotFoundWriteLink: string;
  homePage: string;
  sharedLinkNote: string;


  // --- Strona notatki ---
  noteHandwritten: string;
  noteTextKind: string;
  noteCodeKind: string;
  changedWord: string;
  favoriteWord: string;
  editing: string;
  editingMindMap: string;
  editingHandwriting: string;
  handwritingUnreadable: string;
  codeUnreadable: string;
  sharingEyebrow: string;
  shareThisNote: string;
  shareAbout: string;
  shareButton: string;
  sharePreparing: string;
  whatTheyMayDo: string;
  readOnly: string;
  readAndEdit: string;
  emailOptional: string;
  orJustTheLink: string;
  mailNotSet: string;
  validForDays: string;
  zeroMeansForever: string;
  allowWithoutAccount: string;
  alreadyShared: string;
  columnWho: string;
  columnRights: string;
  columnValidUntil: string;
  byNameNeedsSignIn: string;
  linkWord: string;
  rightEdit: string;
  rightRead: string;
  expiredMark: string;
  noDeadline: string;
  openedWord: string;
  revoke: string;
  confirmRevoke: string;
  inTrashWord: string;
  trashedWord: string;
  noteInTrashAbout: string;


  // --- Wspólne kawałki widoku ---
  copyWord: string;
  copiedWord: string;
  copyLink: string;
  linkCopied: string;
  justAMoment: string;
  confirmationLabel: string;
  areYouSure: string;
  emptyNoteText: string;
  deleteForGood: string;
  confirmPurgeNote: string;
  confirmTrashNote: string;
  addToFavorites: string;
  removeFromFavorites: string;
  attachmentsEyebrow: string;
  filesWithNote: string;
  sendFile: string;
  sendingFile: string;
  fileLabel: string;
  nameInNote: string;
  namePlaceholder: string;
  columnName: string;
  previewWord: string;
  openInNewTab: string;
  removeAttachment: string;
  mindMapLabel: string;
  noteUnreadableHere: string;


  // --- Panel kodu ---
  codeFileNamePlaceholder: string;
  codeWord: string;
  savingWord: string;
  previewEyebrow: string;
  htmlPreviewFrame: string;
  runningEyebrow: string;
  runOnServer: string;
  cannotRunHere: string;
  standardInput: string;
  stdinPlaceholder: string;
  exitCodeWord: string;
  interruptedByTimeout: string;


  // --- Edytor tekstu na stronie ---
  inkColour: string;
  greyColour: string;
  blueColour: string;
  redColour: string;
  greenColour: string;
  brownColour: string;
  photoAlt: string;
  textLookToolbar: string;
  heading1: string;
  heading2: string;
  heading3: string;
  bulletListHint: string;
  numberedListHint: string;
  taskListHint: string;
  quoteWord: string;
  codeInText: string;
  codeBlockWord: string;
  linkWord2: string;
  sendingPhoto: string;
  insertPhotoInNote: string;
  writeSomethingFirst: string;
  saveNoteFirst: string;
  formulaWord: string;
  wholeNoteFont: string;
  wholeNoteSize: string;
  wholeNoteColour: string;
  defaultColour: string;
  alignLeft: string;
  alignCentre: string;
  alignRight: string;
  ownTextColour: string;
  photoInNote: string;
  shrinkPhoto: string;
  growPhoto: string;
  removePhotoFromNote: string;
  autosaveHint: string;
  autosaveOffHint: string;


  // --- Edytor odręczny na stronie ---
  penInk: string;
  penTeal: string;
  penBurgundy: string;
  penBlue: string;
  penHighlighter: string;
  handwritingToolbar: string;
  toolPen: string;
  toolFineliner: string;
  toolHighlighter: string;
  toolEraser: string;
  toolPointer: string;
  toolShapes: string;
  undoLastStroke: string;
  undoLastThing: string;
  shapeLine: string;
  shapeArrow: string;
  shapeRect: string;
  shapeRoundRect: string;
  shapeEllipse: string;
  shapeTriangle: string;
  shapeDiamond: string;
  shapeStar: string;
  shapeFillOn: string;
  shapeFillOff: string;
  shapeSquareLock: string;
  shapeRemove: string;
  addOwnColour: string;
  pickOwnColourNewSlot: string;
  ownInkColour: string;
  backgroundWord: string;
  bgPlain: string;
  bgLined: string;
  bgGrid: string;
  bgDots: string;
  bgStave: string;
  pageButton: string;
  clearPage: string;
  confirmClearPage: string;
  uploadAndPlace: string;
  drawSomethingFirst: string;
  uploadingWord: string;
  photoWord: string;
  photoToInsert: string;
  choosePhoto: string;
  insertAgain: string;
  removeSelectedPhoto: string;
  previousPage: string;
  nextPage: string;
  pageGrowsHint: string;
  handwritingCanvas: string;


  // --- Edytor mapy myśli na stronie ---
  nodeGraphite: string;
  nodeTeal: string;
  nodeBurgundy: string;
  nodeIndigo: string;
  nodeSunny: string;
  nodePlum: string;
  fontBody: string;
  fontHeading: string;
  fontMono: string;
  newNodeText: string;
  mindMapToolbar: string;
  nodeWord: string;
  childWord: string;
  besideWord: string;
  pickTarget: string;
  pickSource: string;
  connectWord: string;
  deleteNode: string;
  undoWord: string;
  redoWord: string;
  arrangeWord: string;
  zoomOutWord: string;
  zoomInWord: string;
  fitAll: string;
  nodeLookToolbar: string;
  turnIntoRectangle: string;
  turnIntoOval: string;
  nodeShape: string;
  smallerTextWord: string;
  largerTextWord: string;
  frameWord: string;
  ownFrameColour: string;
  writingWord: string;
  ownNodeTextColour: string;
  expandBranch: string;
  collapseBranch: string;
  nodeTextLabel: string;
  mindMapCanvas: string;
  clickToRemoveEdge: string;
  mindMapHints: string;


  // --- Strona główna ---
  homeEyebrow: string;
  // Tytuł strony głównej w trzech kawałkach, bo środkowe słowo dostaje
  // atramentowe podkreślenie i musi stać w osobnym znaczniku.
  homeTitleBefore: string;
  homeTitleWord: string;
  homeTitleAfter: string;
  homeLead: string;
  haveInviteCode: string;
  downloadForAndroid: string;
  latestRelease: string;
  skipToContent: string;
  homeKindsTitle: string;
  homeKindsIntro: string;
  homeKindHandTitle: string;
  homeKindHandBody: string;
  homeHandPicture: string;
  homeKindTextTitle: string;
  homeKindTextBody: string;
  homeTextPicture: string;
  homeKindMapTitle: string;
  homeKindMapBody: string;
  homeKindCodeTitle: string;
  homeKindCodeBody: string;
  homeCodePicture: string;
  homeWhereTitle: string;
  homeNoAccountTitle: string;
  homeNoAccountBody: string;
  homeWithAccountTitle: string;
  homeWithAccountBody: string;
  homeShareTitle: string;
  homeShareBody: string;
  homeDownloadTitle: string;
  homeStepOne: string;
  homeStepTwo: string;
  homeStepThree: string;
  homeDownloadFacts: string;
  homeDownloadPage: string;
  homeDownloadFile: string;
  homeInviteTitle: string;
  homeInviteBody: string;

  // --- Udostępniona notatka ---
  metaSharedNote: string;
  linkEyebrow: string;
  cannotShowNote: string;
  sharedNoteCaption: string;
  mayChangeIt: string;
  readOnlyMark: string;
  openAsOwner: string;
  codeRunOwnerOnly: string;
  thisIsAKajetNote: string;
  seeWhatItIs: string;


  // --- Potwierdzenie adresu ---
  metaConfirm: string;
  emailAddressEyebrow: string;
  goToSignIn: string;
  backToRegister: string;
  noLinkHeading: string;
  noLinkBody: string;
  linkDeadHeading: string;
  linkDeadBody: string;
  linkExpiredHeading: string;
  linkExpiredBody: string;
  addressConfirmed: string;

  // --- Do pobrania ---
  metaDownload: string;
  androidAppCaption: string;
  toDownload: string;
  downloadLead: string;
  downloadWord: string;
  publishedWord: string;
  whatChanged: string;
  noAppYet: string;
  noAppYetBody: string;
  howToInstall: string;
  howToInstallBody: string;
  olderVersions: string;


  // --- Rejestracja ---
  metaRegister: string;
  newAccountEyebrow: string;
  createAccountHeading: string;
  registerLead: string;
  haveAccountAlready: string;
  inviteCode: string;
  inviteCodePlaceholder: string;
  codeCameFromLink: string;
  loginOptional: string;
  loginPlaceholder: string;
  loginIsVisible: string;
  atLeastEightChars: string;
  repeatPassword: string;
  creatingAccount: string;
  createAccountButton: string;
  preferGoogle: string;
  googleAccountEyebrow: string;
  googleAccountAbout: string;
  checkingCode: string;
  onWithGoogle: string;

  // --- Nowe hasło ---
  metaNewPassword: string;
  newPasswordEyebrow: string;
  setNewPasswordHeading: string;
  newPasswordAbout: string;
  saveNewPassword: string;
  newPasswordLabel: string;
  linkDeadHeading2: string;
  linkOneHourAbout: string;
  passwordEyebrow: string;
  forgotPasswordHeading: string;
  forgotPasswordAbout: string;
  mailNotSetHere: string;
  sendLinkButton: string;
  sendingWord: string;
  backToSignIn: string;


  // --- Łączenie urządzenia ---
  metaConnectDevice: string;
  appEyebrow: string;
  noCodeHeading: string;
  noCodeAbout: string;
  ordinarySignIn: string;
  mobileAppEyebrow: string;
  connectDeviceHeading: string;
  codeExpiredAbout: string;
  signInDenied: string;
  openTheApp: string;
  orStayInPanel: string;
  deviceFallback: string;
  connecting: string;
  denying: string;
  notMeDeny: string;
  afterApprovalAbout: string;


  // --- Moje konto ---
  adminPanelLink: string;
  profileEyebrow: string;
  roleWord: string;
  roleAdmin: string;
  roleUser: string;
  signInOnSite: string;
  viaPassword: string;
  viaSession: string;
  lastSignIn: string;
  notedNever: string;
  accountSince: string;
  noteList: string;
  spaceEyebrow: string;
  limitValidUntil: string;
  spaceRunningOut: string;
  writingEyebrow: string;
  howIWriteHere: string;
  writingLead: string;
  saveSettings: string;
  autoSaveTitle: string;
  autoSaveAbout: string;
  boldFontTitle: string;
  boldFontAbout: string;
  fontOfNewNote: string;
  textSizeLabel: string;
  zeroMeansDefault: string;
  alignmentLabel: string;
  deviceTokensEyebrow: string;
  tokenSignIn: string;
  tokenSignInAbout: string;
  issueToken: string;
  issuingToken: string;
  deviceName: string;
  deviceNamePlaceholder: string;
  lastUseWord: string;
  saveName: string;
  issuedWord: string;
  neverUsed: string;
  revokeToken: string;
  confirmRevokeToken: string;
  revokeAllTokens: string;
  confirmRevokeAll: string;
  noTokensYet: string;
  loginEyebrow: string;
  accessEyebrow: string;
  saveLogin: string;
  passwordChangeAbout: string;
  passwordSetAbout: string;
  changePasswordButton: string;
  setPasswordButton: string;
  currentPassword: string;
  repeatNewPassword: string;
  signOutEyebrow: string;
  signOutAbout: string;
  signOutThisBrowser: string;
  signOutEverywhere: string;
  signOutEverywhereTitle: string;
  signOutEverywhereAbout: string;


  // --- Panel administratora ---
  metaAdmin: string;
  adminCaption: string;
  adminOverview: string;
  adminAccounts: string;
  adminCodes: string;
  adminApp: string;
  adminLog: string;
  serverState: string;
  statAccounts: string;
  statNotes: string;
  statNotesNote: string;
  statSpace: string;
  statSpaceNote: string;
  statFreeCodes: string;
  statFreeCodesNote: string;
  lastWeekEyebrow: string;
  statNewAccounts: string;
  statNotesToday: string;
  statCrashes: string;
  statFreeSpace: string;
  statFreeSpaceNote: string;
  unknownWord: string;
  worthCheckingEyebrow: string;
  serverNearlyFullTitle: string;
  diskUnderLimitTitle: string;
  mailOffTitle: string;
  noSmtpHint: string;
  googleOffTitle: string;
  googleEnvHint: string;
  noReleaseTitle: string;
  noReleaseHint: string;
  codeOffTitle: string;
  codeOffHint: string;
  issueInviteCode: string;
  manageAccounts: string;
  publishApp: string;


  // --- Panel: konta ---
  accountsLead: string;
  searchAccountPlaceholder: string;
  clearWord: string;
  tagAdministrator: string;
  tagBlocked: string;
  tagNoCodeRunning: string;
  tagAiAllowed: string;
  accountSinceShort: string;
  blockReasonLabel: string;
  quotaSection: string;
  setQuota: string;
  quotaInMb: string;
  forHowManyDays: string;
  quotaHint: string;
  changeLogin: string;
  newLogin: string;
  changeEmail: string;
  newEmail: string;
  sendPasswordLink: string;
  setPasswordForUser: string;
  atLeast8Placeholder: string;
  unblockAccount: string;
  blockAccount: string;
  blockReasonPlaceholder: string;
  blockReasonAria: string;
  takeAdminRights: string;
  makeAdmin: string;
  takeCodeRunning: string;
  allowCodeRunning: string;
  takeAiAccess: string;
  allowAiAccess: string;
  aiSection: string;
  aiDailyLimitLabel: string;
  setAiLimit: string;
  aiLimitHint: string;
  aiNoUsageYet: string;
  recomputeStorage: string;
  deleteAccount: string;

  // --- Panel: kody ---
  newCodeEyebrow: string;
  issueInviteCodeHeading: string;
  codesLead: string;
  issueCode: string;
  issuingCode: string;
  howManyAccounts: string;
  quotaMbLabel: string;
  codeGrantsAi: string;
  codeGrantsAiHint: string;
  validForDaysLabel: string;
  mailNotSetCodes: string;
  descriptionForYou: string;
  descriptionPlaceholder: string;
  issuedCodes: string;
  noCodesYet: string;
  columnCode: string;
  columnUse: string;
  columnAccountQuota: string;
  columnValidTo: string;
  columnDescription: string;
  copyCode: string;
  tagSpent: string;
  tagExpired: string;
  tagFree: string;
  usedByWord: string;
  defaultWord: string;
  confirmDeleteCode: string;

  // --- Panel: dziennik ---
  logLead: string;
  logEmpty: string;
  columnWhen: string;
  columnWho2: string;
  columnAction: string;
  columnDetails: string;
  deletedAccount: string;

  // --- Panel: awarie aplikacji ---
  adminCrashes: string;
  metaAdminCrashes: string;
  crashesLead: string;
  crashesEmpty: string;
  columnHowMany: string;
  columnDevice: string;
  crashShowReport: string;
  crashNoAccount: string;

  // --- Panel: wydania ---
  metaAdminApp: string;
  newReleaseEyebrow: string;
  publishAppHeading: string;
  publishAppLead: string;
  publishedReleases: string;
  noReleasesYet: string;
  columnVersion: string;
  columnFile: string;
  columnDownloads: string;
  columnPublished: string;
  releaseNumberWord: string;
  tagDownloadable: string;
  publishedByWord: string;
  makeCurrent: string;
  confirmDeleteRelease: string;
  apkFileLabel: string;
  versionLabel: string;
  versionPlaceholder: string;
  versionHint: string;
  releaseNumberLabel: string;
  releaseNumberHint: string;
  readFromFile: string;
  couldNotReadRelease: string;
  whatChangedLabel: string;
  releaseNotesPlaceholder: string;
  replacePreviousHint: string;
  publishRelease: string;
  nginxTooBig: string;
  connectionDropped2: string;
  uploadAborted: string;
  pickApkFile: string;
  sendingFileStage: string;
  savingReleaseStage: string;
  uploadFailed: string;


  // --- Logowanie: powody i pożegnania ---
  metaSignIn: string;
  signInEntrance: string;
  signInLead: string;
  signInWithGoogleButton: string;
  googleInAppHint: string;
  noAccountAsk: string;
  registerOnCode: string;
  signInBlocked: string;
  signInCodeRequired: string;
  signInNotLinked: string;
  signInConfiguration: string;
  signInAccessDenied: string;
  signInOAuthStart: string;
  signInOAuthCallback: string;
  signInOAuthCreate: string;
  signInInterrupted: string;
  signInVerification: string;
  signInDefault: string;
  byeEverywhere: string;
  byePasswordChanged: string;
  byePasswordSet: string;
  siteDescription: string;
  sendStraightTo: string;
  searchAccountLabel: string;
  deleteOlderReleases: string;


  // --- Odpowiedzi API i biblioteki serwera ---
  apiDbBehind: string;
  apiNoDatabase: string;
  apiUnexpected: string;
  apiCrashTooOften: string;
  apiCrashTooBig: string;
  apiCrashUnreadable: string;
  apiVersionTooOften: string;
  apiNotSignedIn: string;
  apiTokenDead: string;
  apiTokenExpired: string;
  apiAccountBlocked: string;
  apiIdentityFailed: string;
  apiMustSignIn: string;
  apiNoteNotYours: string;
  apiFolderNotYours: string;
  apiLinkDead: string;
  apiLinkExpired: string;
  apiShareReadOnly: string;
  apiSharedByName: string;
  apiSharedToSomeoneElse: string;
  apiSignInToOpen: string;
  ownerWord: string;
  guestWord: string;
  unknownDeviceWord: string;
  apiChallengeGone: string;
  apiChallengeExpiredAskApp: string;
  apiChallengeDenied: string;
  apiChallengeOtherAccount: string;
  apiChallengeExpired: string;
  apiChallengeWrongAccount: string;
  apiPreviewBelow: string;
  apiRunningOff: string;
  apiRunFailed: string;
  apiRunnerBroken: string;
  apiInstallDocker: string;
  apiNoDockerRights: string;
  apiOffInServerSettings: string;
  apiRunnerReady: string;
  apiConflict: string;
  apiNoteWithoutBody: string;
  apiTrashFirst: string;
  apiGiveAttachmentName: string;
  apiNoSuchAttachment: string;
  apiNoSuchAccount: string;
  apiFileGoneFromDisk: string;
  apiNoSuchCode: string;
  apiCodeExpired: string;
  apiCodeUsedUp: string;
  apiBadRequest: string;
  apiGiveDeviceName: string;
  apiSignInDenied: string;
  apiCodeExpiredOrUsed: string;
  apiGiveEmailAndPassword: string;
  apiWrongCredentials: string;
  apiUploadUnreadable: string;
  apiFileKindRefused: string;
  apiFileContentMismatch: string;
  apiFileSaveFailed: string;
  apiGiveAttachmentToDelete: string;
  apiUnknownShape: string;
  apiNoteUnknownShape: string;
  apiFolderUnknownShape: string;
  apiNoteNotOnServer: string;
  apiCodeRunningOffForAccount: string;
  apiCodeRunningOffKeepWriting: string;
  apiGiveLanguageAndCode: string;
  apiNothingToRun: string;
  apiUnknownAddress: string;
  apiAiNoConsent: string;
  apiAiWrongKind: string;
  apiAiNoInstruction: string;
  apiAiTimeout: string;
  apiAiBusy: string;
  apiAiBroken: string;
  apiAiNoAnswer: string;
  apiAiHistoryCleared: string;
  aiTitle: string;
  aiHint: string;
  aiAsk: string;
  aiWorking: string;
  aiUndo: string;
  aiUndone: string;
  aiUndoFailed: string;
  aiNoteNotSavedYet: string;
  aiQuestionLabel: string;
  aiHistoryTitle: string;
  aiHistoryEmpty: string;
  aiForgetHistory: string;
  aiNeedsConsent: string;
  aiGoToAccount: string;
  aiConsentSection: string;
  aiConsentWhatHappens: string;
  aiConsentTraining: string;
  aiConsentVoluntary: string;
  aiConsentGiven: string;
  aiConsentAgree: string;
  aiConsentWithdraw: string;
  aiConsentWithdrawn: string;
  /*
    Odmowy KajetAI. Widzi je człowiek w panelu przy notatce, więc mówią
    o tym, co się stało z jego notatką, a nie o kształcie odpowiedzi modelu.
  */
  aiNoQuestionAsked: string;
  aiUnknownTool: string;
  aiTextUnsavable: string;
  aiTextUnchanged: string;
  aiCodeUnsavable: string;
  aiCodeUnchanged: string;
  aiMapUnsavable: string;
  aiCodeNoteUnreadable: string;
  aiMindMapUnreadable: string;
  // Odmowy strażnika mapy myśli.
  aiMapNoOperations: string;
  aiMapNodeUnnamed: string;
  aiMapNewNodeLoose: string;
  aiMapNodeUnderItself: string;
  aiMapNodeUnderOwnBranch: string;
  aiMapAddedNodeLoose: string;
  aiMapNodeWithoutName: string;
  aiMapTwoSameLinks: string;
  aiMapLinkToNowhere: string;
  aiMapSelfLink: string;


  apiServerBusy: string;
  apiTryInSeconds: string;
  apiBadReleaseHash: string;
  apiNotAnApk: string;
  apiUploadFailed: string;
  apiCannotRunLanguage: string;
  apiNotAProgram: string;
  apiGoogleNoEmail: string;
  apiNoInviteForGoogle: string;


  // --- Odpowiedzi akcji panelu ---
  actTokenRevoked: string;
  actNoSuchToken: string;
  actGiveDeviceName: string;
  actNoTokensToRevoke: string;
  actSavedAutosaveOn: string;
  actSavedAutosaveOff: string;
  actPasswordTooShort: string;
  actCheckWhatYouTyped: string;
  actPasswordsDiffer: string;
  actGiveCurrentPassword: string;
  actCurrentPasswordWrong: string;
  actLoginRules: string;
  actLoginTaken: string;
  actRestored: string;
  actDeletedForGood: string;
  actMovedToFolder: string;
  actTakenOutOfFolder: string;
  actGiveFolderName: string;
  actFolderNameTooLong: string;
  actLookChanged: string;
  actNotAnEmail: string;
  actPasswordMinEight: string;
  actPasswordsDifferTwice: string;
  actEmailTaken: string;
  actLoginTakenPickAnother: string;
  actAccountCreated: string;
  actResetLinkSent: string;
  actLinkDeadAskNew: string;
  actLinkExpiredHour: string;
  actNoAccountOnAddress: string;
  actPasswordChangedEverywhere: string;
  actSignInDenied: string;
  actNoFileArrived: string;
  actAdminOnly: string;
  actCheckNumbers: string;
  actCopyRegistrationLink: string;
  actUnlimitedGiven: string;
  actCannotBlockSelf: string;
  actLoginRulesAdmin: string;
  actBadLogin: string;
  actAccountHasAddress: string;
  actAddressOnAnother: string;
  actConfirmationSent: string;
  actConfirmationFailed: string;


  actOnlyTextNotes: string;
  actRefreshAfterConflict: string;
  actNothingChanged: string;
  actMindMapUnreadable: string;
  actNotAMindMap: string;
  actHandwritingNeedsPage: string;
  actHandwritingUnreadable: string;
  actNotHandwriting: string;
  actLanguageUnsupported: string;
  actPickLanguage: string;
  actNoteDeletedForGood: string;
  actAddedToFavorites: string;
  actRemovedFromFavorites: string;
  actAttachmentDataMissing: string;
  actAttachmentGone: string;
  actOnlyOwnNote: string;
  actShareMailFailed: string;
  actLinkReady: string;
  actShareGone: string;
  actShareRevoked: string;
  actSavedNote: string;
  actNoteGone: string;
  actWhichNote: string;
  actPickFileFirst: string;
  actNotACodeFile: string;


  actCopyConfirmLink: string;
  actResetMailFailed: string;
  actCannotTakeOwnRights: string;
  actStorageRecomputed: string;
  actCannotDeleteOwnAccount: string;
  actVersionExample: string;
  actPickApkFirst: string;
  actUploadLost: string;
  actCopyDownloadLink: string;
  actNoReleaseLeft: string;
  actDeviceWillSignIn: string;
  actNoReleaseForDownload: string;
  actReleaseFileGone: string;
  actWhichAccount: string;
  actWhichCode: string;
  actCodeDeleted: string;
  actInviteMailFailed: string;
  actNoSuchRelease: string;
  daysWord: string;

  // --- Paski edytorów i nagłówek strony ---
  strokeOpacity: string;
  fontLabel: string;
  tableWord: string;
  dividerWord: string;
  clearColourHint: string;
  themeLabel: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;

  // --- Logowanie ---
  signInTitle: string;
  emailAddress: string;
  password: string;
  wrongCredentials: string;
  tooManyAttempts: string;
  forgotPassword: string;

  // --- Stopka i dokumenty ---
  footerTerms: string;
  footerPrivacy: string;
  metaTerms: string;
  metaPrivacy: string;
  acceptTerms: string;
  mustAcceptTerms: string;

  // --- Kontakt ---
  footerContact: string;
  metaContact: string;
  contactEyebrow: string;
  contactHeading: string;
  contactLead: string;
  contactNameLabel: string;
  contactSubjectLabel: string;
  contactMessageLabel: string;
  contactSendButton: string;
  contactSendingWord: string;
  contactSent: string;
  contactFillEverything: string;
  contactTooMany: string;
  contactFailed: string;
  contactNotSet: string;
  contactMailInstead: string;
  contactCaptchaMissing: string;
  contactCaptchaFailed: string;
  contactCaptchaUnavailable: string;

  // --- Skasowanie własnego konta ---
  deleteAccountEyebrow: string;
  deleteAccountLead: string;
  deleteAccountWhatGoes: string;
  sendDeletionCodeButton: string;
  sendingDeletionCode: string;
  deletionCodeSent: string;
  deletionCodeLabel: string;
  deletionCodeHint: string;
  deleteAccountForever: string;
  deletingAccount: string;
  confirmDeleteAccount: string;
  deletionGiveCode: string;
  deletionCodeWrong: string;
  deletionCodeExpired: string;
  deletionTooManyTries: string;
  deletionMailFailed: string;
  byeAccountDeleted: string;
};

const pl: Words = {
  save: "Zapisz",
  cancel: "Anuluj",
  close: "Zamknij",
  back: "Wróć",
  delete: "Skasuj",
  rename: "Zmień nazwę",
  create: "Utwórz",
  open: "Otwórz",
  search: "Szukaj",
  settings: "Ustawienia",
  account: "Moje konto",
  signIn: "Zaloguj się",
  signOut: "Wyloguj się",
  untitled: "Bez nazwy",
  language: "Język",

  saved: "Zapisane",
  saving: "Zapisuję…",
  unsavedWillSave: "Zapiszę za chwilę",
  unsavedPressSave: "Niezapisane – kliknij Zapisz (Ctrl+S)",
  autosaveOn: "Autozapis włączony",
  autosaveOff: "Autozapis wyłączony",
  saveFailed: "Nie udało się zapisać",
  willSaveWhenYouType: "Zapisze się samo",

  library: "Biblioteka",
  folders: "Foldery",
  allNotes: "Wszystkie",
  favorites: "Ulubione",
  noFolder: "Bez folderu",
  newFolder: "Nowy folder",
  folderName: "Nazwa folderu",
  folderSettings: "Ustawienia folderu",
  trash: "Kosz",
  moveNoteToFolder: "Przenieś notatkę do folderu",
  emptyLibrary: "Jeszcze pusto",
  emptyLibraryHint: "Napisz pierwszą notatkę albo zaloguj się w aplikacji tym samym kontem.",

  noteTitle: "Tytuł",
  noteContent: "Treść notatki",
  writeHere: "Pisz tutaj…",
  bold: "Pogrubienie",
  italic: "Kursywa",
  strike: "Przekreślenie",
  underline: "Podkreślenie",
  highlight: "Wyróżnienie",
  textColour: "Kolor pisma",
  textColourOfSelection: "Kolor zaznaczonego fragmentu",
  noColour: "Bez koloru",
  ownColour: "Własny kolor pisma",
  collapse: "Zwiń",
  linkAddress: "Adres odnośnika",
  insertWord: "Wstaw",

  codeRun: "Uruchom",
  codeRunning: "Uruchamiam…",
  codeLanguage: "Język",
  codeTitle: "Tytuł / nazwa pliku",
  codePreview: "Tak wygląda ta strona",
  codePreviewAbout: "Podgląd odświeża się w trakcie pisania.",
  codeRunDisabled: "Uruchamianie kodu jest tu wyłączone.",

  locale: "pl-PL",

  myNotes: "Moje notatki",
  libraryTitle: "Moje notatki – Kajet",
  nothingMatchesFilters: "Nic nie pasuje do filtrów.",
  noFavoritesYet: "Nie masz jeszcze ulubionych notatek.",
  nothingHereYet: "Nic tu jeszcze nie ma.",
  inTrash: "w koszu",
  noLimit: "bez limitu",
  until: "do",
  newText: "Nowa notatka tekstowa",
  mindMap: "Mapa myśli",
  handwritten: "Odręczna",
  newCode: "Nowy plik z kodem",
  app: "Aplikacja",
  admin: "Admin",
  searchPlaceholder: "Tytuł lub tag…",
  folder: "Folder",
  all: "Wszystkie",
  kind: "Rodzaj",
  kindText: "Tekstowe",
  kindCode: "Kod",
  kindHandwritten: "Odręczne",
  kindMindMaps: "Mapy myśli",
  filterButton: "Filtruj",
  filtersLabel: "Filtry",
  emptyPageTitle: "Pusta strona",
  emptyPageHeading: "Dalej już nic nie ma",
  backToStart: "Wróć na początek",
  favoritesEmptyHeading: "Nie masz jeszcze ulubionych notatek",
  favoritesEmptyAbout:
    "Naciśnij gwiazdkę przy dowolnej notatce, a jej skrót pojawi się tutaj. Sama notatka " +
    "zostaje tam, gdzie leżała.",
  emptyEyebrow: "Pusto",
  emptyHeading: "Jeszcze nic tu nie ma",
  emptyAbout:
    "Napisz notatkę tekstową albo plik z kodem na komputerze. Możesz też zsynchronizować " +
    "notatki z aplikacji na telefonie lub tablecie – wystarczy to samo konto.",
  textNote: "Notatka tekstowa",
  codeFile: "Plik z kodem",
  columnNote: "Notatka",
  columnKind: "Rodzaj",
  columnFolder: "Folder",
  columnSize: "Rozmiar",
  columnChanged: "Zmieniona",
  columnActions: "Działania",
  tagFavorite: "ulubiona",
  tagShared: "udostępniona",
  attachmentsWord: "załączników",
  versionWord: "wersja",
  openNote: "Otwórz notatkę",
  starIt: "Oznacz gwiazdką",
  unstarIt: "Zdejmij gwiazdkę",
  moveToTrash: "Wyrzuć do kosza",
  confirmTrash: "Wyrzucić do kosza?",
  pagerLabel: "Strony spisu notatek",
  earlier: "Wcześniejsze",
  next: "Następne",
  pageWord: "Strona",
  ofWord: "z",

  trashTitle: "Kosz – Kajet",
  trashAbout:
    "Wyrzucone notatki zostają tu, dopóki ich nie przywrócisz albo nie skasujesz na stałe. " +
    "Aplikacja na telefonie i tablecie usunie je u siebie przy następnej synchronizacji.",
  backToList: "Wróć do listy",
  emptyTrashButton: "Opróżnij kosz",
  confirmEmptyTrash: "Skasować na stałe wszystkie notatki z kosza?",
  trashEmptyHeading: "Kosz jest pusty",
  trashEmptyAbout: "Wyrzucone notatki wylądują tutaj.",
  columnTrashed: "Wyrzucona",
  restore: "Przywróć",
  forGood: "Na stałe",
  confirmPurge: "Skasować na stałe? Tego nie da się cofnąć.",
  trashPagerLabel: "Strony kosza",
  folderSettingsOf: "Ustawienia folderu",
  deleteFolder: "Skasuj folder",
  saveLook: "Zapisz wygląd",
  createFolderButton: "Utwórz folder",
  folderColourGroup: "Barwa folderu",
  folderIconGroup: "Ikona folderu",

  newNoteEyebrow: "Nowa notatka",
  newTextNoteTitle: "Notatka tekstowa",
  newTextNoteAbout: "Zapisana notatka pojawi się też na telefonie i tablecie.",
  newCodeNoteTitle: "Plik z kodem",
  newCodeNoteAbout:
    "Plik otworzysz i tutaj, i w aplikacji. Kod uruchomisz jednym przyciskiem.",
  newMindMapTitle: "Mapa myśli",
  newMindMapAbout: "Zapisaną mapę otworzysz na telefonie i tablecie.",
  newHandwritingTitle: "Notatka odręczna",
  newHandwritingAbout:
    "Pisz myszą albo rysikiem. Zapisaną notatkę zobaczysz na telefonie i tablecie.",
  createNoteButton: "Utwórz notatkę",
  createFileButton: "Utwórz plik",
  createMapButton: "Utwórz mapę",
  metaNewText: "Nowa notatka tekstowa – Kajet",
  metaNewCode: "Nowy plik z kodem – Kajet",
  metaNewMindMap: "Nowa mapa myśli – Kajet",
  metaNewHandwriting: "Nowa notatka odręczna – Kajet",
  codeDisabledHere: "Uruchamianie kodu jest tu wyłączone. Zapisywanie działa jak zwykle.",
  codeDisabledForAccount: "Administrator wyłączył uruchamianie kodu na Twoim koncie.",

  metaNoteNotFound: "Nie ma takiej notatki – Kajet",
  metaPageNotFound: "Nie ma takiej strony – Kajet",
  error404: "Błąd 404",
  noteNotFoundHeading: "Nie ma takiej notatki",
  noteNotFoundAbout:
    "Notatki spod tego adresu nie ma. Może była cudza, może wygasł odnośnik, a może po " +
    "prostu leży w koszu.",
  lookInTrash: "Zajrzyj do kosza",
  pageNotFoundHeading: "Nie ma takiej strony",
  pageNotFoundLead:
    "Może to literówka w adresie, może strona się przeniosła, a może pies zjadł tę " +
    "kartkę – jak kiedyś zadanie domowe. Twoim notatkom nic się nie stało: są tam, " +
    "gdzie zawsze.",
  pageNotFoundWrite: "A jeśli ta strona powinna istnieć,",
  pageNotFoundWriteLink: "napisz do nas",
  homePage: "Strona główna",
  sharedLinkNote:
    "Jeśli prowadził tu odnośnik do udostępnionej notatki, poproś o nowy – stare " +
    "przestają działać.",

  noteHandwritten: "Notatka odręczna",
  noteTextKind: "Notatka tekstowa",
  noteCodeKind: "Plik z kodem",
  changedWord: "Zmieniona",
  favoriteWord: "ulubiona",
  editing: "Edycja",
  editingMindMap: "Edycja mapy myśli",
  editingHandwriting: "Edycja odręczna",
  handwritingUnreadable:
    "Nie udało się otworzyć tej notatki. Nie zapisuj jej – inaczej stracisz to, co jest " +
    "w środku.",
  codeUnreadable: "Nie udało się odczytać treści pliku z kodem.",
  sharingEyebrow: "Udostępnianie",
  shareThisNote: "Udostępnij tę notatkę",
  shareAbout:
    "Odnośnik działa dla każdego, kto go dostanie, także bez konta. Udostępnienie na adres " +
    "e-mail otworzy tylko osoba zalogowana tym adresem.",
  shareButton: "Udostępnij",
  sharePreparing: "Przygotowuję…",
  whatTheyMayDo: "Co wolno drugiej osobie",
  readOnly: "Tylko czytać",
  readAndEdit: "Czytać i poprawiać",
  emailOptional: "Adres e-mail (możesz zostawić pusty)",
  orJustTheLink: "albo sam odnośnik",
  mailNotSet:
    "Poczta nie jest ustawiona, więc wiadomość nie wyjdzie. Odnośnik skopiujesz ze spisu " +
    "poniżej.",
  validForDays: "Ważne przez (dni)",
  zeroMeansForever: "Zero oznacza bez terminu.",
  allowWithoutAccount: "Pozwól otworzyć bez zakładania konta",
  alreadyShared: "Już udostępnione",
  columnWho: "Komu",
  columnRights: "Prawa",
  columnValidUntil: "Ważne do",
  byNameNeedsSignIn: "imiennie, wymaga zalogowania",
  linkWord: "odnośnik",
  rightEdit: "poprawianie",
  rightRead: "czytanie",
  expiredMark: " (termin minął)",
  noDeadline: "bez terminu",
  openedWord: "otwarte",
  revoke: "Cofnij",
  confirmRevoke: "Cofnąć to udostępnienie? Odnośnik przestanie działać.",
  inTrashWord: "W koszu",
  trashedWord: "Wyrzucona",
  noteInTrashAbout:
    "Ta notatka jest w koszu. Przywróć ją, żeby znów edytować, albo skasuj na stałe.",

  copyWord: "Kopiuj",
  copiedWord: "Skopiowane",
  copyLink: "Kopiuj odnośnik",
  linkCopied: "Skopiowany",
  justAMoment: "Chwileczkę…",
  confirmationLabel: "Potwierdzenie",
  areYouSure: "Na pewno?",
  emptyNoteText: "Ta notatka jest pusta.",
  deleteForGood: "Skasuj na stałe",
  confirmPurgeNote: "Skasować notatkę na stałe? Tego nie da się cofnąć.",
  confirmTrashNote: "Wyrzucić notatkę do kosza? Możesz ją później przywrócić.",
  addToFavorites: "Dodaj do ulubionych",
  removeFromFavorites: "Usuń z ulubionych",
  attachmentsEyebrow: "Załączniki",
  filesWithNote: "Pliki przy notatce",
  sendFile: "Wyślij plik",
  sendingFile: "Wysyłam…",
  fileLabel: "Plik",
  nameInNote: "Nazwa w notatce (opcjonalnie)",
  namePlaceholder: "np. zdjecie-1.png",
  columnName: "Nazwa",
  previewWord: "Podgląd",
  openInNewTab: "Otwórz w nowej karcie",
  removeAttachment: "Usuń załącznik",
  mindMapLabel: "Mapa myśli",
  noteUnreadableHere:
    "Nie udało się otworzyć tej notatki na stronie. Spróbuj w aplikacji – tam powinna " +
    "się pokazać.",

  codeFileNamePlaceholder: "np. zadanie1.py",
  codeWord: "Kod",
  savingWord: "Zapisuję…",
  previewEyebrow: "Podgląd",
  htmlPreviewFrame: "Podgląd strony HTML",
  runningEyebrow: "Uruchomienie",
  runOnServer: "Uruchom na serwerze",
  cannotRunHere: "Tego kodu nie uruchomisz na stronie. Zapisywanie działa jak zwykle.",
  standardInput: "Wejście standardowe (opcjonalnie)",
  stdinPlaceholder: "To, co program ma przeczytać…",
  exitCodeWord: "kod wyjścia",
  interruptedByTimeout: "przerwane (limit czasu)",

  inkColour: "Atrament",
  greyColour: "Szary",
  blueColour: "Niebieski",
  redColour: "Czerwony",
  greenColour: "Zielony",
  brownColour: "Brązowy",
  photoAlt: "zdjęcie",
  textLookToolbar: "Wygląd tekstu",
  heading1: "Nagłówek 1",
  heading2: "Nagłówek 2",
  heading3: "Nagłówek 3",
  bulletListHint: "Lista – Enter zaczyna kolejną pozycję",
  numberedListHint: "Lista numerowana – Enter numeruje dalej",
  taskListHint: "Lista zadań – kwadracik zaznaczysz kliknięciem",
  quoteWord: "Cytat",
  codeInText: "Kod w tekście",
  codeBlockWord: "Blok kodu",
  linkWord2: "Odnośnik",
  sendingPhoto: "Wysyłam zdjęcie…",
  insertPhotoInNote: "Wstaw zdjęcie w treść notatki",
  writeSomethingFirst: "Najpierw napisz coś – zdjęcie wstawisz do zapisanej notatki.",
  saveNoteFirst: "Najpierw zapisz notatkę – potem wstawisz zdjęcie.",
  formulaWord: "Wzór",
  wholeNoteFont: "Krój pisma całej notatki",
  wholeNoteSize: "Rozmiar pisma całej notatki",
  wholeNoteColour: "Kolor pisma całej notatki",
  defaultColour: "Kolor domyślny",
  alignLeft: "Do lewej",
  alignCentre: "Do środka",
  alignRight: "Do prawej",
  ownTextColour: "Własny kolor pisma",
  photoInNote: "Zdjęcie w notatce",
  shrinkPhoto: "Zmniejsz zdjęcie",
  growPhoto: "Powiększ zdjęcie",
  removePhotoFromNote: "Wyjmij zdjęcie z treści notatki",
  autosaveHint: "Notatka zapisuje się sama, kiedy przestaniesz pisać.",
  autosaveOffHint: "Autozapis jest wyłączony. Zapisz przyciskiem albo skrótem Ctrl+S.",

  penInk: "Atrament",
  penTeal: "Morski",
  penBurgundy: "Bordo",
  penBlue: "Niebieski",
  penHighlighter: "Zakreślacz",
  handwritingToolbar: "Odręczne",
  toolPen: "Pióro",
  toolFineliner: "Cienkopis",
  toolHighlighter: "Zakreślacz",
  toolEraser: "Gumka",
  toolPointer: "Wskaźnik – przesuwa zdjęcia",
  toolShapes: "Kształty – przeciągnij, żeby wstawić",
  undoLastStroke: "Cofnij ostatnią kreskę",
  undoLastThing: "Cofnij ostatnią rzecz",
  shapeLine: "Linia",
  shapeArrow: "Strzałka",
  shapeRect: "Prostokąt",
  shapeRoundRect: "Prostokąt zaokrąglony",
  shapeEllipse: "Elipsa",
  shapeTriangle: "Trójkąt",
  shapeDiamond: "Romb",
  shapeStar: "Gwiazda",
  shapeFillOn: "Wypełnienie kolorem obrysu",
  shapeFillOff: "Bez wypełnienia",
  shapeSquareLock: "Proporcje 1:1 – koło i kwadrat",
  shapeRemove: "Usuń kształt",
  addOwnColour: "Dołóż własny kolor",
  pickOwnColourNewSlot: "Dobierz własny kolor – dojdzie do palety",
  ownInkColour: "Własny kolor pisma",
  backgroundWord: "Tło",
  bgPlain: "Gładkie",
  bgLined: "W linie",
  bgGrid: "W kratkę",
  bgDots: "W kropki",
  bgStave: "Pięciolinia",
  pageButton: "Strona",
  clearPage: "Wyczyść stronę",
  confirmClearPage:
    "Wyczyścić wszystkie kreski na tej stronie? Pola tekstowe i obrazy zostaną.",
  uploadAndPlace: "Wyślij zdjęcie i połóż je na tej stronie",
  drawSomethingFirst: "Najpierw narysuj coś – zdjęcie wstawisz do zapisanej notatki.",
  uploadingWord: "Wysyłam…",
  photoWord: "Zdjęcie",
  photoToInsert: "Zdjęcie do wstawienia",
  choosePhoto: "Wybierz zdjęcie…",
  insertAgain: "Wstaw jeszcze raz",
  removeSelectedPhoto: "Usuń zaznaczone zdjęcie ze strony",
  previousPage: "Poprzednia strona",
  nextPage: "Następna strona",
  pageGrowsHint: "strona rośnie, kiedy piszesz przy dolnej krawędzi",
  handwritingCanvas: "Edytor odręczny",

  nodeGraphite: "Grafit",
  nodeTeal: "Morski",
  nodeBurgundy: "Bordo",
  nodeIndigo: "Indygo",
  nodeSunny: "Słoneczny",
  nodePlum: "Śliwka",
  fontBody: "Tekstowy",
  fontHeading: "Nagłówkowy",
  fontMono: "Maszynowy",
  newNodeText: "Nowy węzeł",
  mindMapToolbar: "Mapa myśli",
  nodeWord: "Węzeł",
  childWord: "Gałąź",
  besideWord: "Obok",
  pickTarget: "Wskaż cel…",
  pickSource: "Wskaż źródło…",
  connectWord: "Połącz",
  deleteNode: "Usuń węzeł",
  undoWord: "Cofnij",
  redoWord: "Ponów",
  arrangeWord: "Rozłóż",
  zoomOutWord: "Oddal",
  zoomInWord: "Przybliż",
  fitAll: "Zmieść całość",
  nodeLookToolbar: "Wygląd węzła",
  turnIntoRectangle: "Zamień na prostokąt",
  turnIntoOval: "Zamień na owal",
  nodeShape: "Kształt węzła",
  smallerTextWord: "Mniejsze pismo",
  largerTextWord: "Większe pismo",
  frameWord: "Ramka",
  ownFrameColour: "Własny kolor ramki węzła",
  writingWord: "Pismo",
  ownNodeTextColour: "Własny kolor pisma w węźle",
  expandBranch: "Rozwiń gałąź",
  collapseBranch: "Zwiń gałąź",
  nodeTextLabel: "Tekst węzła",
  mindMapCanvas: "Edytor mapy myśli",
  clickToRemoveEdge: "Kliknij, aby usunąć połączenie",
  mindMapHints:
    "kliknięcie dwa razy w węzeł zmienia tekst · Ctrl i przeciągnięcie przesuwa planszę · " +
    "Shift i kółko myszy przesuwa w bok · Tab dodaje gałąź, Delete usuwa węzeł",

  homeEyebrow: "Notatnik",
  homeTitleBefore: "Jeden ",
  homeTitleWord: "Kajet",
  homeTitleAfter: " na telefon, tablet i przeglądarkę.",
  homeLead:
    "Pismo odręczne, tekst, mapy myśli i kod w jednym notatniku. Piszesz w aplikacji, " +
    "a w przeglądarce robisz to samo na tym samym koncie.",
  haveInviteCode: "Mam kod zaproszenia",
  downloadForAndroid: "Pobierz na Androida",
  latestRelease: "Najnowsze wydanie aplikacji",
  skipToContent: "Przejdź do treści",
  homeKindsTitle: "Cztery rodzaje notatek",
  homeKindsIntro: "Każdy rodzaj otwierasz w aplikacji i na stronie. Wszystkie leżą w jednej bibliotece.",
  homeKindHandTitle: "Pismo odręczne",
  homeKindHandBody:
    "Pióro, cienkopis, zakreślacz, gumka i kształty. Na tablecie piszesz rysikiem, " +
    "a na stronie poprawisz notatkę myszką albo palcem. Kolory atramentu są te same tu i tam.",
  homeHandPicture:
    "Domek narysowany krzywo atramentem na kartce papieru; szczyt dachu z kominem " +
    "i dym wychodzą poza jej krawędź",
  homeKindTextTitle: "Tekst",
  homeKindTextBody:
    "Nagłówki, listy zadań, cytaty, tabele i zdjęcia w treści. Wszystko z jednego paska " +
    "nad polem pisania.",
  homeTextPicture:
    "Trzy linijki pisma odręcznego zapisane atramentem, z zamaszystym podkreśleniem " +
    "pod ostatnim słowem",
  homeKindMapTitle: "Mapa myśli",
  homeKindMapBody:
    "Węzły łączysz w gałęzie i rozsuwasz po kartce. Tab dodaje gałąź, Delete usuwa węzeł.",
  homeKindCodeTitle: "Kod",
  homeKindCodeBody:
    "Plik z kodem trzymasz w notatce i uruchamiasz go na serwerze. Dziewięć języków, " +
    "od Pythona po SQL.",
  homeCodePicture:
    "Ciemna kartka położona krzywo, a na niej konsola Pythona: polecenie print z napisem " +
    "Hello World i to samo Hello World wypisane pod spodem",
  homeWhereTitle: "Gdzie mają leżeć Twoje notatki?",
  homeNoAccountTitle: "Bez konta",
  homeNoAccountBody:
    "Aplikacja działa bez logowania. Notatki zostają na urządzeniu, w katalogu, który " +
    "wskażesz, jako zwykłe pliki. Żadna z nich nie wychodzi na serwer.",
  homeWithAccountTitle: "Z kontem",
  homeWithAccountBody:
    "Notatki trafiają na serwer. Otwierasz je na stronie i w aplikacji, a po zmianie " +
    "telefonu czy tabletu wracają same. Kosz, foldery i ulubione też są wspólne.",
  homeShareTitle: "Udostępnianie",
  homeShareBody:
    "Notatkę udostępniasz odnośnikiem albo wysyłasz na adres e-mail. Otwarty odnośnik " +
    "każdy przeczyta w przeglądarce, bez konta i bez aplikacji. Odbiorca dostaje podgląd " +
    "tylko do odczytu, a wysyłka na e-mail trafia do osoby z kontem na tym serwerze.",
  homeDownloadTitle: "Aplikacja na Androida",
  homeStepOne: "Pobierz plik na telefon.",
  homeStepTwo: "Zgódź się na instalację spoza sklepu Play. Telefon sam o to zapyta.",
  homeStepThree: "Otwórz pobrany plik i gotowe.",
  homeDownloadFacts:
    "Działa od Androida 8.0 wzwyż. Na stronie pobierania znajdziesz opis zmian " +
    "i starsze wydania.",
  homeDownloadPage: "Otwórz stronę pobierania",
  homeDownloadFile: "Pobierz plik",
  homeInviteTitle: "Konto na zaproszenie",
  homeInviteBody:
    "Konto zakładasz wyłącznie na kod zaproszenia. Kod dostaniesz od osoby prowadzącej " +
    "serwer.",

  metaSharedNote: "Udostępniona notatka – Kajet",
  linkEyebrow: "Odnośnik",
  cannotShowNote: "Nie możemy pokazać tej notatki",
  sharedNoteCaption: "udostępniona notatka",
  mayChangeIt: "masz prawo do zmian",
  readOnlyMark: "tylko do czytania",
  openAsOwner: "Otwórz jako właściciel",
  codeRunOwnerOnly:
    "Kod uruchamia tylko osoba, do której należy notatka. Zapisywanie działa jak zwykle.",
  thisIsAKajetNote: "To jest notatka z Kajetu.",
  seeWhatItIs: "Zobacz, o co chodzi",

  metaConfirm: "Potwierdzenie adresu – Kajet",
  emailAddressEyebrow: "Adres e-mail",
  goToSignIn: "Przejdź do logowania",
  backToRegister: "Wróć do rejestracji",
  noLinkHeading: "Brak odnośnika",
  noLinkBody:
    "Ten adres jest niepełny. Otwórz cały odnośnik prosto z wiadomości e-mail.",
  linkDeadHeading: "Odnośnik już nie działa",
  linkDeadBody:
    "Ten odnośnik został już użyty albo jest nieprawidłowy. Jeśli konto działa, po prostu " +
    "się zaloguj.",
  linkExpiredHeading: "Odnośnik wygasł",
  linkExpiredBody:
    "Odnośnik był ważny przez dobę. Zaloguj się i poproś o nowe potwierdzenie w " +
    "ustawieniach konta.",
  addressConfirmed: "Adres potwierdzony",

  metaDownload: "Kajet na Androida – do pobrania",
  androidAppCaption: "aplikacja na Androida",
  toDownload: "Do pobrania",
  downloadLead:
    "Notatnik na telefon i tablet: pismo odręczne, tekst, mapy myśli i kod. Po zalogowaniu " +
    "tym samym kontem notatki są te same tutaj i w aplikacji.",
  downloadWord: "Pobierz",
  publishedWord: "wystawione",
  whatChanged: "Co się zmieniło",
  noAppYet: "Aplikacji jeszcze tu nie ma",
  noAppYetBody:
    "Administrator tego serwera nie udostępnił jeszcze żadnej wersji. Sama strona działa " +
    "normalnie – notatki otworzysz w przeglądarce.",
  howToInstall: "Jak to zainstalować",
  howToInstallBody:
    "Plik nie pochodzi ze sklepu Google, więc telefon poprosi o zgodę. Po pobraniu otwórz " +
    "plik i pozwól przeglądarce instalować aplikacje z tego źródła – Android nazywa to " +
    "„instalowaniem nieznanych aplikacji”. Kolejne wersje wystarczy pobrać stąd i otworzyć, " +
    "a notatki zostaną na miejscu.",
  olderVersions: "Starsze wersje",

  metaRegister: "Załóż konto – Kajet",
  newAccountEyebrow: "Nowe konto",
  createAccountHeading: "Załóż konto w Kajecie",
  registerLead:
    "Konto zakłada się na kod od administratora. Jeśli go nie masz, poproś o niego osobę, " +
    "która prowadzi ten serwer. Bez konta też możesz pisać w aplikacji – notatki zostają " +
    "wtedy tylko na urządzeniu.",
  haveAccountAlready: "Masz już konto?",
  inviteCode: "Kod zaproszenia",
  inviteCodePlaceholder: "np. KAJET-7QX2-9MB4",
  codeCameFromLink: "Kod wpisał się sam z odnośnika.",
  loginOptional: "Login (możesz zostawić pusty)",
  loginPlaceholder: "utworzymy go z adresu e-mail",
  loginIsVisible: "Login widzą osoby, którym udostępnisz notatkę.",
  atLeastEightChars: "Co najmniej osiem znaków.",
  repeatPassword: "Powtórz hasło",
  creatingAccount: "Zakładam konto…",
  createAccountButton: "Załóż konto",
  preferGoogle: "Wolę konto Google",
  googleAccountEyebrow: "Konto Google",
  googleAccountAbout:
    "Wpisz kod zaproszenia. Sprawdzimy go i przeniesiemy Cię do Google. Konto powstanie " +
    "na tym adresie, którym zalogujesz się u nich – nie musisz go tutaj wpisywać.",
  checkingCode: "Sprawdzam kod…",
  onWithGoogle: "Dalej przez Google",

  metaNewPassword: "Nowe hasło – Kajet",
  newPasswordEyebrow: "Nowe hasło",
  setNewPasswordHeading: "Ustaw nowe hasło",
  newPasswordAbout:
    "Po zmianie wylogujemy wszystkie urządzenia, więc zaloguj się na nowo także " +
    "w aplikacji na telefonie i tablecie.",
  saveNewPassword: "Zapisz nowe hasło",
  newPasswordLabel: "Nowe hasło",
  linkDeadHeading2: "Ten odnośnik już nie działa",
  linkOneHourAbout:
    "Odnośnik jest ważny przez godzinę i działa jeden raz. Poproś o nowy formularzem poniżej.",
  passwordEyebrow: "Hasło",
  forgotPasswordHeading: "Nie pamiętam hasła",
  forgotPasswordAbout:
    "Podaj adres, na który masz konto. Wyślemy odnośnik do ustawienia nowego hasła.",
  mailNotSetHere:
    "Poczta na tym serwerze nie jest ustawiona, więc wiadomość nie wyjdzie. Poproś " +
    "administratora o pomoc.",
  sendLinkButton: "Wyślij odnośnik",
  sendingWord: "Wysyłam…",
  backToSignIn: "Wróć do logowania",

  metaConnectDevice: "Połącz urządzenie – Kajet",
  appEyebrow: "Aplikacja",
  noCodeHeading: "Brak kodu",
  noCodeAbout:
    "Otwórz tę stronę z aplikacji Kajet przyciskiem „Zaloguj przez Google”. Bez kodu " +
    "z aplikacji nie da się połączyć urządzenia.",
  ordinarySignIn: "Zwykłe logowanie do panelu",
  mobileAppEyebrow: "Aplikacja mobilna",
  connectDeviceHeading: "Połącz urządzenie",
  codeExpiredAbout:
    "Ten kod logowania wygasł albo został już użyty. Wróć do aplikacji i uruchom " +
    "logowanie jeszcze raz.",
  signInDenied: "To logowanie zostało wcześniej odrzucone.",
  openTheApp: "Otwórz aplikację",
  orStayInPanel: "Albo zostań w panelu",
  deviceFallback: "Urządzenie",
  connecting: "Łączę…",
  denying: "Odrzucam…",
  notMeDeny: "To nie ja – odrzuć",
  afterApprovalAbout:
    "Po zatwierdzeniu aplikacja zaloguje się sama, w ciągu kilku sekund. Możesz też " +
    "wrócić do niej przyciskiem „Otwórz aplikację”, gdy się pojawi.",

  adminPanelLink: "Panel administratora",
  profileEyebrow: "Profil",
  roleWord: "Rola",
  roleAdmin: "Administrator",
  roleUser: "Użytkownik",
  signInOnSite: "Logowanie na stronie",
  viaPassword: "hasło",
  viaSession: "sesja (bez hasła)",
  lastSignIn: "Ostatnie logowanie",
  notedNever: "jeszcze nie odnotowane",
  accountSince: "Konto od",
  noteList: "Spis notatek",
  spaceEyebrow: "Miejsce",
  limitValidUntil: "limit obowiązuje do",
  spaceRunningOut:
    "Miejsce się kończy. Opróżnij kosz albo poproś administratora o większy limit.",
  writingEyebrow: "Pisanie",
  howIWriteHere: "Pisanie na stronie",
  writingLead:
    "Te ustawienia zapisują się przy koncie, więc obowiązują w każdej przeglądarce. Krój, " +
    "rozmiar i wyrównanie dotyczą nowych notatek. Wygląd otwartej notatki zmienisz " +
    "paskiem nad tekstem.",
  saveSettings: "Zapisz ustawienia",
  autoSaveTitle: "Autozapis",
  autoSaveAbout:
    "Włączony: notatka zapisuje się sama, kiedy przestaniesz pisać. Wyłączony: zapisujesz " +
    "ją przyciskiem „Zapisz” albo skrótem Ctrl+S.",
  boldFontTitle: "Grubsze pismo",
  boldFontAbout:
    "Grubsze pismo w polu do pisania – łatwiej je czytać. Sama notatka zostaje bez zmian.",
  fontOfNewNote: "Krój nowej notatki",
  textSizeLabel: "Rozmiar pisma",
  zeroMeansDefault: "Zero oznacza rozmiar domyślny",
  alignmentLabel: "Wyrównanie",
  deviceTokensEyebrow: "Tokeny urządzeń",
  tokenSignIn: "Logowanie przez token",
  tokenSignInAbout:
    "W aplikacji zwykle wystarczy adres e-mail i hasło. Token przydaje się wtedy, gdy " +
    "konto powstało przez Google i nie ma jeszcze hasła – albo gdy wolisz nie wpisywać " +
    "hasła na cudzym urządzeniu.",
  issueToken: "Wydaj token",
  issuingToken: "Wydaję…",
  deviceName: "Nazwa urządzenia",
  deviceNamePlaceholder: "np. telefon, tablet, laptop",
  lastUseWord: "ostatnio użyty",
  saveName: "Zapisz nazwę",
  issuedWord: "wydany",
  neverUsed: "jeszcze nie użyty",
  revokeToken: "Unieważnij",
  confirmRevokeToken:
    "Unieważnić ten token? Aplikacja na tym urządzeniu poprosi o ponowne zalogowanie.",
  revokeAllTokens: "Unieważnij wszystkie tokeny",
  confirmRevokeAll:
    "Unieważnić wszystkie tokeny? Każde urządzenie będzie musiało zalogować się od nowa.",
  noTokensYet:
    "Nie ma jeszcze żadnego tokenu. Wydaj jeden, jeśli logujesz się w aplikacji bez hasła.",
  loginEyebrow: "Login",
  accessEyebrow: "Dostęp",
  saveLogin: "Zapisz login",
  passwordChangeAbout:
    "Zmiana hasła wylogowuje konto wszędzie: z tej przeglądarki, z pozostałych przeglądarek " +
    "i ze wszystkich urządzeń z aplikacją. Zaraz po zmianie zalogujesz się nowym hasłem.",
  passwordSetAbout:
    "To konto nie ma jeszcze hasła (zakładane przez Google). Ustaw hasło, jeśli chcesz " +
    "logować się w aplikacji mobilnej adresem i hasłem zamiast tokenem. Ustawienie hasła " +
    "wylogowuje konto wszędzie.",
  changePasswordButton: "Zmień hasło",
  setPasswordButton: "Ustaw hasło",
  currentPassword: "Dotychczasowe hasło",
  repeatNewPassword: "Powtórz nowe hasło",
  signOutEyebrow: "Wylogowanie",
  signOutAbout:
    "Zwykłe wylogowanie zamyka tylko tę przeglądarkę – pozostałe przeglądarki i aplikacje " +
    "na urządzeniach działają dalej.",
  signOutThisBrowser: "Wyloguj się z tej przeglądarki",
  signOutEverywhere: "Wyloguj wszędzie",
  signOutEverywhereTitle: "Zamyka konto na wszystkich urządzeniach naraz",
  signOutEverywhereAbout:
    "„Wyloguj wszędzie” zamyka wszystkie przeglądarki i unieważnia wszystkie tokeny " +
    "aplikacji – dokładnie to samo dzieje się przy zmianie hasła. Notatki zapisane na " +
    "urządzeniach zostają na miejscu.",

  metaAdmin: "Panel administratora – Kajet",
  adminCaption: "panel administratora",
  adminOverview: "Przegląd",
  adminAccounts: "Konta",
  adminCodes: "Kody zaproszeń",
  adminApp: "Aplikacja",
  adminLog: "Dziennik",
  serverState: "Stan serwera",
  statAccounts: "Konta",
  statNotes: "Notatki",
  statNotesNote: "poza koszem",
  statSpace: "Zajęte miejsce",
  statSpaceNote: "razem na wszystkich kontach",
  statFreeCodes: "Niewykorzystane kody",
  statFreeCodesNote: "jeszcze ważne",
  lastWeekEyebrow: "Ostatni tydzień",
  statNewAccounts: "Nowe konta",
  statNotesToday: "Notatki dziś",
  statCrashes: "Awarie aplikacji",
  statFreeSpace: "Wolne miejsce",
  statFreeSpaceNote: "na dysku serwera",
  unknownWord: "nie wiadomo",
  worthCheckingEyebrow: "Do sprawdzenia",
  serverNearlyFullTitle: "Serwer jest prawie pełny",
  diskUnderLimitTitle: "Na dysku jest mniej miejsca niż w granicy serwera",
  mailOffTitle: "Poczta wychodząca nie jest ustawiona",
  noSmtpHint:
    "Bez SMTP nie wysyłamy zaproszeń, potwierdzeń ani powiadomień o udostępnieniu. " +
    "Odnośniki nadal da się kopiować ze strony.",
  googleOffTitle: "Logowanie przez Google jest wyłączone",
  googleEnvHint: "Uzupełnij AUTH_GOOGLE_ID i AUTH_GOOGLE_SECRET w pliku .env.",
  noReleaseTitle: "Aplikacja nie jest wystawiona",
  noReleaseHint:
    "Dopóki nic tu nie ma, strona /download informuje odwiedzających, że aplikacji nie ma " +
    "jeszcze do pobrania. Wystawisz ją w zakładce „Aplikacja”.",
  codeOffTitle: "Uruchamianie kodu nie działa",
  codeOffHint:
    "Dopóki to nie działa, aplikacja informuje użytkowników, że uruchamianie jest " +
    "niedostępne. Kod nadal da się pisać i zapisywać.",
  issueInviteCode: "Wydaj kod zaproszenia",
  manageAccounts: "Zarządzaj kontami",
  publishApp: "Wystaw aplikację",

  accountsLead:
    "Limit zero oznacza miejsce bez ograniczeń. Limit podany na określoną liczbę dni wraca " +
    "po terminie do poprzedniej wartości.",
  searchAccountPlaceholder: "Login lub e-mail…",
  clearWord: "Wyczyść",
  tagAdministrator: "administrator",
  tagBlocked: "zablokowane",
  tagNoCodeRunning: "bez uruchamiania kodu",
  tagAiAllowed: "KajetAI",
  accountSinceShort: "konto z",
  blockReasonLabel: "Powód blokady",
  quotaSection: "Limit miejsca",
  setQuota: "Ustaw limit",
  quotaInMb: "Limit w MB",
  forHowManyDays: "Na ile dni",
  quotaHint: "Zero megabajtów oznacza miejsce bez ograniczeń, zero dni – limit na stałe.",
  changeLogin: "Zmień login",
  newLogin: "Nowy login",
  changeEmail: "Zmień e-mail",
  newEmail: "Nowy adres e-mail",
  sendPasswordLink: "Wyślij odnośnik do zmiany hasła",
  setPasswordForUser: "Ustaw hasło",
  atLeast8Placeholder: "Co najmniej 8 znaków",
  unblockAccount: "Odblokuj konto",
  blockAccount: "Zablokuj konto",
  blockReasonPlaceholder: "Powód (opcjonalnie)",
  blockReasonAria: "Powód blokady",
  takeAdminRights: "Odbierz uprawnienia",
  makeAdmin: "Zrób administratorem",
  takeCodeRunning: "Zabierz uruchamianie kodu",
  allowCodeRunning: "Pozwól uruchamiać kod",
  takeAiAccess: "Zabierz KajetAI",
  allowAiAccess: "Pozwól korzystać z KajetAI",
  aiSection: "KajetAI",
  aiDailyLimitLabel: "Wywołań na dobę",
  setAiLimit: "Ustaw limit",
  aiLimitHint: "Zero oznacza limit domyślny.",
  aiNoUsageYet: "To konto jeszcze o nic nie prosiło.",
  recomputeStorage: "Przelicz miejsce",
  deleteAccount: "Skasuj konto",

  newCodeEyebrow: "Nowy kod",
  issueInviteCodeHeading: "Wydaj kod zaproszenia",
  codesLead:
    "Kod na jedno miejsce to zwykłe zaproszenie dla jednej osoby. Większa liczba miejsc " +
    "przydaje się, gdy zapraszasz całą klasę jednym kodem.",
  issueCode: "Wydaj kod",
  issuingCode: "Wydaję…",
  howManyAccounts: "Na ile kont",
  quotaMbLabel: "Limit miejsca w MB",
  codeGrantsAi: "Z KajetAI",
  codeGrantsAiHint:
    "Konto założone tym kodem od razu będzie mogło prosić KajetAI o zmiany w notatkach. " +
    "Model jest darmowy, więc Google może wykorzystać wysłaną treść do uczenia swoich modeli.",
  validForDaysLabel: "Ważny przez (dni)",
  mailNotSetCodes:
    "Poczta nie jest ustawiona, więc wiadomość nie wyjdzie. Odnośnik skopiujesz ze spisu " +
    "poniżej.",
  descriptionForYou: "Opis (dla Ciebie)",
  descriptionPlaceholder: "np. klasa 2B, wrzesień",
  issuedCodes: "Wydane kody",
  noCodesYet: "Nie ma jeszcze żadnego kodu. Wydaj pierwszy formularzem powyżej.",
  columnCode: "Kod",
  columnUse: "Wykorzystanie",
  columnAccountQuota: "Limit konta",
  columnValidTo: "Ważny do",
  columnDescription: "Opis",
  copyCode: "Kopiuj kod",
  tagSpent: "wykorzystany",
  tagExpired: "przeterminowany",
  tagFree: "niewykorzystany",
  usedByWord: "wykorzystany przez",
  defaultWord: "domyślny",
  confirmDeleteCode:
    "Skasować ten kod? Kto go jeszcze nie wykorzystał, nie założy już konta.",

  logLead: "Ostatnie dwieście czynności administratorów.",
  logEmpty: "Dziennik jest pusty. Wpisy pojawią się po pierwszej czynności w panelu.",
  columnWhen: "Kiedy",
  columnWho2: "Kto",
  columnAction: "Czynność",
  columnDetails: "Szczegóły",
  deletedAccount: "konto skasowane",

  adminCrashes: "Awarie",
  metaAdminCrashes: "Awarie aplikacji – Kajet",
  crashesLead:
    "Raporty z aplikacji na Androida. Ta sama awaria zgłoszona wiele razy stoi w jednym " +
    "wierszu.",
  crashesEmpty: "Nie przyszedł jeszcze żaden raport o awarii.",
  columnHowMany: "Ile razy",
  columnDevice: "Urządzenie",
  crashShowReport: "Pokaż cały raport",
  crashNoAccount: "bez konta",

  metaAdminApp: "Aplikacja na Androida – Kajet",
  newReleaseEyebrow: "Nowe wydanie",
  publishAppHeading: "Wystaw aplikację do pobrania",
  publishAppLead:
    "Wgrany plik trafia na stronę pobierania, skąd pobierze go każdy, kto chce mieć Kajet " +
    "na telefonie. Aplikacja sprawdza numer wydania na serwerze i sama informuje " +
    "o dostępnej aktualizacji.",
  publishedReleases: "Wystawione wydania",
  noReleasesYet:
    "Nie ma jeszcze żadnego wydania. Strona pobierania informuje odwiedzających, że " +
    "aplikacji nie ma jeszcze do pobrania.",
  columnVersion: "Wersja",
  columnFile: "Plik",
  columnDownloads: "Pobrania",
  columnPublished: "Wystawione",
  releaseNumberWord: "numer wydania",
  tagDownloadable: "do pobrania",
  publishedByWord: "wystawił",
  makeCurrent: "Wystaw",
  confirmDeleteRelease: "Skasować to wydanie? Plik zniknie z dysku serwera.",
  apkFileLabel: "Plik aplikacji (APK)",
  versionLabel: "Wersja",
  versionPlaceholder: "np. 1.4.2",
  versionHint: "Numer widoczny dla użytkownika – to samo, co versionName w aplikacji.",
  releaseNumberLabel: "Numer wydania",
  releaseNumberHint:
    "Numer odczytany z pliku. Po nim aplikacja poznaje, że jest starsza, więc nie da się " +
    "go tu podmienić.",
  readFromFile: "odczytane z pliku",
  couldNotReadRelease:
    "Nie udało się odczytać wersji z tego pliku. Wpisz numer wydania i wersję ręcznie, " +
    "dokładnie takie same jak w aplikacji – inaczej nikt nie dostanie powiadomienia " +
    "o aktualizacji.",
  whatChangedLabel: "Co się zmieniło",
  releaseNotesPlaceholder: "Możesz zostawić puste. Ten opis widzą pobierający.",
  replacePreviousHint:
    "Zostaje wtedy tylko to jedno wydanie. Odznacz, jeśli chcesz móc wrócić do poprzedniego.",
  publishRelease: "Wystaw wydanie",
  nginxTooBig:
    "Nginx odrzucił plik jako za duży. Podnieś client_max_body_size w jego ustawieniach.",
  connectionDropped2: "Połączenie urwało się w trakcie wysyłania.",
  uploadAborted: "Wysyłanie przerwane.",
  pickApkFile: "Wskaż plik APK z aplikacją.",
  sendingFileStage: "Wysyłam plik…",
  savingReleaseStage: "Zapisuję wydanie…",
  uploadFailed: "Nie udało się wysłać.",

  metaSignIn: "Zaloguj się – Kajet",
  signInEntrance: "Wejście",
  signInLead:
    "Po zalogowaniu zobaczysz swoje notatki – tutaj je przeczytasz i poprawisz.",
  signInWithGoogleButton: "Zaloguj się przez Google",
  googleInAppHint:
    "W aplikacji zalogujesz się przez Google, hasłem albo tokenem ze strony konta.",
  noAccountAsk: "Nie masz konta?",
  registerOnCode: "Załóż je na kod zaproszenia",
  signInBlocked: "To konto zostało zablokowane. Napisz do administratora.",
  signInCodeRequired:
    "Na ten adres nie ma jeszcze konta. Nowe konto Google zakłada się na stronie " +
    "rejestracji: wpisz tam kod od administratora, a przejdziemy do Google od razu po " +
    "jego sprawdzeniu.",
  signInNotLinked:
    "Ten adres jest już używany przy logowaniu hasłem. Zaloguj się hasłem, a potem możesz " +
    "powiązać Google.",
  signInConfiguration:
    "Logowanie przez Google nie działa na tym serwerze. Zaloguj się hasłem albo napisz " +
    "do administratora.",
  signInAccessDenied: "Google nie pozwoliło na logowanie, albo to konto nie ma dostępu.",
  signInOAuthStart: "Nie udało się rozpocząć logowania przez Google. Spróbuj jeszcze raz.",
  signInOAuthCallback:
    "Google nie dokończyło logowania. Spróbuj jeszcze raz. Jeśli błąd wraca, napisz do " +
    "administratora – to ustawienie po stronie serwera.",
  signInOAuthCreate:
    "Nie udało się założyć konta przez Google. Spróbuj jeszcze raz albo załóż konto hasłem " +
    "na kodzie zaproszenia.",
  signInInterrupted: "Logowanie zostało przerwane. Spróbuj jeszcze raz.",
  signInVerification: "Odnośnik do logowania wygasł albo został już użyty.",
  signInDefault: "Nie udało się zalogować. Spróbuj jeszcze raz.",
  byeEverywhere:
    "Wylogowano ze wszystkich urządzeń. Aplikacje na telefonie i tablecie poproszą " +
    "o ponowne zalogowanie. Notatki zapisane na urządzeniach zostały na miejscu.",
  byePasswordChanged:
    "Hasło zmienione. Dla bezpieczeństwa konto zostało wylogowane wszędzie – zaloguj się " +
    "nowym hasłem.",
  byePasswordSet:
    "Hasło ustawione. Zaloguj się nim teraz; tego samego hasła użyjesz w aplikacji na telefonie.",
  siteDescription:
    "Notatnik na telefon, tablet i przeglądarkę. Pismo odręczne, tekst, mapy myśli i kod " +
    "– w jednym miejscu.",
  sendStraightTo: "Wyślij od razu na adres",
  searchAccountLabel: "Szukaj konta",
  deleteOlderReleases: "Skasuj starsze wydania – z bazy i z dysku",

  apiDbBehind:
    "Serwer jest w trakcie aktualizacji i na razie nie przyjmuje notatek. Twoje notatki " +
    "na urządzeniu są bezpieczne. Jeśli to potrwa, napisz do administratora.",
  apiNoDatabase: "Serwer nie ma połączenia ze swoją bazą danych. Spróbuj za chwilę.",
  apiUnexpected: "Nieoczekiwany błąd serwera.",
  apiCrashTooOften: "Za dużo raportów o awariach naraz. Spróbuj za kilka minut.",
  apiCrashTooBig: "Raport o awarii jest za duży.",
  apiCrashUnreadable: "Nie da się odczytać raportu o awarii.",
  apiVersionTooOften: "Za dużo pytań o aktualizację naraz. Spróbuj za kilka minut.",
  apiNotSignedIn: "Nie jesteś zalogowany. Zaloguj się w ustawieniach aplikacji.",
  apiTokenDead: "Ten token już nie działa. Zaloguj się jeszcze raz.",
  apiTokenExpired: "Token wygasł. Zaloguj się jeszcze raz.",
  apiAccountBlocked: "To konto zostało zablokowane. Napisz do administratora.",
  apiIdentityFailed: "Nie udało się potwierdzić tożsamości.",
  apiMustSignIn: "Musisz się zalogować.",
  apiNoteNotYours: "Ta notatka należy do kogoś innego.",
  apiFolderNotYours: "Ten folder należy do kogoś innego.",
  apiLinkDead: "Ten odnośnik już nie działa albo notatka została skasowana.",
  apiLinkExpired: "Ten odnośnik wygasł. Poproś o nowy.",
  apiShareReadOnly: "Ten odnośnik pozwala tylko czytać, więc zmiany nie zostały zapisane.",
  apiSharedByName:
    "Ta notatka jest udostępniona imiennie. Zaloguj się adresem, na który przyszła wiadomość.",
  apiSharedToSomeoneElse:
    "Ta notatka jest udostępniona komuś innemu. Zaloguj się właściwym adresem.",
  apiSignInToOpen: "Żeby otworzyć tę notatkę, musisz się zalogować.",
  ownerWord: "Właściciel",
  guestWord: "Gość",
  unknownDeviceWord: "Nieznane urządzenie",
  apiChallengeGone: "Ten kod logowania nie istnieje albo już wygasł.",
  apiChallengeExpiredAskApp: "Ten kod logowania wygasł. Poproś aplikację o nowy.",
  apiChallengeDenied: "To logowanie zostało odrzucone.",
  apiChallengeOtherAccount: "Ten kod został już zatwierdzony na innym koncie.",
  apiChallengeExpired: "Ten kod logowania wygasł.",
  apiChallengeWrongAccount: "Ten kod należy do innego konta.",
  apiPreviewBelow: "Podgląd znajdziesz pod polem z kodem.",
  apiRunningOff: "Uruchamianie kodu jest na tym serwerze wyłączone.",
  apiRunFailed: "Nie udało się uruchomić programu.",
  apiRunnerBroken: "Uruchamianie kodu na tym serwerze nie działa. Szczegóły są w dzienniku serwera.",
  apiInstallDocker: "Zainstaluj Dockera albo wyłącz uruchamianie w ustawieniach serwera.",
  apiNoDockerRights: "Konto, na którym działa Kajet, nie ma uprawnień do Dockera. ",
  apiOffInServerSettings: "Wyłączone w ustawieniach serwera.",
  apiRunnerReady: "Gotowe do uruchamiania kodu.",
  apiConflict:
    "Ta notatka zmieniła się w innym miejscu. Twoja zmiana nie została zapisana, żeby nic " +
    "nie przepadło.",
  apiNoteWithoutBody:
    "Serwer nie dostał treści tej notatki. Zaktualizuj aplikację i spróbuj zsynchronizować " +
    "jeszcze raz.",
  apiTrashFirst: "Najpierw wyrzuć notatkę do kosza, potem możesz ją skasować na stałe.",
  apiGiveAttachmentName: "Podaj nazwę załącznika.",
  apiNoSuchAttachment: "Nie ma takiego załącznika.",
  apiNoSuchAccount: "Nie ma takiego konta.",
  apiFileGoneFromDisk: "Tego pliku już nie ma. Napisz do administratora.",
  apiNoSuchCode: "Nie ma takiego kodu. Przepisz go jeszcze raz, co do znaku.",
  apiCodeExpired: "Ten kod już wygasł. Poproś administratora o nowy.",
  apiCodeUsedUp: "Ten kod został już wykorzystany. Poproś administratora o nowy.",
  apiBadRequest: "Coś się popsuło po drodze. Spróbuj jeszcze raz.",
  apiGiveDeviceName: "Podaj nazwę urządzenia.",
  apiSignInDenied:
    "To logowanie zostało odrzucone w przeglądarce. Jeśli chcesz się zalogować, zacznij " +
    "od nowa.",
  apiCodeExpiredOrUsed:
    "Kod logowania wygasł albo został już użyty. Spróbuj jeszcze raz w aplikacji.",
  apiGiveEmailAndPassword: "Podaj adres e-mail i hasło.",
  apiWrongCredentials: "Zły adres albo złe hasło.",
  apiUploadUnreadable: "Nie udało się odczytać wysyłanego pliku.",
  apiFileKindRefused: "Takiego pliku nie przyjmujemy. Wyślij zdjęcie albo rysunek.",
  apiFileContentMismatch:
    "Zawartość pliku nie zgadza się z jego rodzajem. Wyślij zdjęcie albo rysunek.",
  apiFileSaveFailed: "Nie udało się zapisać pliku.",
  apiGiveAttachmentToDelete: "Podaj nazwę załącznika do skasowania.",
  apiUnknownShape:
    "Ta wersja aplikacji jest nowsza niż serwer. Poproś administratora o aktualizację serwera.",
  apiNoteUnknownShape:
    "Serwer nie umie jeszcze zapisać takiej notatki. Poproś administratora o aktualizację " +
    "serwera.",
  apiFolderUnknownShape:
    "Serwer nie umie jeszcze zapisać takiego folderu. Poproś administratora o aktualizację " +
    "serwera.",
  apiNoteNotOnServer:
    "Tej notatki nie ma jeszcze na serwerze. Zsynchronizuj ją i spróbuj jeszcze raz.",
  apiCodeRunningOffForAccount: "Administrator wyłączył uruchamianie kodu na tym koncie.",
  apiCodeRunningOffKeepWriting:
    "Administrator wyłączył uruchamianie kodu na tym koncie. Kod nadal możesz pisać i zapisywać.",
  apiGiveLanguageAndCode: "Podaj język i kod do uruchomienia.",
  apiNothingToRun: "Nie ma czego uruchomić.",
  apiUnknownAddress:
    "Ten serwer nie ma tej funkcji. Zaktualizuj aplikację albo sprawdź adres serwera " +
    "w ustawieniach.",
  apiAiNoConsent:
    "KajetAI wysyła treść notatki do Google i wymaga Twojej zgody. Potwierdzisz ją " +
    "w ustawieniach konta.",
  apiAiWrongKind:
    "KajetAI pracuje przy notatkach tekstowych, mapach myśli i kodzie. Przy odręcznej nie " +
    "ma czego czytać.",
  apiAiNoInstruction: "Napisz, co KajetAI ma zmienić w notatce.",
  apiAiTimeout:
    "KajetAI nie odpowiedział na czas. Notatka została nietknięta – spróbuj jeszcze raz.",
  apiAiBusy:
    "Google nie przyjmuje dziś więcej zapytań od KajetAI. Spróbuj później – notatka " +
    "została nietknięta.",
  apiAiBroken: "KajetAI nie połączył się z Google. Notatka została nietknięta.",
  apiAiNoAnswer: "KajetAI nie zaproponował żadnej zmiany. Napisz polecenie inaczej.",
  apiAiHistoryCleared: "Rozmowa z KajetAI przy tej notatce została wyczyszczona.",
  // Napisy przepisane znak w znak z aplikacji (Words.kt), żeby obie strony
  // mówiły w tej sprawie jednym zdaniem.
  aiTitle: "KajetAI",
  aiHint: "Co zmienić w tej notatce?",
  aiAsk: "Poproś",
  aiWorking: "KajetAI pracuje nad notatką…",
  aiUndo: "Cofnij zmianę",
  aiUndone: "Zmiana cofnięta.",
  aiUndoFailed: "Nie udało się cofnąć. Notatka została taka, jak ją zmienił KajetAI.",
  aiNoteNotSavedYet:
    "Nie udało się zapisać tej notatki, więc KajetAI nie ma jeszcze czego przeczytać. "
    + "Zapisz ją i spróbuj jeszcze raz.",
  aiQuestionLabel: "KajetAI pyta",
  aiHistoryTitle: "Wcześniejsze polecenia",
  aiHistoryEmpty: "Przy tej notatce jeszcze o nic nie proszono.",
  aiForgetHistory: "Wyczyść rozmowę",
  aiNeedsConsent:
    "KajetAI wysyła treść notatki do Google i wymaga Twojej zgody. Model jest darmowy, " +
    "więc Google może wykorzystać wysłaną treść do uczenia swoich modeli.",
  aiGoToAccount: "Przejdź do ustawień konta",
  aiConsentSection: "Asystent KajetAI",
  aiConsentWhatHappens:
    "Kiedy poprosisz KajetAI o zmianę, treść notatki – cały tekst, kod albo napisy " +
    "w węzłach mapy – zostanie wysłana do Google, bo to jego model wprowadza zmiany. " +
    "Pismo odręczne i zdjęcia nie są wysyłane.",
  aiConsentTraining:
    "Model jest darmowy, więc Google może wykorzystać wysłaną treść do uczenia swoich " +
    "modeli, a jego pracownik może ją przeczytać. Nie wysyłaj notatek, które mają " +
    "zostać prywatne.",
  aiConsentVoluntary:
    "Zgoda jest dobrowolna i wycofasz ją w każdej chwili. Bez niej KajetAI nie działa, " +
    "a reszta Kajetu działa tak samo jak dotąd.",
  aiConsentGiven: "Zgoda na wysyłanie treści notatek do Google jest udzielona.",
  aiConsentAgree: "Zgadzam się",
  aiConsentWithdraw: "Wycofaj zgodę",
  aiConsentWithdrawn: "Zgoda wycofana. Rozmowy z KajetAI zostały skasowane.",
  aiNoQuestionAsked: "KajetAI chciał o coś dopytać, ale nie podał pytania.",
  aiUnknownTool: "KajetAI sięgnął po narzędzie, którego przy tej notatce nie ma.",
  aiTextUnsavable: "KajetAI oddał treść w kształcie, którego nie da się zapisać.",
  aiTextUnchanged: "KajetAI nie zmienił w notatce niczego.",
  aiCodeUnsavable: "KajetAI oddał kod w kształcie, którego nie da się zapisać.",
  aiCodeUnchanged: "KajetAI nie zmienił w kodzie niczego.",
  aiMapUnsavable: "KajetAI oddał zmiany w mapie w kształcie, którego nie da się zapisać.",
  aiCodeNoteUnreadable: "Nie udało się odczytać notatki z kodem.",
  aiMindMapUnreadable: "Nie udało się odczytać mapy myśli.",
  aiMapNoOperations: "KajetAI nie podał żadnej zmiany do wykonania.",
  aiMapNodeUnnamed: "KajetAI nie nazwał dodawanego węzła.",
  aiMapNewNodeLoose: "KajetAI chciał dodać węzeł, który do niczego nie jest podłączony.",
  aiMapNodeUnderItself: "KajetAI chciał podwiesić węzeł sam pod siebie.",
  aiMapNodeUnderOwnBranch: "KajetAI chciał przenieść węzeł pod jego własną gałąź.",
  aiMapAddedNodeLoose: "KajetAI zostawił dodany węzeł bez połączenia z resztą mapy.",
  aiMapNodeWithoutName: "Po tej zmianie w mapie zostałby węzeł nie do rozpoznania.",
  aiMapTwoSameLinks: "Po tej zmianie mapa miałaby dwa połączenia nie do odróżnienia.",
  aiMapLinkToNowhere: "Po tej zmianie w mapie zostałoby połączenie do węzła, którego już nie ma.",
  aiMapSelfLink: "Po tej zmianie w mapie byłby węzeł podwieszony sam pod siebie.",

  apiServerBusy: "Serwer jest w tej chwili zajęty uruchamianiem cudzego kodu.",
  apiTryInSeconds: "Spróbuj za kilka sekund.",
  apiBadReleaseHash: "Suma kontrolna pliku wydania się nie zgadza.",
  apiNotAnApk: "To nie wygląda na plik APK. Wskaż plik z aplikacją.",
  apiUploadFailed: "Nie udało się odebrać pliku. Spróbuj jeszcze raz.",
  apiCannotRunLanguage: "Tego języka Kajet nie uruchomi na tym serwerze.",
  apiNotAProgram: "to nie jest program do uruchomienia, tylko strona do obejrzenia.",
  apiGoogleNoEmail: "Google nie zwróciło adresu e-mail.",
  apiNoInviteForGoogle: "Brak ważnego kodu zaproszenia dla nowego konta Google.",

  actTokenRevoked:
    "Token unieważniony. Aplikacja na tym urządzeniu poprosi o ponowne zalogowanie.",
  actNoSuchToken: "Nie ma już takiego tokenu.",
  actGiveDeviceName: "Wpisz nazwę urządzenia.",
  actNoTokensToRevoke: "Nie ma żadnych tokenów do unieważnienia.",
  actSavedAutosaveOn: "Zapisane. Autozapis jest włączony.",
  actSavedAutosaveOff: "Zapisane. Autozapis jest wyłączony.",
  actPasswordTooShort: "Nowe hasło musi mieć co najmniej osiem znaków.",
  actCheckWhatYouTyped: "Sprawdź wpisane dane.",
  actPasswordsDiffer: "Nowe hasła się różnią.",
  actGiveCurrentPassword: "Podaj dotychczasowe hasło.",
  actCurrentPasswordWrong: "Dotychczasowe hasło się nie zgadza.",
  actLoginRules:
    "Login może mieć od 3 do 24 znaków: małe litery, cyfry, kropka, kreska i podkreślenie.",
  actLoginTaken: "Ten login jest już zajęty.",
  actRestored: "Przywrócono.",
  actDeletedForGood: "Skasowano na stałe.",
  actMovedToFolder: "Przeniesiono do folderu.",
  actTakenOutOfFolder: "Wyjęto z folderu.",
  actGiveFolderName: "Podaj nazwę folderu.",
  actFolderNameTooLong: "Nazwa folderu jest za długa.",
  actLookChanged: "Wygląd zmieniony.",
  actNotAnEmail: "To nie wygląda na adres e-mail.",
  actPasswordMinEight: "Hasło musi mieć co najmniej osiem znaków.",
  actPasswordsDifferTwice: "Hasła się różnią. Wpisz to samo hasło dwa razy.",
  actEmailTaken: "Na ten adres jest już założone konto. Zaloguj się albo odzyskaj hasło.",
  actLoginTakenPickAnother: "Ten login jest już zajęty. Wybierz inny.",
  actAccountCreated:
    "Konto założone. Wysłaliśmy wiadomość z potwierdzeniem adresu. Możesz się już zalogować.",
  actResetLinkSent:
    "Jeśli na ten adres jest założone konto, wysłaliśmy wiadomość z odnośnikiem. Sprawdź " +
    "skrzynkę, także folder ze spamem.",
  actLinkDeadAskNew: "Ten odnośnik już nie działa. Poproś o nowy.",
  actLinkExpiredHour: "Odnośnik był ważny przez godzinę i właśnie wygasł. Poproś o nowy.",
  actNoAccountOnAddress: "Nie ma już konta na ten adres.",
  actPasswordChangedEverywhere:
    "Hasło zmienione. Dla bezpieczeństwa wylogowaliśmy wszystkie urządzenia, więc zaloguj " +
    "się na nowo także w aplikacji.",
  actSignInDenied: "Logowanie odrzucone. Aplikacja dowie się o tym w ciągu kilku sekund.",
  actNoFileArrived: "Nie przyszedł żaden plik.",
  actAdminOnly: "Ta czynność jest tylko dla administratora.",
  actCheckNumbers: "Sprawdź wpisane liczby.",
  actCopyRegistrationLink: "Kopiuj odnośnik do rejestracji",
  actUnlimitedGiven: "Konto dostało miejsce bez limitu.",
  actCannotBlockSelf: "Nie da się zablokować własnego konta.",
  actLoginRulesAdmin:
    "Login może mieć od 3 do 24 znaków: małe litery, cyfry, kropka, kreska i podkreślenie.",
  actBadLogin: "Ten login nie spełnia zasad wypisanych pod polem.",
  actAccountHasAddress: "Konto ma już ten adres.",
  actAddressOnAnother: "Na ten adres jest już inne konto.",
  actConfirmationSent: " Prośba o potwierdzenie poszła na nowy adres.",
  actConfirmationFailed:
    " Nie udało się wysłać wiadomości z potwierdzeniem – przekaż odnośnik samodzielnie.",

  actOnlyTextNotes: "Na stronie da się na razie poprawiać tylko notatki tekstowe.",
  actRefreshAfterConflict: " Odśwież stronę i zapisz jeszcze raz.",
  actNothingChanged: "Notatka jest już zapisana.",
  actMindMapUnreadable: "Nie udało się odczytać mapy myśli.",
  actNotAMindMap: "To nie jest mapa myśli.",
  actHandwritingNeedsPage: "Notatka odręczna musi mieć przynajmniej jedną stronę.",
  actHandwritingUnreadable: "Nie udało się odczytać notatki odręcznej.",
  actNotHandwriting: "To nie jest notatka odręczna.",
  actLanguageUnsupported: "Ten język nie jest obsługiwany na serwerze.",
  actPickLanguage: "Wybierz język.",
  actNoteDeletedForGood: "Notatka skasowana na stałe.",
  actAddedToFavorites: "Dodano do ulubionych.",
  actRemovedFromFavorites: "Usunięto z ulubionych.",
  actAttachmentDataMissing: "Nie wiadomo, o który plik chodzi. Odśwież stronę i spróbuj jeszcze raz.",
  actAttachmentGone: "Tego załącznika już nie ma.",
  actOnlyOwnNote: "Udostępnić można tylko własną notatkę.",
  actShareMailFailed:
    "Udostępnienie gotowe, ale wiadomość nie wyszła. Przekaż odnośnik samodzielnie:",
  actLinkReady: "Odnośnik gotowy:",
  actShareGone: "Tego udostępnienia już nie ma.",
  actShareRevoked: "Udostępnienie cofnięte. Ten odnośnik przestał działać.",
  actSavedNote: "Zapisane.",
  actNoteGone: "Tej notatki już nie ma. Może została skasowana, a może leży w koszu.",
  actWhichNote: "Nie wiadomo, o którą notatkę chodzi. Odśwież stronę i spróbuj jeszcze raz.",
  actPickFileFirst: "Najpierw wskaż plik do wysłania.",
  actNotACodeFile: "Ta notatka nie jest plikiem z kodem.",

  actCopyConfirmLink: "Kopiuj odnośnik do potwierdzenia",
  actResetMailFailed:
    "Nie udało się wysłać wiadomości. Przekaż odnośnik samodzielnie – jest ważny przez godzinę.",
  actCannotTakeOwnRights: "Nie da się odebrać uprawnień samemu sobie.",
  actStorageRecomputed: "Zajęte miejsce przeliczone od nowa.",
  actCannotDeleteOwnAccount: "Nie da się skasować własnego konta.",
  actVersionExample: "Wersja to na przykład 1.4.2 albo 2.0-beta.",
  actPickApkFirst: "Najpierw wskaż plik APK.",
  actUploadLost: "Wgrany plik przepadł. Wskaż go jeszcze raz i wyślij od nowa.",
  actCopyDownloadLink: "Kopiuj odnośnik do pobierania",
  actNoReleaseLeft: " Nie ma już żadnego wydania, strona pobierania mówi o tym wprost.",
  actDeviceWillSignIn: "powinna się zalogować sama w ciągu kilku sekund.",
  actNoReleaseForDownload:
    "Nie ma jeszcze żadnego wydania aplikacji. Zajrzyj na stronę /download.",
  actReleaseFileGone:
    "Tego wydania nie da się już pobrać. Napisz do administratora.",
  actWhichAccount: "Nie wiadomo, o które konto chodzi. Odśwież stronę i spróbuj jeszcze raz.",
  actWhichCode: "Nie wiadomo, który kod skasować. Odśwież stronę i spróbuj jeszcze raz.",
  actCodeDeleted: "Kod skasowany.",
  actInviteMailFailed: "Wiadomość nie wyszła – przekaż odnośnik samodzielnie.",
  actNoSuchRelease: "Tego wydania już nie ma.",
  daysWord: "dni",

  strokeOpacity: "Krycie kreski",
  fontLabel: "Krój pisma",
  tableWord: "Tabela",
  dividerWord: "Linia oddzielająca",
  clearColourHint: "Zdejmij kolor – tekst wraca do barwy kartki",
  themeLabel: "Motyw strony",
  themeSystem: "Jak w systemie",
  themeLight: "Jasny",
  themeDark: "Ciemny",

  signInTitle: "Zaloguj się",
  emailAddress: "Adres e-mail",
  password: "Hasło",
  wrongCredentials: "Zły adres albo złe hasło.",
  tooManyAttempts:
    "Za dużo nieudanych prób logowania. Ze względów bezpieczeństwa odczekaj chwilę " +
    "i spróbuj jeszcze raz. Jeśli nie pamiętasz hasła, ustaw nowe przez „Nie pamiętam hasła”.",
  forgotPassword: "Nie pamiętam hasła",

  footerTerms: "Regulamin",
  footerPrivacy: "Polityka prywatności",
  metaTerms: "Regulamin – Kajet",
  metaPrivacy: "Polityka prywatności – Kajet",
  acceptTerms: "Akceptuję regulamin i politykę prywatności.",
  mustAcceptTerms: "Żeby założyć konto, trzeba przyjąć regulamin i politykę prywatności.",

  footerContact: "Kontakt",
  metaContact: "Kontakt – Kajet",
  contactEyebrow: "Kontakt",
  contactHeading: "Napisz do nas",
  contactLead:
    "Pytanie, pomysł, coś nie działa? Wypełnij formularz, a wiadomość trafi " +
    "prosto do nas. Odpowiadamy na adres, który podasz.",
  contactNameLabel: "Imię lub nick",
  contactSubjectLabel: "Tytuł",
  contactMessageLabel: "Treść wiadomości",
  contactSendButton: "Wyślij wiadomość",
  contactSendingWord: "Wysyłam…",
  contactSent: "Wiadomość poszła. Dziękujemy – odpowiemy na podany adres.",
  contactFillEverything: "Wypełnij wszystkie pola i sprawdź adres e-mail.",
  contactTooMany: "Za dużo wiadomości w krótkim czasie. Odczekaj chwilę i spróbuj jeszcze raz.",
  contactFailed: "Nie udało się wysłać wiadomości. Spróbuj za chwilę albo napisz zwykłym mailem.",
  contactNotSet: "Formularz nie jest tu jeszcze podłączony. Napisz zwykłym mailem.",
  contactMailInstead: "Wolisz zwykłą pocztę? Napisz na",
  contactCaptchaMissing: "Potwierdź najpierw w okienku, że nie jesteś robotem.",
  contactCaptchaFailed:
    "Nie udało się potwierdzić, że nie jesteś robotem. Spróbuj jeszcze raz.",
  contactCaptchaUnavailable:
    "Okienko sprawdzające, że nie jesteś robotem, nie mogło się wczytać. " +
    "Odśwież stronę i spróbuj jeszcze raz albo napisz zwykłym mailem.",

  deleteAccountEyebrow: "Skasowanie konta",
  deleteAccountLead:
    "Konto kasuje się w dwóch krokach: najpierw wysyłamy kod na Twój adres, " +
    "potem przepisujesz go tutaj. Po wpisaniu kodu wszystko znika natychmiast.",
  deleteAccountWhatGoes:
    "Znikają: wszystkie notatki razem z treścią, wszystkie załączniki, foldery, " +
    "udostępnione odnośniki (przestają działać od razu) i zalogowane urządzenia. " +
    "Tego nie da się cofnąć. Zanim skasujesz konto, wyeksportuj to, co chcesz zachować.",
  sendDeletionCodeButton: "Wyślij kod na e-mail",
  sendingDeletionCode: "Wysyłam kod…",
  deletionCodeSent:
    "Kod poszedł na adres Twojego konta. Jest ważny godzinę i działa jeden raz.",
  deletionCodeLabel: "Kod z wiadomości",
  deletionCodeHint: "Osiem znaków, na przykład ABCD-EFGH. Wielkość liter nie ma znaczenia.",
  deleteAccountForever: "Skasuj konto na zawsze",
  deletingAccount: "Kasuję konto…",
  confirmDeleteAccount:
    "Skasować konto razem ze wszystkimi notatkami? Tego nie da się cofnąć.",
  deletionGiveCode: "Wpisz kod z wiadomości.",
  deletionCodeWrong: "Zły kod. Sprawdź wiadomość albo wyślij nowy kod.",
  deletionCodeExpired: "Ten kod jest już nieważny. Wyślij nowy.",
  deletionTooManyTries:
    "Za dużo nieudanych prób. Odczekaj kwadrans i spróbuj jeszcze raz.",
  deletionMailFailed:
    "Nie udało się wysłać wiadomości z kodem. Spróbuj za chwilę – konto zostaje bez zmian.",
  byeAccountDeleted:
    "Konto zostało skasowane razem ze wszystkimi notatkami. Dziękujemy i do zobaczenia.",
};

const en: Words = {
  save: "Save",
  cancel: "Cancel",
  close: "Close",
  back: "Back",
  delete: "Delete",
  rename: "Rename",
  create: "Create",
  open: "Open",
  search: "Search",
  settings: "Settings",
  account: "My account",
  signIn: "Sign in",
  signOut: "Sign out",
  untitled: "Untitled",
  language: "Language",

  saved: "Saved",
  saving: "Saving…",
  unsavedWillSave: "Saving in a moment",
  unsavedPressSave: "Not saved – click Save (Ctrl+S)",
  autosaveOn: "Autosave is on",
  autosaveOff: "Autosave is off",
  saveFailed: "Could not save",
  willSaveWhenYouType: "It saves itself",

  library: "Library",
  folders: "Folders",
  allNotes: "All",
  favorites: "Favourites",
  noFolder: "No folder",
  newFolder: "New folder",
  folderName: "Folder name",
  folderSettings: "Folder settings",
  trash: "Bin",
  moveNoteToFolder: "Move the note to a folder",
  emptyLibrary: "Nothing here yet",
  emptyLibraryHint: "Write your first note, or sign in to the app with the same account.",

  noteTitle: "Title",
  noteContent: "Note content",
  writeHere: "Write here…",
  bold: "Bold",
  italic: "Italic",
  strike: "Strikethrough",
  underline: "Underline",
  highlight: "Highlight",
  textColour: "Text colour",
  textColourOfSelection: "Colour of the selected piece",
  noColour: "No colour",
  ownColour: "Your own text colour",
  collapse: "Collapse",
  linkAddress: "Link address",
  insertWord: "Insert",

  codeRun: "Run",
  codeRunning: "Running…",
  codeLanguage: "Language",
  codeTitle: "Title / file name",
  codePreview: "This is what the page looks like",
  codePreviewAbout: "The preview refreshes as you type.",
  codeRunDisabled: "Running code is switched off here.",

  locale: "en-GB",

  myNotes: "My notes",
  libraryTitle: "My notes – Kajet",
  nothingMatchesFilters: "Nothing matches these filters.",
  noFavoritesYet: "You have no favourites yet.",
  nothingHereYet: "Nothing here yet.",
  inTrash: "in the bin",
  noLimit: "no limit",
  until: "until",
  newText: "New text note",
  mindMap: "Mind map",
  handwritten: "Handwritten",
  newCode: "New code file",
  app: "App",
  admin: "Admin",
  searchPlaceholder: "Title or tag…",
  folder: "Folder",
  all: "All",
  kind: "Kind",
  kindText: "Text",
  kindCode: "Code",
  kindHandwritten: "Handwritten",
  kindMindMaps: "Mind maps",
  filterButton: "Filter",
  filtersLabel: "Filters",
  emptyPageTitle: "Empty page",
  emptyPageHeading: "You have gone past the last page",
  backToStart: "Back to the beginning",
  favoritesEmptyHeading: "No favourites yet",
  favoritesEmptyAbout:
    "Press the star next to any note and a shortcut to it turns up here. The note itself " +
    "stays where it was.",
  emptyEyebrow: "Empty",
  emptyHeading: "Nothing here yet",
  emptyAbout:
    "Write a text note or a code file on your computer. You can also sync notes from the " +
    "app on your phone or tablet – it just needs the same account.",
  textNote: "Text note",
  codeFile: "Code file",
  columnNote: "Note",
  columnKind: "Kind",
  columnFolder: "Folder",
  columnSize: "Size",
  columnChanged: "Changed",
  columnActions: "Actions",
  tagFavorite: "favourite",
  tagShared: "shared",
  attachmentsWord: "attachments",
  versionWord: "version",
  openNote: "Open the note",
  starIt: "Add a star",
  unstarIt: "Remove the star",
  moveToTrash: "Move to the bin",
  confirmTrash: "Move it to the bin?",
  pagerLabel: "Pages of the note list",
  earlier: "Earlier",
  next: "Next",
  pageWord: "Page",
  ofWord: "of",

  trashTitle: "Bin – Kajet",
  trashAbout:
    "Binned notes stay here until you restore them or delete them for good. The app on " +
    "your phone and tablet removes them at the next sync.",
  backToList: "Back to the list",
  emptyTrashButton: "Empty the bin",
  confirmEmptyTrash: "Delete every note in the bin for good?",
  trashEmptyHeading: "The bin is empty",
  trashEmptyAbout: "Notes you throw away land here.",
  columnTrashed: "Binned",
  restore: "Restore",
  forGood: "For good",
  confirmPurge: "Delete it for good? This cannot be undone.",
  trashPagerLabel: "Pages of the bin",
  folderSettingsOf: "Folder settings",
  deleteFolder: "Delete the folder",
  saveLook: "Save the look",
  createFolderButton: "Create the folder",
  folderColourGroup: "Folder colour",
  folderIconGroup: "Folder icon",

  newNoteEyebrow: "New note",
  newTextNoteTitle: "Text note",
  newTextNoteAbout: "Once you save it, the note shows up on your phone and tablet too.",
  newCodeNoteTitle: "Code file",
  newCodeNoteAbout: "You can open the file here and in the app. One button runs the code.",
  newMindMapTitle: "Mind map",
  newMindMapAbout: "Once saved, the map opens on your phone and tablet.",
  newHandwritingTitle: "Handwritten note",
  newHandwritingAbout:
    "Write with a mouse or a stylus. Once saved, the note shows up on your phone and tablet.",
  createNoteButton: "Create the note",
  createFileButton: "Create the file",
  createMapButton: "Create the map",
  metaNewText: "New text note – Kajet",
  metaNewCode: "New code file – Kajet",
  metaNewMindMap: "New mind map – Kajet",
  metaNewHandwriting: "New handwritten note – Kajet",
  codeDisabledHere: "Running code is switched off here. Saving works as usual.",
  codeDisabledForAccount: "An administrator switched off running code on your account.",

  metaNoteNotFound: "No such note – Kajet",
  metaPageNotFound: "No such page – Kajet",
  error404: "Error 404",
  noteNotFoundHeading: "No such note",
  noteNotFoundAbout:
    "There is no note at this address. It may have been someone else's, the link may have " +
    "expired, or it may simply be sitting in the bin.",
  lookInTrash: "Look in the bin",
  pageNotFoundHeading: "No such page",
  pageNotFoundLead:
    "Maybe the address has a typo, maybe the page has moved, or maybe the dog ate this " +
    "page – just like the homework back then. Your notes are fine: right where they " +
    "always were.",
  pageNotFoundWrite: "And if this page should exist,",
  pageNotFoundWriteLink: "write to us",
  homePage: "Home page",
  sharedLinkNote:
    "If a link to a shared note brought you here, ask for a new one – old ones stop working.",

  noteHandwritten: "Handwritten note",
  noteTextKind: "Text note",
  noteCodeKind: "Code file",
  changedWord: "Changed",
  favoriteWord: "favourite",
  editing: "Editing",
  editingMindMap: "Editing the mind map",
  editingHandwriting: "Editing the handwriting",
  handwritingUnreadable:
    "This note could not be opened. Do not save it, or you will lose what is inside.",
  codeUnreadable: "Kajet could not read the contents of this code file.",
  sharingEyebrow: "Sharing",
  shareThisNote: "Share this note",
  shareAbout:
    "A link works for anyone who gets it, account or no account. A share sent to an e-mail " +
    "address opens only for the person signed in with that address.",
  shareButton: "Share",
  sharePreparing: "Preparing…",
  whatTheyMayDo: "What the other person may do",
  readOnly: "Read only",
  readAndEdit: "Read and edit",
  emailOptional: "E-mail address (you may leave this empty)",
  orJustTheLink: "or just the link",
  mailNotSet:
    "E-mail is not set up, so no message will go out. You can copy the link from the list " +
    "below.",
  validForDays: "Valid for (days)",
  zeroMeansForever: "Zero means no deadline.",
  allowWithoutAccount: "Let people open it without an account",
  alreadyShared: "Already shared",
  columnWho: "With whom",
  columnRights: "Rights",
  columnValidUntil: "Valid until",
  byNameNeedsSignIn: "by name, requires signing in",
  linkWord: "link",
  rightEdit: "editing",
  rightRead: "reading",
  expiredMark: " (expired)",
  noDeadline: "no deadline",
  openedWord: "opened",
  revoke: "Revoke",
  confirmRevoke: "Revoke this share? The link will stop working.",
  inTrashWord: "In the bin",
  trashedWord: "Binned",
  noteInTrashAbout:
    "This note is in the bin. Restore it to edit it again, or delete it for good.",

  copyWord: "Copy",
  copiedWord: "Copied",
  copyLink: "Copy the link",
  linkCopied: "Copied",
  justAMoment: "One moment…",
  confirmationLabel: "Confirmation",
  areYouSure: "Are you sure?",
  emptyNoteText: "This note is empty.",
  deleteForGood: "Delete for good",
  confirmPurgeNote: "Delete the note for good? This cannot be undone.",
  confirmTrashNote: "Move the note to the bin? You can restore it later.",
  addToFavorites: "Add to favourites",
  removeFromFavorites: "Remove from favourites",
  attachmentsEyebrow: "Attachments",
  filesWithNote: "Files with this note",
  sendFile: "Upload a file",
  sendingFile: "Uploading…",
  fileLabel: "File",
  nameInNote: "Name in the note (optional)",
  namePlaceholder: "e.g. photo-1.png",
  columnName: "Name",
  previewWord: "Preview",
  openInNewTab: "Open in a new tab",
  removeAttachment: "Remove the attachment",
  mindMapLabel: "Mind map",
  noteUnreadableHere:
    "This note could not be opened on the website. Try it in the app – it should show up there.",

  codeFileNamePlaceholder: "e.g. task1.py",
  codeWord: "Code",
  savingWord: "Saving…",
  previewEyebrow: "Preview",
  htmlPreviewFrame: "Preview of the HTML page",
  runningEyebrow: "Running",
  runOnServer: "Run it on the server",
  cannotRunHere: "You cannot run this code on the website. Saving works as usual.",
  standardInput: "Standard input (optional)",
  stdinPlaceholder: "What the program should read…",
  exitCodeWord: "exit code",
  interruptedByTimeout: "interrupted (time limit)",

  inkColour: "Ink",
  greyColour: "Grey",
  blueColour: "Blue",
  redColour: "Red",
  greenColour: "Green",
  brownColour: "Brown",
  photoAlt: "photo",
  textLookToolbar: "Text formatting",
  heading1: "Heading 1",
  heading2: "Heading 2",
  heading3: "Heading 3",
  bulletListHint: "List – Enter starts the next item",
  numberedListHint: "Numbered list – Enter carries the numbering on",
  taskListHint: "Tick list – click the box to tick it",
  quoteWord: "Quote",
  codeInText: "Code inside the text",
  codeBlockWord: "Code block",
  linkWord2: "Link",
  sendingPhoto: "Uploading the photo…",
  insertPhotoInNote: "Insert a photo into the note",
  writeSomethingFirst: "Write something first – you can add a photo once the note is saved.",
  saveNoteFirst: "Save the note first – then you can add a photo.",
  formulaWord: "Formula",
  wholeNoteFont: "Typeface for the whole note",
  wholeNoteSize: "Text size for the whole note",
  wholeNoteColour: "Text colour for the whole note",
  defaultColour: "Default colour",
  alignLeft: "Align left",
  alignCentre: "Align centre",
  alignRight: "Align right",
  ownTextColour: "Your own text colour",
  photoInNote: "Photo in the note",
  shrinkPhoto: "Make the photo smaller",
  growPhoto: "Make the photo bigger",
  removePhotoFromNote: "Take the photo out of the note",
  autosaveHint: "The note saves itself when you stop writing.",
  autosaveOffHint: "Autosave is off. Save with the button or Ctrl+S.",

  penInk: "Ink",
  penTeal: "Teal",
  penBurgundy: "Burgundy",
  penBlue: "Blue",
  penHighlighter: "Highlighter",
  handwritingToolbar: "Handwriting",
  toolPen: "Fountain pen",
  toolFineliner: "Fineliner",
  toolHighlighter: "Highlighter",
  toolEraser: "Eraser",
  toolPointer: "Pointer – moves photos",
  toolShapes: "Shapes – drag to place one",
  undoLastStroke: "Undo the last stroke",
  undoLastThing: "Undo the last thing",
  shapeLine: "Line",
  shapeArrow: "Arrow",
  shapeRect: "Rectangle",
  shapeRoundRect: "Rounded rectangle",
  shapeEllipse: "Ellipse",
  shapeTriangle: "Triangle",
  shapeDiamond: "Diamond",
  shapeStar: "Star",
  shapeFillOn: "Fill with the outline colour",
  shapeFillOff: "No fill",
  shapeSquareLock: "Equal sides – circle and square",
  shapeRemove: "Remove the shape",
  addOwnColour: "Add a colour of your own",
  pickOwnColourNewSlot: "Pick your own colour – it is added to the palette",
  ownInkColour: "Your own ink colour",
  backgroundWord: "Background",
  bgPlain: "Blank",
  bgLined: "Ruled",
  bgGrid: "Squared",
  bgDots: "Dotted",
  bgStave: "Music staves",
  pageButton: "Page",
  clearPage: "Clear the page",
  confirmClearPage:
    "Clear every stroke on this page? Text boxes and pictures stay.",
  uploadAndPlace: "Upload a photo and place it on this page",
  drawSomethingFirst: "Draw something first – you can add a photo once the note is saved.",
  uploadingWord: "Uploading…",
  photoWord: "Photo",
  photoToInsert: "Photo to insert",
  choosePhoto: "Choose a photo…",
  insertAgain: "Insert it again",
  removeSelectedPhoto: "Remove the selected photo from the page",
  previousPage: "Previous page",
  nextPage: "Next page",
  pageGrowsHint: "the page grows as you write near the bottom",
  handwritingCanvas: "Handwriting editor",

  nodeGraphite: "Graphite",
  nodeTeal: "Teal",
  nodeBurgundy: "Burgundy",
  nodeIndigo: "Indigo",
  nodeSunny: "Sunny",
  nodePlum: "Plum",
  fontBody: "Body",
  fontHeading: "Display",
  fontMono: "Typewriter",
  newNodeText: "New node",
  mindMapToolbar: "Mind map",
  nodeWord: "Node",
  childWord: "Branch",
  besideWord: "Beside",
  pickTarget: "Pick the target…",
  pickSource: "Pick the source…",
  connectWord: "Connect",
  deleteNode: "Delete the node",
  undoWord: "Undo",
  redoWord: "Redo",
  arrangeWord: "Arrange",
  zoomOutWord: "Zoom out",
  zoomInWord: "Zoom in",
  fitAll: "Fit it all",
  nodeLookToolbar: "Node look",
  turnIntoRectangle: "Turn into a rectangle",
  turnIntoOval: "Turn into an oval",
  nodeShape: "Node shape",
  smallerTextWord: "Smaller text",
  largerTextWord: "Larger text",
  frameWord: "Frame",
  ownFrameColour: "Your own node frame colour",
  writingWord: "Text",
  ownNodeTextColour: "Your own text colour in the node",
  expandBranch: "Expand the branch",
  collapseBranch: "Collapse the branch",
  nodeTextLabel: "Node text",
  mindMapCanvas: "Mind map editor",
  clickToRemoveEdge: "Click to remove this connection",
  mindMapHints:
    "double-click a node to change its text · Ctrl and drag moves the board · Shift and " +
    "the wheel scrolls sideways · Tab adds a branch, Delete removes the node",

  homeEyebrow: "Notebook",
  homeTitleBefore: "One ",
  homeTitleWord: "Kajet",
  homeTitleAfter: " for your phone, tablet and browser.",
  homeLead:
    "Handwriting, text, mind maps and code in one notebook. You write in the app " +
    "and do the same in the browser, on the same account.",
  haveInviteCode: "I have an invite code",
  downloadForAndroid: "Get it for Android",
  latestRelease: "Latest release of the app",
  skipToContent: "Skip to content",
  homeKindsTitle: "Four kinds of notes",
  homeKindsIntro: "You open every kind in the app and on the website. They all sit in one library.",
  homeKindHandTitle: "Handwriting",
  homeKindHandBody:
    "Pen, fineliner, highlighter, eraser and shapes. On a tablet you write with a stylus, " +
    "and on the website you touch a note up with a mouse or a finger. The ink colours are " +
    "the same in both.",
  homeHandPicture:
    "A little house drawn crookedly in ink on a sheet of paper; the top of the roof with " +
    "its chimney and the smoke reach past the edge of the sheet",
  homeKindTextTitle: "Text",
  homeKindTextBody:
    "Headings, task lists, quotes, tables and photos inside the note. All from a single " +
    "bar above the writing area.",
  homeTextPicture:
    "Three lines of handwriting in ink, with a sweeping underline below the last word",
  homeKindMapTitle: "Mind map",
  homeKindMapBody:
    "You join nodes into branches and spread them over the page. Tab adds a branch, " +
    "Delete removes a node.",
  homeKindCodeTitle: "Code",
  homeKindCodeBody:
    "A code file lives in a note and you run it on the server. Nine languages, from " +
    "Python to SQL.",
  homeCodePicture:
    "A dark sheet lying askew with a Python console on it: a print command with the words " +
    "Hello World, and the same Hello World printed below",
  homeWhereTitle: "Where should your notes live?",
  homeNoAccountTitle: "Without an account",
  homeNoAccountBody:
    "The app works without signing in. Notes stay on the device, in a folder you pick, " +
    "as plain files. None of them goes to the server.",
  homeWithAccountTitle: "With an account",
  homeWithAccountBody:
    "Notes go to the server. You open them on the website and in the app, and after " +
    "a change of phone or tablet they come back on their own. The bin, folders and " +
    "favourites are shared too.",
  homeShareTitle: "Sharing",
  homeShareBody:
    "You share a note with a link or send it to an e-mail address. Anyone can read an " +
    "open link in a browser, with no account and no app. The recipient gets a " +
    "read-only preview, and e-mail sharing goes to a person with an account on this server.",
  homeDownloadTitle: "The app for Android",
  homeStepOne: "Download the file to your phone.",
  homeStepTwo: "Allow installing from outside the Play Store. The phone will ask on its own.",
  homeStepThree: "Open the downloaded file and you are done.",
  homeDownloadFacts:
    "Works from Android 8.0 upwards. The download page lists the release notes " +
    "and older releases.",
  homeDownloadPage: "Open the download page",
  homeDownloadFile: "Download the file",
  homeInviteTitle: "An account by invitation",
  homeInviteBody:
    "You create an account only with an invite code. You get the code from whoever runs " +
    "the server.",

  metaSharedNote: "Shared note – Kajet",
  linkEyebrow: "Link",
  cannotShowNote: "This note cannot be shown",
  sharedNoteCaption: "shared note",
  mayChangeIt: "you may make changes",
  readOnlyMark: "read only",
  openAsOwner: "Open it as the owner",
  codeRunOwnerOnly:
    "Only the person the note belongs to can run the code. Saving works as usual.",
  thisIsAKajetNote: "This is a note from Kajet.",
  seeWhatItIs: "See what it is about",

  metaConfirm: "Address confirmation – Kajet",
  emailAddressEyebrow: "E-mail address",
  goToSignIn: "Go to sign-in",
  backToRegister: "Back to registration",
  noLinkHeading: "No link",
  noLinkBody:
    "This address is incomplete. Open the whole link straight from the e-mail you were sent.",
  linkDeadHeading: "The link no longer works",
  linkDeadBody:
    "This link has already been used, or it is not valid. If your account works, just " +
    "sign in.",
  linkExpiredHeading: "The link has expired",
  linkExpiredBody:
    "The link was valid for a day. Sign in and ask for a new confirmation in your " +
    "account settings.",
  addressConfirmed: "Address confirmed",

  metaDownload: "Kajet for Android – download",
  androidAppCaption: "the Android app",
  toDownload: "Download",
  downloadLead:
    "A notebook for phone and tablet: handwriting, text, mind maps and code. Sign in with " +
    "the same account and the notes are the same here and in the app.",
  downloadWord: "Download",
  publishedWord: "published",
  whatChanged: "What changed",
  noAppYet: "The app is not here yet",
  noAppYetBody:
    "The administrator of this server has not published a release yet. The website works " +
    "as usual – you can open your notes in the browser.",
  howToInstall: "How to install it",
  howToInstallBody:
    "The file does not come from the Google store, so your phone will ask for permission. " +
    "After downloading, open the file and let the browser install apps from this source – " +
    "Android calls it “installing unknown apps”. For later versions, download and open " +
    "them the same way; your notes stay where they are.",
  olderVersions: "Older versions",

  metaRegister: "Create an account – Kajet",
  newAccountEyebrow: "New account",
  createAccountHeading: "Create your Kajet account",
  registerLead:
    "Accounts are created with a code from an administrator. If you have none, ask the " +
    "person who runs this server. Without an account you can still write in the app – your " +
    "notes then stay on the device.",
  haveAccountAlready: "Already have an account?",
  inviteCode: "Invite code",
  inviteCodePlaceholder: "e.g. KAJET-7QX2-9MB4",
  codeCameFromLink: "The code filled itself in from the link you were given.",
  loginOptional: "Login (you may leave this empty)",
  loginPlaceholder: "we will make one from your address",
  loginIsVisible: "Your login is visible to people you share notes with.",
  atLeastEightChars: "At least eight characters.",
  repeatPassword: "Repeat the password",
  creatingAccount: "Creating the account…",
  createAccountButton: "Create the account",
  preferGoogle: "I would rather use Google",
  googleAccountEyebrow: "Google account",
  googleAccountAbout:
    "Enter the invite code. We check it and go straight to Google. The account is created " +
    "for whichever address you sign in with there – you do not need to give it here.",
  checkingCode: "Checking the code…",
  onWithGoogle: "Continue with Google",

  metaNewPassword: "New password – Kajet",
  newPasswordEyebrow: "New password",
  setNewPasswordHeading: "Set a new password",
  newPasswordAbout:
    "After the change every device is signed out, so sign in again in the app on your " +
    "phone and tablet too.",
  saveNewPassword: "Save the new password",
  newPasswordLabel: "New password",
  linkDeadHeading2: "This link no longer works",
  linkOneHourAbout:
    "The link is valid for an hour and works once. Ask for a new one with the form below.",
  passwordEyebrow: "Password",
  forgotPasswordHeading: "I forgot my password",
  forgotPasswordAbout:
    "Give the address your account is on. We will send a link for setting a new password.",
  mailNotSetHere:
    "E-mail is not set up on this server, so no message will go out. Ask an administrator " +
    "for help.",
  sendLinkButton: "Send the link",
  sendingWord: "Sending…",
  backToSignIn: "Back to sign-in",

  metaConnectDevice: "Connect a device – Kajet",
  appEyebrow: "App",
  noCodeHeading: "No code",
  noCodeAbout:
    "Open this page from the Kajet app with the “Sign in with Google” button. Without a " +
    "code from the app there is no way to connect the device.",
  ordinarySignIn: "Ordinary sign-in to the panel",
  mobileAppEyebrow: "Mobile app",
  connectDeviceHeading: "Connect a device",
  codeExpiredAbout:
    "This sign-in code has expired or has already been used. Go back to the app and start " +
    "signing in again.",
  signInDenied: "This sign-in was denied earlier.",
  openTheApp: "Open the app",
  orStayInPanel: "Or stay in the panel",
  deviceFallback: "Device",
  connecting: "Connecting…",
  denying: "Denying…",
  notMeDeny: "That was not me – deny it",
  afterApprovalAbout:
    "Once approved, the app signs itself in within a few seconds. You can also go back to " +
    "it with the “Open the app” button when it turns up.",

  adminPanelLink: "Admin panel",
  profileEyebrow: "Profile",
  roleWord: "Role",
  roleAdmin: "Administrator",
  roleUser: "User",
  signInOnSite: "Sign-in on the website",
  viaPassword: "password",
  viaSession: "session (no password)",
  lastSignIn: "Last sign-in",
  notedNever: "not noted yet",
  accountSince: "Account since",
  noteList: "Note list",
  spaceEyebrow: "Space",
  limitValidUntil: "the limit holds until",
  spaceRunningOut:
    "You are running out of space. Empty the bin, or ask an administrator for a bigger limit.",
  writingEyebrow: "Writing",
  howIWriteHere: "Writing on the website",
  writingLead:
    "These settings are saved with your account, so they hold in every browser. Typeface, " +
    "size and alignment apply to new notes. To change a note that is already open, use " +
    "the bar above the text.",
  saveSettings: "Save the settings",
  autoSaveTitle: "Autosave",
  autoSaveAbout:
    "On: the note saves itself when you stop writing. Off: you save it yourself, with the " +
    "“Save” button or Ctrl+S.",
  boldFontTitle: "Bolder text",
  boldFontAbout:
    "Heavier text in the writing area – easier to read. The note itself stays as it is.",
  fontOfNewNote: "Typeface of a new note",
  textSizeLabel: "Text size",
  zeroMeansDefault: "Zero means the default",
  alignmentLabel: "Alignment",
  deviceTokensEyebrow: "Device tokens",
  tokenSignIn: "Signing in with a token",
  tokenSignInAbout:
    "In the app an e-mail address and a password are usually enough. A token helps when " +
    "the account was created through Google and has no password yet – or when you would " +
    "rather not type your password on someone else's device.",
  issueToken: "Issue a token",
  issuingToken: "Issuing…",
  deviceName: "Device name",
  deviceNamePlaceholder: "e.g. phone, tablet, laptop",
  lastUseWord: "last used",
  saveName: "Save the name",
  issuedWord: "issued",
  neverUsed: "never used",
  revokeToken: "Revoke",
  confirmRevokeToken:
    "Revoke this token? The app on that device will ask you to sign in again.",
  revokeAllTokens: "Revoke every token",
  confirmRevokeAll: "Revoke every token? Each device will have to sign in again.",
  noTokensYet:
    "No tokens yet. Issue one if you sign in to the app without a password.",
  loginEyebrow: "Login",
  accessEyebrow: "Access",
  saveLogin: "Save the login",
  passwordChangeAbout:
    "Changing your password signs the account out everywhere: this browser, other " +
    "browsers, and every device with the app. Right after the change you sign in with the " +
    "new password.",
  passwordSetAbout:
    "This account has no password yet (it was created through Google). Set one if you want " +
    "to sign in to the mobile app with an address and password instead of a token. Setting " +
    "a password signs the account out everywhere.",
  changePasswordButton: "Change the password",
  setPasswordButton: "Set a password",
  currentPassword: "Current password",
  repeatNewPassword: "Repeat the new password",
  signOutEyebrow: "Signing out",
  signOutAbout:
    "An ordinary sign-out closes only this browser – other browsers and the apps on your " +
    "devices carry on.",
  signOutThisBrowser: "Sign out of this browser",
  signOutEverywhere: "Sign out everywhere",
  signOutEverywhereTitle: "Closes the account on every device at once",
  signOutEverywhereAbout:
    "“Sign out everywhere” closes every browser and revokes every app token – exactly what " +
    "happens when you change your password. Notes saved on your devices stay where they are.",

  metaAdmin: "Admin panel – Kajet",
  adminCaption: "admin panel",
  adminOverview: "Overview",
  adminAccounts: "Accounts",
  adminCodes: "Invite codes",
  adminApp: "App",
  adminLog: "Log",
  serverState: "Server state",
  statAccounts: "Accounts",
  statNotes: "Notes",
  statNotesNote: "outside the bin",
  statSpace: "Space used",
  statSpaceNote: "across all accounts",
  statFreeCodes: "Unused codes",
  statFreeCodesNote: "still valid",
  lastWeekEyebrow: "Last seven days",
  statNewAccounts: "New accounts",
  statNotesToday: "Notes today",
  statCrashes: "App crashes",
  statFreeSpace: "Free space",
  statFreeSpaceNote: "on the server disk",
  unknownWord: "unknown",
  worthCheckingEyebrow: "Worth checking",
  serverNearlyFullTitle: "The server is nearly full",
  diskUnderLimitTitle: "The disk has less room than the server limit",
  mailOffTitle: "Outgoing mail is not set up",
  noSmtpHint:
    "Without SMTP, invitations, confirmations and sharing notifications do not go out. " +
    "Links can still be copied from the website.",
  googleOffTitle: "Google sign-in is disabled",
  googleEnvHint: "Fill in AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET in the .env file.",
  noReleaseTitle: "The app is not published",
  noReleaseHint:
    "Until something is here, the /download page tells visitors the app is not available " +
    "yet. You publish it under the “App” tab.",
  codeOffTitle: "Running code does not work",
  codeOffHint:
    "While this does not work, the app tells users that running is unavailable. Code can " +
    "still be written and saved.",
  issueInviteCode: "Issue an invite code",
  manageAccounts: "Manage accounts",
  publishApp: "Publish the app",

  accountsLead:
    "A quota of zero means unlimited space. A quota given for a number of days goes back " +
    "to the previous value once the time is up.",
  searchAccountPlaceholder: "Login or e-mail…",
  clearWord: "Clear",
  tagAdministrator: "administrator",
  tagBlocked: "blocked",
  tagNoCodeRunning: "no code running",
  tagAiAllowed: "KajetAI",
  accountSinceShort: "account from",
  blockReasonLabel: "Reason for the block",
  quotaSection: "Space quota",
  setQuota: "Set the quota",
  quotaInMb: "Quota in MB",
  forHowManyDays: "For how many days",
  quotaHint: "Zero megabytes means unlimited space; zero days means the limit stays for good.",
  changeLogin: "Change the login",
  newLogin: "New login",
  changeEmail: "Change the e-mail",
  newEmail: "New e-mail address",
  sendPasswordLink: "Send a password-change link",
  setPasswordForUser: "Set a password",
  atLeast8Placeholder: "At least 8 characters",
  unblockAccount: "Unblock the account",
  blockAccount: "Block the account",
  blockReasonPlaceholder: "Reason (optional)",
  blockReasonAria: "Reason for the block",
  takeAdminRights: "Take away admin rights",
  makeAdmin: "Make administrator",
  takeCodeRunning: "Take away code running",
  allowCodeRunning: "Allow code running",
  takeAiAccess: "Take KajetAI away",
  allowAiAccess: "Allow KajetAI",
  aiSection: "KajetAI",
  aiDailyLimitLabel: "Calls per day",
  setAiLimit: "Set the limit",
  aiLimitHint: "Zero means the default limit.",
  aiNoUsageYet: "This account has not asked for anything yet.",
  recomputeStorage: "Recompute the space",
  deleteAccount: "Delete the account",

  newCodeEyebrow: "New code",
  issueInviteCodeHeading: "Issue an invite code",
  codesLead:
    "A one-seat code is an ordinary invitation for one person. More seats help when you " +
    "invite a whole class with a single code.",
  issueCode: "Issue the code",
  issuingCode: "Issuing…",
  howManyAccounts: "How many accounts",
  quotaMbLabel: "Space quota in MB",
  codeGrantsAi: "With KajetAI",
  codeGrantsAiHint:
    "An account created with this code will be able to ask KajetAI for changes right away. " +
    "The model is free, so Google may use what is sent to train its models.",
  validForDaysLabel: "Valid for (days)",
  mailNotSetCodes:
    "E-mail is not set up, so no message will go out. You can copy the link from the list below.",
  descriptionForYou: "Description (for you)",
  descriptionPlaceholder: "e.g. class 2B, September",
  issuedCodes: "Issued codes",
  noCodesYet: "No codes yet. Issue the first one with the form above.",
  columnCode: "Code",
  columnUse: "Use",
  columnAccountQuota: "Account quota",
  columnValidTo: "Valid until",
  columnDescription: "Description",
  copyCode: "Copy the code",
  tagSpent: "used up",
  tagExpired: "expired",
  tagFree: "unused",
  usedByWord: "used by",
  defaultWord: "default",
  confirmDeleteCode:
    "Delete this code? Anyone who has not used it yet will not get an account.",

  logLead: "The last two hundred administrator actions.",
  logEmpty: "The log is empty. Entries turn up after the first action in the panel.",
  columnWhen: "When",
  columnWho2: "Who",
  columnAction: "Action",
  columnDetails: "Details",
  deletedAccount: "account deleted",

  adminCrashes: "Crashes",
  metaAdminCrashes: "App crashes – Kajet",
  crashesLead:
    "Reports from the Android app. The same crash reported many times sits in one row.",
  crashesEmpty: "No crash report has arrived yet.",
  columnHowMany: "How many",
  columnDevice: "Device",
  crashShowReport: "Show the whole report",
  crashNoAccount: "no account",

  metaAdminApp: "Android app – Kajet",
  newReleaseEyebrow: "New release",
  publishAppHeading: "Publish the app for download",
  publishAppLead:
    "The uploaded file goes to the download page, where anyone who wants Kajet on their " +
    "phone can get it. The app checks the release number on the server and tells the user " +
    "when an update is available.",
  publishedReleases: "Published releases",
  noReleasesYet:
    "No releases yet. The download page tells visitors that the app is not available for " +
    "download yet.",
  columnVersion: "Version",
  columnFile: "File",
  columnDownloads: "Downloads",
  columnPublished: "Published",
  releaseNumberWord: "release number",
  tagDownloadable: "downloadable",
  publishedByWord: "published by",
  makeCurrent: "Publish",
  confirmDeleteRelease: "Delete this release? The file will disappear from the server disk.",
  apkFileLabel: "App file (APK)",
  versionLabel: "Version",
  versionPlaceholder: "e.g. 1.4.2",
  versionHint: "The number people see – the same as versionName in the app.",
  releaseNumberLabel: "Release number",
  releaseNumberHint:
    "The number read from the file. The app uses it to tell that it is out of date, so it " +
    "cannot be changed here.",
  readFromFile: "read from the file",
  couldNotReadRelease:
    "The version could not be read from this file. Type the release number and the version " +
    "by hand, exactly as they are in the app – otherwise nobody gets an update notice.",
  whatChangedLabel: "What changed",
  releaseNotesPlaceholder: "You may leave this empty. People downloading see this text.",
  replacePreviousHint:
    "Only this one release then remains. Untick it if you want to be able to go back to " +
    "the previous one.",
  publishRelease: "Publish the release",
  nginxTooBig:
    "Nginx rejected the file as too big. Raise client_max_body_size in its settings.",
  connectionDropped2: "The connection dropped while uploading.",
  uploadAborted: "Upload cancelled.",
  pickApkFile: "Choose the APK file with the app.",
  sendingFileStage: "Uploading the file…",
  savingReleaseStage: "Saving the release…",
  uploadFailed: "The upload did not work.",

  metaSignIn: "Sign in – Kajet",
  signInEntrance: "Way in",
  signInLead:
    "Once you sign in you will see your notes, and you can read and edit them here.",
  signInWithGoogleButton: "Sign in with Google",
  googleInAppHint:
    "In the app you can sign in with Google, with a password, or with a token from your " +
    "account page.",
  noAccountAsk: "No account yet?",
  registerOnCode: "Create one with an invite code",
  signInBlocked: "This account has been blocked. Write to an administrator.",
  signInCodeRequired:
    "There is no account on this address yet. A new Google account is created on the " +
    "registration page: enter the code from your administrator there, and we go to Google " +
    "as soon as it checks out.",
  signInNotLinked:
    "This address is already used for password sign-in. Sign in with your password, and " +
    "you can link Google afterwards.",
  signInConfiguration:
    "Google sign-in does not work on this server. Sign in with a password, or write to an " +
    "administrator.",
  signInAccessDenied: "Google did not allow the sign-in, or this account has no access.",
  signInOAuthStart: "Google sign-in could not be started. Try again.",
  signInOAuthCallback:
    "Google did not finish the sign-in. Try again. If it keeps happening, write to an " +
    "administrator – this is a setting on the server side.",
  signInOAuthCreate:
    "The account could not be created through Google. Try again, or create one with a " +
    "password on an invite code.",
  signInInterrupted: "The sign-in was interrupted. Try again.",
  signInVerification: "The sign-in link has expired or has already been used.",
  signInDefault: "Signing in did not work. Try again.",
  byeEverywhere:
    "Signed out on every device. The apps on your phone and tablet will ask you to sign " +
    "in again. Notes saved on those devices stayed where they were.",
  byePasswordChanged:
    "Password changed. For safety the account was signed out everywhere – sign in with the " +
    "new password.",
  byePasswordSet:
    "Password set. Sign in with it now; you will use the same password in the phone app.",
  siteDescription:
    "A notebook for your phone, tablet and browser. Handwriting, text, mind maps and code " +
    "– all in one place.",
  sendStraightTo: "Send it straight to an address",
  searchAccountLabel: "Search accounts",
  deleteOlderReleases: "Delete older releases – from the database and the disk",

  apiDbBehind:
    "The server is being updated and is not taking notes right now. Your notes on the " +
    "device are safe. If it lasts, write to an administrator.",
  apiNoDatabase: "The server cannot reach its database. Try again in a moment.",
  apiUnexpected: "Unexpected server error.",
  apiCrashTooOften: "Too many crash reports at once. Try again in a few minutes.",
  apiCrashTooBig: "The crash report is too big.",
  apiCrashUnreadable: "The crash report cannot be read.",
  apiVersionTooOften: "Too many update checks at once. Try again in a few minutes.",
  apiNotSignedIn: "You are not signed in. Sign in from the app settings.",
  apiTokenDead: "This token no longer works. Sign in again.",
  apiTokenExpired: "The token has expired. Sign in again.",
  apiAccountBlocked: "This account has been blocked. Write to an administrator.",
  apiIdentityFailed: "Your identity could not be confirmed.",
  apiMustSignIn: "You have to sign in.",
  apiNoteNotYours: "This note belongs to someone else.",
  apiFolderNotYours: "This folder belongs to someone else.",
  apiLinkDead: "This link no longer works, or the note has been deleted.",
  apiLinkExpired: "This link has expired. Ask for a new one.",
  apiShareReadOnly: "This link allows reading only, so the changes have not been saved.",
  apiSharedByName:
    "This note is shared by name. Sign in with the address the message was sent to.",
  apiSharedToSomeoneElse: "This note is shared with someone else. Sign in with the right address.",
  apiSignInToOpen: "You have to sign in to open this note.",
  ownerWord: "Owner",
  guestWord: "Guest",
  unknownDeviceWord: "Unknown device",
  apiChallengeGone: "This sign-in code does not exist, or it has expired.",
  apiChallengeExpiredAskApp: "This sign-in code has expired. Ask the app for a new one.",
  apiChallengeDenied: "This sign-in was denied.",
  apiChallengeOtherAccount: "This code has already been approved on another account.",
  apiChallengeExpired: "This sign-in code has expired.",
  apiChallengeWrongAccount: "This code belongs to another account.",
  apiPreviewBelow: "The preview is below the code area.",
  apiRunningOff: "Running code is switched off on this server.",
  apiRunFailed: "The program could not be started.",
  apiRunnerBroken: "Running code does not work on this server. The details are in the server log.",
  apiInstallDocker: "Install Docker, or switch running off in the server settings.",
  apiNoDockerRights: "The account Kajet runs as has no permission to use Docker. ",
  apiOffInServerSettings: "Switched off in the server settings.",
  apiRunnerReady: "Ready to run code.",
  apiConflict:
    "This note changed somewhere else. Your change was not saved, so nothing is lost.",
  apiNoteWithoutBody:
    "The server did not get the content of this note. Update the app and sync again.",
  apiTrashFirst: "Move the note to the bin first, then you can delete it for good.",
  apiGiveAttachmentName: "Give the name of the attachment.",
  apiNoSuchAttachment: "There is no such attachment.",
  apiNoSuchAccount: "There is no such account.",
  apiFileGoneFromDisk: "That file is gone. Write to an administrator.",
  apiNoSuchCode: "There is no such code. Copy it again, character for character.",
  apiCodeExpired: "This code has expired. Ask an administrator for a new one.",
  apiCodeUsedUp: "This code has already been used up. Ask an administrator for a new one.",
  apiBadRequest: "Something went wrong on the way. Try again.",
  apiGiveDeviceName: "Give a device name.",
  apiSignInDenied: "This sign-in was denied in the browser. If you want to sign in, start again.",
  apiCodeExpiredOrUsed:
    "The sign-in code has expired or has already been used. Try again from the app.",
  apiGiveEmailAndPassword: "Enter an e-mail address and a password.",
  apiWrongCredentials: "Wrong address or wrong password.",
  apiUploadUnreadable: "The uploaded file could not be read.",
  apiFileKindRefused: "That kind of file is not accepted. Send a photo or a drawing.",
  apiFileContentMismatch:
    "The file content does not match its kind. Send a photo or a drawing.",
  apiFileSaveFailed: "The file could not be saved.",
  apiGiveAttachmentToDelete: "Give the name of the attachment to delete.",
  apiUnknownShape:
    "This version of the app is newer than the server. Ask an administrator to update the server.",
  apiNoteUnknownShape:
    "The server cannot save a note like this yet. Ask an administrator to update the server.",
  apiFolderUnknownShape:
    "The server cannot save a folder like this yet. Ask an administrator to update the server.",
  apiNoteNotOnServer: "This note is not on the server yet. Sync it and try again.",
  apiCodeRunningOffForAccount: "An administrator switched off code running on this account.",
  apiCodeRunningOffKeepWriting:
    "An administrator switched off code running on this account. You can still write and " +
    "save code.",
  apiGiveLanguageAndCode: "Give a language and the code to run.",
  apiNothingToRun: "There is nothing to run.",
  apiUnknownAddress:
    "This server does not have that feature. Update the app, or check the server address " +
    "in settings.",
  apiAiNoConsent:
    "KajetAI sends the content of the note to Google and needs your consent. You confirm " +
    "it in account settings.",
  apiAiWrongKind:
    "KajetAI works on text notes, mind maps and code. There is nothing to read in a " +
    "handwritten one.",
  apiAiNoInstruction: "Write what KajetAI should change in the note.",
  apiAiTimeout: "KajetAI did not answer in time. The note was left untouched – try again.",
  apiAiBusy:
    "Google is not taking any more requests from KajetAI today. Try later – the note was " +
    "left untouched.",
  apiAiBroken: "KajetAI could not reach Google. The note was left untouched.",
  apiAiNoAnswer: "KajetAI proposed no change. Try writing the instruction differently.",
  apiAiHistoryCleared: "The conversation with KajetAI about this note has been cleared.",
  // Napisy przepisane znak w znak z aplikacji (Words.kt), żeby obie strony
  // mówiły w tej sprawie jednym zdaniem.
  aiTitle: "KajetAI",
  aiHint: "What should change in this note?",
  aiAsk: "Ask",
  aiWorking: "KajetAI is working on the note…",
  aiUndo: "Undo the change",
  aiUndone: "Change undone.",
  aiUndoFailed: "Could not undo it. The note stayed as KajetAI left it.",
  aiNoteNotSavedYet:
    "This note could not be saved, so KajetAI has nothing to read yet. Save it and try again.",
  aiQuestionLabel: "KajetAI asks",
  aiHistoryTitle: "Earlier instructions",
  aiHistoryEmpty: "Nothing has been asked about this note yet.",
  aiForgetHistory: "Clear the conversation",
  aiNeedsConsent:
    "KajetAI sends the content of the note to Google and needs your consent. The model is " +
    "free, so Google may use what is sent to train its models.",
  aiGoToAccount: "Go to account settings",
  aiConsentSection: "KajetAI assistant",
  aiConsentWhatHappens:
    "When you ask KajetAI for a change, the content of the note – all the text, the code, " +
    "or the labels in the map nodes – will be sent to Google, because it is their model " +
    "that makes the change. Handwriting and photographs are not sent.",
  aiConsentTraining:
    "The model is free, so Google may use what is sent to train its models, and a Google " +
    "employee may read it. Do not send notes that are meant to stay private.",
  aiConsentVoluntary:
    "The consent is voluntary and you can withdraw it at any time. Without it KajetAI does " +
    "not work, and the rest of Kajet works as before.",
  aiConsentGiven: "Consent to sending note content to Google has been given.",
  aiConsentAgree: "I agree",
  aiConsentWithdraw: "Withdraw consent",
  aiConsentWithdrawn: "Consent withdrawn. Your conversations with KajetAI have been deleted.",
  aiNoQuestionAsked: "KajetAI wanted to ask something but gave no question.",
  aiUnknownTool: "KajetAI reached for a tool this note does not have.",
  aiTextUnsavable: "KajetAI returned the content in a shape that cannot be saved.",
  aiTextUnchanged: "KajetAI changed nothing in the note.",
  aiCodeUnsavable: "KajetAI returned the code in a shape that cannot be saved.",
  aiCodeUnchanged: "KajetAI changed nothing in the code.",
  aiMapUnsavable: "KajetAI returned the map changes in a shape that cannot be saved.",
  aiCodeNoteUnreadable: "The code note could not be read.",
  aiMindMapUnreadable: "The mind map could not be read.",
  aiMapNoOperations: "KajetAI gave no change to make.",
  aiMapNodeUnnamed: "KajetAI gave no name for the node it was adding.",
  aiMapNewNodeLoose: "KajetAI wanted to add a node connected to nothing.",
  aiMapNodeUnderItself: "KajetAI wanted to hang a node under itself.",
  aiMapNodeUnderOwnBranch: "KajetAI wanted to move a node under its own branch.",
  aiMapAddedNodeLoose: "KajetAI left the node it added with no link to the rest of the map.",
  aiMapNodeWithoutName: "After this change the map would hold a node nothing can point at.",
  aiMapTwoSameLinks: "After this change the map would have two links nothing can tell apart.",
  aiMapLinkToNowhere: "After this change the map would keep a link to a node that is gone.",
  aiMapSelfLink: "After this change the map would have a node hanging under itself.",

  apiServerBusy: "The server is busy running other people's code right now.",
  apiTryInSeconds: "Try again in a few seconds.",
  apiBadReleaseHash: "The checksum of the release file does not match.",
  apiNotAnApk: "That does not look like an APK. Choose the file with the app.",
  apiUploadFailed: "The file could not be received. Try again.",
  apiCannotRunLanguage: "Kajet cannot run this language on this server.",
  apiNotAProgram: "is not a program to run, but a page to look at.",
  apiGoogleNoEmail: "Google did not return an e-mail address.",
  apiNoInviteForGoogle: "No valid invite code for a new Google account.",

  actTokenRevoked: "Token revoked. The app on that device will ask you to sign in again.",
  actNoSuchToken: "There is no such token any more.",
  actGiveDeviceName: "Enter a device name.",
  actNoTokensToRevoke: "There are no tokens to revoke.",
  actSavedAutosaveOn: "Saved. Autosave is on.",
  actSavedAutosaveOff: "Saved. Autosave is off.",
  actPasswordTooShort: "The new password must be at least eight characters.",
  actCheckWhatYouTyped: "Check what you typed.",
  actPasswordsDiffer: "The new passwords do not match.",
  actGiveCurrentPassword: "Enter your current password.",
  actCurrentPasswordWrong: "The current password does not match.",
  actLoginRules:
    "A login can be 3 to 24 characters: lowercase letters, digits, dot, dash and underscore.",
  actLoginTaken: "That login is already taken.",
  actRestored: "Restored.",
  actDeletedForGood: "Deleted for good.",
  actMovedToFolder: "Moved into the folder.",
  actTakenOutOfFolder: "Taken out of the folder.",
  actGiveFolderName: "Enter a folder name.",
  actFolderNameTooLong: "The folder name is too long.",
  actLookChanged: "The look has been changed.",
  actNotAnEmail: "That does not look like an e-mail address.",
  actPasswordMinEight: "The password must be at least eight characters.",
  actPasswordsDifferTwice: "The passwords do not match. Type the same password twice.",
  actEmailTaken: "There is already an account on this address. Sign in, or recover the password.",
  actLoginTakenPickAnother: "That login is already taken. Pick another.",
  actAccountCreated:
    "Account created. We sent a message to confirm the address. You can sign in already.",
  actResetLinkSent:
    "If there is an account on this address, we sent a message with a link. Check your " +
    "inbox, and the spam folder too.",
  actLinkDeadAskNew: "This link no longer works. Ask for a new one.",
  actLinkExpiredHour: "The link was valid for an hour and has just expired. Ask for a new one.",
  actNoAccountOnAddress: "There is no account on this address any more.",
  actPasswordChangedEverywhere:
    "Password changed. For safety we signed out every device, so sign in again in the app too.",
  actSignInDenied: "Sign-in denied. The app will find out within a few seconds.",
  actNoFileArrived: "No file arrived.",
  actAdminOnly: "This action is for administrators only.",
  actCheckNumbers: "Check the numbers you typed.",
  actCopyRegistrationLink: "Copy the registration link",
  actUnlimitedGiven: "The account was given unlimited space.",
  actCannotBlockSelf: "You cannot block your own account.",
  actLoginRulesAdmin:
    "A login can be 3 to 24 characters: lowercase letters, digits, dot, dash and underscore.",
  actBadLogin: "That login does not follow the rules listed under the field.",
  actAccountHasAddress: "The account already has this address.",
  actAddressOnAnother: "Another account already uses this address.",
  actConfirmationSent: " A confirmation request went to the new address.",
  actConfirmationFailed: " The confirmation e-mail did not go out – pass the link on yourself.",

  actOnlyTextNotes: "On the website only text notes can be edited for now.",
  actRefreshAfterConflict: " Refresh the page and save again.",
  actNothingChanged: "The note is already saved.",
  actMindMapUnreadable: "The mind map could not be read.",
  actNotAMindMap: "That is not a mind map.",
  actHandwritingNeedsPage: "A handwritten note needs at least one page.",
  actHandwritingUnreadable: "The handwritten note could not be read.",
  actNotHandwriting: "That is not a handwritten note.",
  actLanguageUnsupported: "This language is not supported on the server.",
  actPickLanguage: "Choose a language.",
  actNoteDeletedForGood: "The note has been deleted for good.",
  actAddedToFavorites: "Added to favourites.",
  actRemovedFromFavorites: "Removed from favourites.",
  actAttachmentDataMissing: "Kajet cannot tell which file this is. Refresh the page and try again.",
  actAttachmentGone: "That attachment is gone already.",
  actOnlyOwnNote: "You can only share a note of your own.",
  actShareMailFailed:
    "The share is ready, but the e-mail did not go out. Pass the link on yourself:",
  actLinkReady: "The link is ready:",
  actShareGone: "That share is gone already.",
  actShareRevoked: "The share has been revoked. That link has stopped working.",
  actSavedNote: "Saved.",
  actNoteGone: "That note is gone. It may have been deleted, or it is in the bin.",
  actWhichNote: "Kajet cannot tell which note this is. Refresh the page and try again.",
  actPickFileFirst: "Choose a file to upload first.",
  actNotACodeFile: "This note is not a code file.",

  actCopyConfirmLink: "Copy the confirmation link",
  actResetMailFailed:
    "The e-mail did not go out. Pass the link on yourself – it is valid for an hour.",
  actCannotTakeOwnRights: "You cannot take away your own rights.",
  actStorageRecomputed: "The used space has been recomputed.",
  actCannotDeleteOwnAccount: "You cannot delete your own account.",
  actVersionExample: "A version looks like 1.4.2 or 2.0-beta.",
  actPickApkFirst: "Choose the APK file first.",
  actUploadLost: "The uploaded file is gone. Choose it again and upload once more.",
  actCopyDownloadLink: "Copy the download link",
  actNoReleaseLeft: " There is no release left; the download page says so plainly.",
  actDeviceWillSignIn: "should sign itself in within a few seconds.",
  actNoReleaseForDownload: "There is no release of the app yet. Look at the /download page.",
  actReleaseFileGone:
    "This release cannot be downloaded any more. Write to an administrator.",
  actWhichAccount: "Kajet cannot tell which account this is. Refresh the page and try again.",
  actWhichCode: "Kajet cannot tell which code to delete. Refresh the page and try again.",
  actCodeDeleted: "The code has been deleted.",
  actInviteMailFailed: "The message did not go out – pass the link on yourself.",
  actNoSuchRelease: "That release is gone.",
  daysWord: "days",

  strokeOpacity: "Stroke opacity",
  fontLabel: "Typeface",
  tableWord: "Table",
  dividerWord: "Dividing line",
  clearColourHint: "Remove the colour – the text goes back to the page colour",
  themeLabel: "Page theme",
  themeSystem: "Same as the system",
  themeLight: "Light",
  themeDark: "Dark",

  signInTitle: "Sign in",
  emailAddress: "E-mail address",
  password: "Password",
  wrongCredentials: "Wrong address or wrong password.",
  tooManyAttempts:
    "Too many failed sign-in attempts. For safety, wait a while and try again. " +
    "If you have forgotten your password, set a new one through “I forgot my password”.",
  forgotPassword: "I forgot my password",

  footerTerms: "Terms of service",
  footerPrivacy: "Privacy policy",
  metaTerms: "Terms of service – Kajet",
  metaPrivacy: "Privacy policy – Kajet",
  acceptTerms: "I accept the terms of service and the privacy policy.",
  mustAcceptTerms:
    "To create an account you have to accept the terms of service and the privacy policy.",

  footerContact: "Contact",
  metaContact: "Contact – Kajet",
  contactEyebrow: "Contact",
  contactHeading: "Write to us",
  contactLead:
    "A question, an idea, something not working? Fill in the form and the message " +
    "lands right with us. We answer to the address you give.",
  contactNameLabel: "Name or nickname",
  contactSubjectLabel: "Subject",
  contactMessageLabel: "Your message",
  contactSendButton: "Send the message",
  contactSendingWord: "Sending…",
  contactSent: "The message is on its way. Thank you – we will answer to the address you gave.",
  contactFillEverything: "Fill in every field and check the e-mail address.",
  contactTooMany: "Too many messages in a short time. Wait a moment and try again.",
  contactFailed: "The message could not be sent. Try again in a moment or write a plain e-mail.",
  contactNotSet: "The form is not wired up here yet. Write a plain e-mail instead.",
  contactMailInstead: "Prefer plain e-mail? Write to",
  contactCaptchaMissing: "First confirm in the box that you are not a robot.",
  contactCaptchaFailed: "We could not confirm that you are not a robot. Try again.",
  contactCaptchaUnavailable:
    "The box that checks you are not a robot could not load. " +
    "Refresh the page and try again, or write a plain e-mail instead.",

  deleteAccountEyebrow: "Deleting the account",
  deleteAccountLead:
    "Deleting an account takes two steps: first we send a code to your address, " +
    "then you type it in here. Once the code is in, everything goes at once.",
  deleteAccountWhatGoes:
    "What goes: every note with its contents, every attachment, folders, shared " +
    "links (they stop working immediately) and signed-in devices. This cannot be " +
    "undone. Export whatever you want to keep before you delete the account.",
  sendDeletionCodeButton: "Send the code by e-mail",
  sendingDeletionCode: "Sending the code…",
  deletionCodeSent:
    "The code has gone to your account's address. It is valid for an hour and works once.",
  deletionCodeLabel: "Code from the message",
  deletionCodeHint: "Eight characters, for example ABCD-EFGH. Letter case does not matter.",
  deleteAccountForever: "Delete the account for good",
  deletingAccount: "Deleting the account…",
  confirmDeleteAccount: "Delete the account with all your notes? This cannot be undone.",
  deletionGiveCode: "Type in the code from the message.",
  deletionCodeWrong: "Wrong code. Check the message or send a new code.",
  deletionCodeExpired: "This code is no longer valid. Send a new one.",
  deletionTooManyTries: "Too many failed attempts. Wait fifteen minutes and try again.",
  deletionMailFailed:
    "The message with the code could not be sent. Try again in a moment – the account stays as it is.",
  byeAccountDeleted:
    "The account has been deleted together with all its notes. Thank you and see you around.",
};

/*
  Zdania z liczbą w środku.

  Polska liczba mnoga ma trzy postacie („1 notatka", „2 notatki", „5 notatek"),
  a 12-14 idzie inaczej niż 22-24. Sklejanie rzeczownika z końcówką w widoku
  daje zdania, których nikt by nie napisał – stoją więc tu, całe.
*/
function polishPlural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one;
  const last = count % 10;
  const twoDigits = count % 100;
  return last >= 2 && last <= 4 && (twoDigits < 12 || twoDigits > 14) ? few : many;
}

export function notesCount(words: Words, count: number): string {
  if (words.locale === "en-GB") return `${count} ${count === 1 ? "note" : "notes"}`;
  return `${count} ${polishPlural(count, "notatka", "notatki", "notatek")}`;
}

/** Zdanie o tym, że kosz opróżnia się sam – liczbę dni bierzemy z ustawień. */
export function trashKeptFor(words: Words, days: number): string {
  if (words.locale === "en-GB") {
    return `The bin empties itself: a note older than ${days} ${days === 1 ? "day" : "days"} here goes away for good, together with its files.`;
  }
  return `Kosz opróżnia się sam: notatka, która leży tu dłużej niż ${days} ${polishPlural(days, "dzień", "dni", "dni")}, znika na zawsze razem z plikami.`;
}

/**
 * Odliczanie przy wpisie kosza — te same zdania co w koszu aplikacji.
 * „Dziś" i „jutro" osobno; po polsku każda liczba od dwóch bierze „dni".
 */
export function disappearsIn(words: Words, days: number): string {
  if (days <= 0) return words.locale === "en-GB" ? "Disappears today" : "Zniknie dziś";
  if (days === 1) return words.locale === "en-GB" ? "Disappears tomorrow" : "Zniknie jutro";
  return words.locale === "en-GB" ? `Disappears in ${days} days` : `Zniknie za ${days} dni`;
}

/**
 * Rachunek pod notatką tekstową: „212 słów · 1177 znaków".
 *
 * Liczby idą przez toLocaleString z językiem strony, więc po polsku jest
 * „1 177", a po angielsku „1,177" - wcześniej licznik miał wpisane „pl-PL"
 * na sztywno i Anglik dostawał polski format razem z polskim słowem.
 */
export function noteTally(words: Words, wordCount: number, chars: number): string {
  const w = wordCount.toLocaleString(words.locale);
  const c = chars.toLocaleString(words.locale);
  if (words.locale === "en-GB") {
    return `${w} ${wordCount === 1 ? "word" : "words"} · ${c} ${chars === 1 ? "character" : "characters"}`;
  }
  return (
    `${w} ${polishPlural(wordCount, "słowo", "słowa", "słów")} · ` +
    `${c} ${polishPlural(chars, "znak", "znaki", "znaków")}`
  );
}

export function attachmentsCount(words: Words, count: number): string {
  if (words.locale === "en-GB") {
    return `${count} ${count === 1 ? "attachment" : "attachments"}`;
  }
  return `${count} ${polishPlural(count, "załącznik", "załączniki", "załączników")}`;
}

export function foldersCount(words: Words, count: number): string {
  if (words.locale === "en-GB") return `${count} ${count === 1 ? "folder" : "folders"}`;
  return `${count} ${polishPlural(count, "folder", "foldery", "folderów")}`;
}

export function devicesCount(words: Words, count: number): string {
  if (words.locale === "en-GB") return `${count} ${count === 1 ? "device" : "devices"}`;
  return `${count} ${polishPlural(count, "urządzenie", "urządzenia", "urządzeń")}`;
}


export function folderDeleteWarning(words: Words, name: string, count: number): string {
  if (count === 0) {
    return words.locale === "en-GB"
      ? `Delete the folder \u201c${name}\u201d?`
      : `Skasować folder \u201e${name}\u201d?`;
  }
  return words.locale === "en-GB"
    ? `Delete the folder \u201c${name}\u201d? ${notesCount(words, count)} will be left ` +
        "without a folder – nothing is lost."
    : `Skasować folder \u201e${name}\u201d? ${notesCount(words, count)} ` +
        `${polishPlural(count, "zostanie", "zostaną", "zostanie")} bez folderu – ` +
        "nic nie przepadnie.";
}

/** Blokada konta z powodem wpisanym przez administratora. */
export function accountBlockedWith(words: Words, reason: string): string {
  return words.locale === "en-GB"
    ? `This account has been blocked: ${reason}`
    : `To konto zostało zablokowane: ${reason}`;
}

/** Podpowiedź przy przycisku motywu: „Motyw: jasny". */
export function themeOf(words: Words, name: string): string {
  return words.locale === "en-GB"
    ? `Theme: ${name.toLowerCase()}`
    : `Motyw: ${name.toLowerCase()}`;
}

/** Brakuje miejsca na koncie: ile zajęte z ilu. */
export function outOfSpaceReason(words: Words, used: string, quota: string): string {
  return words.locale === "en-GB"
    ? `Your account is out of space. ${used} of ${quota} used. Empty the bin, or ask an ` +
        "administrator for a bigger limit."
    : `Brakuje miejsca na koncie. Zajęte ${used} z ${quota}. Opróżnij kosz albo poproś ` +
        "administratora o większy limit.";
}

/*
  Miejsce skończyło się na całym serwerze, nie na koncie.

  Osobne zdanie od `outOfSpaceReason`, bo rada jest inna: kasowanie własnych
  notatek tu nie pomoże i szkoda, żeby ktoś je kasował na darmo. Notatki na
  urządzeniu piszą się dalej, więc mówimy o tym wprost - to jedyne, co
  człowieka w tej chwili obchodzi.
*/
export function serverOutOfSpaceReason(words: Words, used: string, limit: string): string {
  return words.locale === "en-GB"
    ? `The server has run out of space (${used} of ${limit} used), so it is not taking new ` +
        "notes right now. Nothing has been lost, and writing on your device works as usual. " +
        "Let the administrator know."
    : `Na serwerze skończyło się miejsce (zajęte ${used} z ${limit}) i nowe notatki na razie ` +
        "się na nim nie zapiszą. Nic nie przepadło, a pisanie na urządzeniu działa jak zawsze. " +
        "Daj znać administratorowi.";
}

/** Podpis pod zajętym miejscem w panelu: ile z tego, co serwer w ogóle przyjmie. */
export function spaceOfServerLimit(words: Words, limit: string): string {
  return words.locale === "en-GB" ? `of the server's ${limit}` : `z ${limit} dla serwera`;
}

/** Podpis pod wolnym miejscem w panelu: ile z granicy serwera jeszcze zostało. */
export function freeOfServerLimit(words: Words, limit: string): string {
  return words.locale === "en-GB" ? `still free of the server's ${limit}` : `jeszcze wolne z ${limit}`;
}

/**
 * Ostrzeżenie, gdy na dysku zostało mniej miejsca, niż granica serwera jeszcze
 * pozwala zapisać. Panel pokazuje wtedy w kafelku liczbę z granicy, a zapisy
 * i tak zatrzyma wcześniej dysk - o tym trzeba powiedzieć wprost.
 */
export function diskUnderLimitHint(words: Words, disk: string, limit: string): string {
  return words.locale === "en-GB"
    ? `The disk has ${disk} left, while the server limit still allows ${limit}. Writing will ` +
        "stop when the disk fills up, before the limit is reached. Free up space on the disk, " +
        "or lower SERVER_QUOTA_BYTES in the .env file."
    : `Na dysku zostało ${disk}, a granica serwera pozwala zapisać jeszcze ${limit}. Zapisywanie ` +
        "zatrzyma się na dysku, zanim dojdzie do granicy. Zwolnij miejsce na dysku albo obniż " +
        "SERVER_QUOTA_BYTES w pliku .env.";
}

/** Ostrzeżenie w panelu, zanim granica serwera zacznie odrzucać zapisy. */
export function serverNearlyFullHint(words: Words, used: string, limit: string): string {
  return words.locale === "en-GB"
    ? `${used} of ${limit} used. Once the limit is reached, the server stops taking new notes ` +
        "from everyone. Free some space, or raise SERVER_QUOTA_BYTES in the .env file."
    : `Zajęte ${used} z ${limit}. Po przekroczeniu granicy serwer przestanie przyjmować nowe ` +
        "notatki od wszystkich. Zwolnij miejsce albo podnieś SERVER_QUOTA_BYTES w pliku .env.";
}

/** Za dużo uruchomień kodu w ciągu minuty. */
export function tooManyRuns(words: Words, limit: number, retryInSeconds: number): string {
  if (words.locale === "en-GB") {
    const times = limit === 1 ? "once" : `${limit} times`;
    return `The code has already run ${times} in the past minute. Wait ${retryInSeconds} s and try again.`;
  }
  const times = limit === 1 ? "raz" : `${limit} razy`;
  return `Kod uruchomił się już ${times} w ciągu minuty. Odczekaj ${retryInSeconds} s i spróbuj jeszcze raz.`;
}

/** Wyczerpany limit wywołań KajetAI - dobowy albo godzinowy. */
export function aiLimitReached(
  words: Words,
  limit: number,
  window: "doba" | "godzina",
): string {
  if (words.locale === "en-GB") {
    const period = window === "doba" ? "the past 24 hours" : "the past hour";
    return `KajetAI has already been asked ${limit} times in ${period}. Try later.`;
  }
  const razy = limit === 1 ? "raz" : `${limit} razy`;
  const okres = window === "doba" ? "w ciągu doby" : "w ciągu godziny";
  return `KajetAI był już proszony o zmianę ${razy} ${okres}. Spróbuj później.`;
}

/**
 * Notatka za duża dla KajetAI. Nigdy nie obcinamy jej po cichu - notatka
 * wróciłaby wtedy skrócona o połowę, a człowiek dowiedziałby się o tym dopiero
 * przy czytaniu.
 */
export function aiNoteTooBig(words: Words, chars: number, most: number): string {
  const has = chars.toLocaleString(words.locale);
  const limit = most.toLocaleString(words.locale);
  return words.locale === "en-GB"
    ? `This note has ${has} characters and KajetAI takes at most ${limit}. ` +
        `Split it into smaller notes, or change the part you need by hand.`
    : `Ta notatka ma ${has} znaków, a KajetAI przyjmuje najwyżej ${limit}. ` +
        `Podziel ją na mniejsze albo popraw ten fragment ręcznie.`;
}

/** Załącznik cięższy, niż serwer przyjmuje. */
export function fileTooBig(words: Words, size: string): string {
  return words.locale === "en-GB"
    ? `The file is too big. The largest one accepted is ${size}.`
    : `Plik jest za duży. Największy przyjmowany rozmiar to ${size}.`;
}

/** To samo o pliku wydania - zdanie dla administratora, więc z nazwą ustawienia. */
export function releaseTooBig(words: Words, size: string): string {
  return words.locale === "en-GB"
    ? `The file is too big. The largest one accepted is ${size}. Change it with MAX_APP_BYTES in the .env file.`
    : `Plik jest za duży. Największy przyjmowany rozmiar to ${size}. Zmienisz to w MAX_APP_BYTES w pliku .env.`;
}

/** Limity uruchamiania kodu - wiersz w przeglądzie serwera. */

export function folderSettingsLabel(words: Words, name: string): string {
  return words.locale === "en-GB"
    ? `Settings for the folder \u201c${name}\u201d`
    : `Ustawienia folderu \u201e${name}\u201d`;
}


export function ownColourSlot(words: Words, index: number): string {
  return words.locale === "en-GB" ? `Your colour ${index}` : `Twój kolor ${index}`;
}

export function ownColourSlotHint(words: Words, index: number): string {
  return words.locale === "en-GB"
    ? `Your colour ${index} – select it to change it with the picker`
    : `Twój kolor ${index} – wybierz go, żeby zmienić go paletą`;
}

export function changeOwnColour(words: Words, index: number): string {
  return words.locale === "en-GB" ? `Change your colour ${index}` : `Zmień swój kolor ${index}`;
}

export function tooManyOwnColours(words: Words, limit: number): string {
  return words.locale === "en-GB"
    ? `More than ${limit} colours of your own will not fit`
    : `Więcej niż ${limit} własnych kolorów się nie zmieści`;
}

export function strokesOnPage(words: Words, count: number): string {
  if (words.locale === "en-GB") return `${count} ${count === 1 ? "stroke" : "strokes"}`;
  const last = count % 10;
  const twoDigits = count % 100;
  const noun =
    count === 1
      ? "kreska"
      : last >= 2 && last <= 4 && (twoDigits < 12 || twoDigits > 14)
        ? "kreski"
        : "kresek";
  return `${count} ${noun}`;
}


export function mapTally(words: Words, nodes: number, edges: number): string {
  if (words.locale === "en-GB") {
    return `${nodes} ${nodes === 1 ? "node" : "nodes"} · ` +
      `${edges} ${edges === 1 ? "connection" : "connections"}`;
  }
  const nodeWord = polishPlural(nodes, "węzeł", "węzły", "węzłów");
  const edgeWord = polishPlural(edges, "połączenie", "połączenia", "połączeń");
  return `${nodes} ${nodeWord} · ${edges} ${edgeWord}`;
}


export function addressConfirmedBody(words: Words, email: string): string {
  return words.locale === "en-GB"
    ? `The address ${email} is now confirmed. You can sign in here and in the tablet app.`
    : `Adres ${email} jest już potwierdzony. Możesz się zalogować tutaj i w aplikacji na tablecie.`;
}

export function deviceAsksForAccess(
  words: Words,
  device: string,
  login: string,
  email: string,
): string {
  return words.locale === "en-GB"
    ? `The Kajet app on “${device}” is asking for access to your account ${login} (${email}). ` +
        "Confirm if it was you who started the sign-in."
    : `Aplikacja Kajet na urządzeniu „${device}” prosi o dostęp do Twojego konta ${login} ` +
        `(${email}). Potwierdź, jeśli to Ty próbujesz się zalogować.`;
}


export function deviceAlreadyApproved(words: Words, device: string): string {
  return words.locale === "en-GB"
    ? `The device \u201c${device}\u201d is already approved. Go back to the Kajet app – ` +
        "it should sign itself in."
    : `Urządzenie \u201e${device}\u201d jest już zatwierdzone. Wróć do aplikacji Kajet – ` +
        "powinna się zalogować sama.";
}

export function approveButtonLabel(words: Words, device: string): string {
  return words.locale === "en-GB"
    ? `Approve \u201c${device}\u201d`
    : `Zatwierdź \u201e${device}\u201d`;
}


export function deviceNameLabel(words: Words, device: string): string {
  return words.locale === "en-GB"
    ? `Name of the device \u201c${device}\u201d`
    : `Nazwa urządzenia \u201e${device}\u201d`;
}


export function blockedOfWhich(words: Words, count: number): string {
  if (words.locale === "en-GB") return `${count} of them blocked`;
  return `w tym ${count} ${polishPlural(count, "zablokowane", "zablokowane", "zablokowanych")}`;
}

/** „ostatnie 7.08.2026” pod liczbą nowych kont; bez żadnego konta - inaczej. */
export function lastAccountOn(words: Words, when: Date | null): string {
  if (!when) return words.locale === "en-GB" ? "none yet" : "jeszcze żadnego";
  const date = when.toLocaleDateString(words.locale);
  return words.locale === "en-GB" ? `latest ${date}` : `ostatnie ${date}`;
}

/** „ostatnia 4.08.2026” pod liczbą awarii; przy pustym dzienniku - cisza. */
export function lastCrashOn(words: Words, when: Date | null): string {
  if (!when) return words.locale === "en-GB" ? "none ever reported" : "nigdy żadnej";
  const date = when.toLocaleDateString(words.locale);
  return words.locale === "en-GB" ? `latest ${date}` : `ostatnia ${date}`;
}

/** Notatki z całego tygodnia, pod liczbą dzisiejszych. */
export function notesThisWeek(words: Words, count: number): string {
  return words.locale === "en-GB" ? `${count} this week` : `w tym tygodniu ${count}`;
}




export function accountSummary(
  words: Words,
  email: string,
  notes: number,
  devices: number,
  since: string,
): string {
  return `${email} · ${notesCount(words, notes)} · ${devicesCount(words, devices)} · ` +
    `${words.accountSinceShort} ${since}`;
}

export function tooManySignInsIn(words: Words, minutes: number): string {
  if (words.locale === "en-GB") {
    const wait = minutes === 1 ? "a minute" : `${minutes} minutes`;
    return (
      `Too many failed sign-in attempts. For safety, wait ${wait} and try again. ` +
      "If you have forgotten your password, set a new one through “I forgot my password”."
    );
  }
  const wait = minutes === 1 ? "minutę" : `${minutes} min`;
  return (
    `Za dużo nieudanych prób logowania. Ze względów bezpieczeństwa odczekaj ${wait} ` +
    "i spróbuj jeszcze raz. Jeśli nie pamiętasz hasła, ustaw nowe przez " +
    "„Nie pamiętam hasła”."
  );
}

export function tokensRevokedMsg(words: Words, count: number): string {
  if (words.locale === "en-GB") {
    return `${count} ${count === 1 ? "token" : "tokens"} revoked. Sign the devices in again.`;
  }
  const noun = polishPlural(count, "token", "tokeny", "tokenów");
  return `Unieważniono ${count} ${noun}. Zaloguj urządzenia od nowa.`;
}

export function folderDeletedMsg(
  words: Words,
  name: string,
  inside: number,
  subfolders: number,
): string {
  if (words.locale === "en-GB") {
    return (
      `The folder “${name}” has been deleted.` +
      (inside > 0
        ? ` ${notesCount(words, inside)} left without a folder – nothing was lost.`
        : "") +
      (subfolders > 0 ? ` Folders inside it are gone too (${subfolders}).` : "")
    );
  }
  const left = polishPlural(inside, "notatka została", "notatki zostały", "notatek zostało");
  return (
    `Folder „${name}” skasowany.` +
    (inside > 0 ? ` ${inside} ${left} bez folderu – nic nie przepadło.` : "") +
    (subfolders > 0 ? ` Zniknęły też foldery w środku (${subfolders}).` : "")
  );
}

export function deviceConnectedMsg(words: Words, device: string): string {
  return words.locale === "en-GB"
    ? `Device “${device}” connected. Go back to the Kajet app – ` +
        words.actDeviceWillSignIn
    : `Połączono urządzenie „${device}”. Wróć do aplikacji Kajet – ` +
        words.actDeviceWillSignIn;
}

/*
  Odmowy KajetAI z nazwą węzła w środku.

  Nazwa jest w cudzysłowie, bo bierze się wprost z tego, co przysłał model –
  bez niej zdanie „takiego węzła nie ma" nie mówi, którego.
*/
export function aiMapTwoNodesSameName(words: Words, name: string): string {
  return words.locale === "en-GB"
    ? `KajetAI used the name “${name}” for two new nodes.`
    : `KajetAI użył nazwy „${name}” dla dwóch nowych węzłów.`;
}

export function aiMapNoParentForNew(words: Words, parent: string): string {
  return words.locale === "en-GB"
    ? `KajetAI wanted to hang a new node under “${parent}”, and there is no such node.`
    : `KajetAI chciał podwiesić nowy węzeł pod „${parent}”, a takiego węzła nie ma.`;
}

export function aiMapNoSuchNode(words: Words, name: string): string {
  return words.locale === "en-GB"
    ? `KajetAI pointed at the node “${name}”, and the map has no such node.`
    : `KajetAI wskazał węzeł „${name}”, a takiego w mapie nie ma.`;
}

export function aiMapNoParentForMove(words: Words, parent: string): string {
  return words.locale === "en-GB"
    ? `KajetAI wanted to move a node under “${parent}”, and there is no such node.`
    : `KajetAI chciał przenieść węzeł pod „${parent}”, a takiego węzła nie ma.`;
}

export function aiMapUnknownChange(words: Words, kind: string): string {
  return words.locale === "en-GB"
    ? `KajetAI asked for an unknown change “${kind}”.`
    : `KajetAI poprosił o nieznaną zmianę „${kind}”.`;
}

export function aiMapNodeTwice(words: Words, name: string): string {
  return words.locale === "en-GB"
    ? `After this change the map would hold the node “${name}” twice.`
    : `Po tej zmianie węzeł „${name}” byłby w mapie dwa razy.`;
}

/** Zużycie KajetAI na jednym koncie – wiersz w panelu administratora. */
export function aiUsageLine(
  words: Words,
  today: number,
  limit: number,
  week: number,
  tokens: number,
): string {
  const counted = tokens.toLocaleString(words.locale);
  if (words.locale === "en-GB") {
    return `Today: ${today} of ${limit}. This week: ${week} ${week === 1 ? "call" : "calls"}, ${counted} tokens.`;
  }
  const calls = polishPlural(week, "wywołanie", "wywołania", "wywołań");
  return `Doba: ${today} z ${limit}. Tydzień: ${week} ${calls}, ${counted} tokenów.`;
}

/* --- Panel administratora: spis kont --- */

export function accountsFound(
  words: Words,
  matching: number,
  shown: number,
  searching: boolean,
): string {
  if (words.locale === "en-GB") {
    const head = searching
      ? `Accounts matching the search: ${matching}.`
      : `All accounts: ${matching}.`;
    return matching > shown
      ? `${head} The first ${shown} are shown – narrow the search to see the rest.`
      : head;
  }
  const head = searching
    ? `Kont pasujących do wyszukiwania: ${matching}.`
    : `Wszystkich kont: ${matching}.`;
  return matching > shown
    ? `${head} Widać pierwszych ${shown} – zawęź wyszukiwanie, żeby zobaczyć resztę.`
    : head;
}

export function noAccountMatches(words: Words, query: string): string {
  return words.locale === "en-GB"
    ? `No account matches “${query}”.`
    : `Żadne konto nie pasuje do „${query}”.`;
}

/* --- Panel administratora: okna potwierdzenia --- */

export function confirmChangeEmail(words: Words, login: string): string {
  return words.locale === "en-GB"
    ? `Change the address of ${login}? Links sent to the old address will stop working.`
    : `Zmienić adres konta ${login}? Odnośniki wysłane na stary adres przestaną działać.`;
}

export function confirmSetPassword(words: Words, login: string): string {
  return words.locale === "en-GB"
    ? `Set a new password for ${login}? The account will be signed out on every device.`
    : `Ustawić nowe hasło dla ${login}? Konto zostanie wylogowane ze wszystkich urządzeń.`;
}

export function confirmBlockAccount(words: Words, login: string): string {
  return words.locale === "en-GB"
    ? `Block the account ${login}? It will be signed out on every device.`
    : `Zablokować konto ${login}? Zostanie wylogowane ze wszystkich urządzeń.`;
}

export function confirmMakeAdmin(words: Words, login: string): string {
  return words.locale === "en-GB"
    ? `Give ${login} administrator rights?`
    : `Nadać ${login} uprawnienia administratora?`;
}

/**
 * Nadanie KajetAI cudzemu kontu. Jedyne miejsce, w którym o wysyłaniu treści
 * do Google decyduje ktoś inny niż właściciel notatek - dlatego zdanie o
 * uczeniu modeli pada TU, przed nadaniem, a nie dopiero na ekranie zgody.
 */
export function confirmAllowAi(words: Words, login: string): string {
  return words.locale === "en-GB"
    ? `Allow ${login} to use KajetAI? The content of the notes they use it on will go ` +
        `to Google. The model is free, so Google may use it to train its models.`
    : `Pozwolić ${login} korzystać z KajetAI? Treść notatek, przy których go użyje, ` +
        `pojedzie do Google. Model jest darmowy, więc Google może wykorzystać ją ` +
        `do uczenia swoich modeli.`;
}

export function confirmDeleteUser(words: Words, login: string, notes: number): string {
  return words.locale === "en-GB"
    ? `Delete the account ${login} together with ${notesCount(words, notes)}? This cannot be undone.`
    : `Skasować konto ${login} razem z ${notesCount(words, notes)}? Tego nie da się cofnąć.`;
}

/* --- Panel administratora: odpowiedzi akcji --- */

export function inviteCodeReady(words: Words, code: string): string {
  return words.locale === "en-GB" ? `The code ${code} is ready.` : `Kod ${code} gotowy.`;
}

export function inviteSentTo(words: Words, email: string): string {
  return words.locale === "en-GB"
    ? `The invitation has gone to ${email}.`
    : `Zaproszenie poszło na ${email}.`;
}

export function quotaSetTo(words: Words, megabytes: number, forDays: number): string {
  if (words.locale === "en-GB") {
    const period = forDays > 0 ? ` for ${forDays} ${forDays === 1 ? "day" : "days"}` : "";
    return `The limit is now ${megabytes} MB${period}.`;
  }
  const period = forDays > 0 ? ` na ${forDays} ${polishPlural(forDays, "dzień", "dni", "dni")}` : "";
  return `Limit ustawiony na ${megabytes} MB${period}.`;
}

export function accountBlockedMsg(words: Words, login: string): string {
  return words.locale === "en-GB"
    ? `The account ${login} is blocked and signed out on every device.`
    : `Konto ${login} zablokowane i wylogowane ze wszystkich urządzeń.`;
}

export function accountUnblockedMsg(words: Words, login: string): string {
  return words.locale === "en-GB"
    ? `The account ${login} is unblocked.`
    : `Konto ${login} odblokowane.`;
}

export function accountLoginNowMsg(words: Words, login: string): string {
  return words.locale === "en-GB"
    ? `The account's login is now ${login}.`
    : `Konto ma teraz login ${login}.`;
}

export function accountEmailNowMsg(words: Words, email: string): string {
  return words.locale === "en-GB"
    ? `The account's address is now ${email}.`
    : `Konto ma teraz adres ${email}.`;
}

export function passwordLinkSentMsg(words: Words, email: string): string {
  return words.locale === "en-GB"
    ? `The link for setting a new password has gone to ${email}. It is valid for an hour.`
    : `Odnośnik do zmiany hasła poszedł na ${email}. Jest ważny przez godzinę.`;
}

export function passwordSetForMsg(words: Words, login: string): string {
  return words.locale === "en-GB"
    ? `Password set for ${login}. The account was signed out on every device.`
    : `Hasło dla ${login} ustawione. Konto zostało wylogowane ze wszystkich urządzeń.`;
}

export function adminRightsGivenMsg(words: Words, login: string): string {
  return words.locale === "en-GB"
    ? `${login} now has administrator rights.`
    : `${login} ma teraz uprawnienia administratora.`;
}

export function adminRightsTakenMsg(words: Words, login: string): string {
  return words.locale === "en-GB"
    ? `${login} is an ordinary user again.`
    : `${login} jest znowu zwykłym użytkownikiem.`;
}

export function codeRunningAllowedMsg(words: Words, login: string): string {
  return words.locale === "en-GB"
    ? `${login} can run code on the server again.`
    : `${login} może znowu uruchamiać kod na serwerze.`;
}

export function codeRunningTakenMsg(words: Words, login: string): string {
  return words.locale === "en-GB"
    ? `${login} will not run code on the server any more. Writing and saving still work.`
    : `${login} nie uruchomi już kodu na serwerze. Pisać i zapisywać nadal może.`;
}

export function aiAccessGivenMsg(words: Words, login: string, needsConsent: boolean): string {
  if (words.locale === "en-GB") {
    return (
      `${login} can now ask KajetAI for changes to notes.` +
      (needsConsent ? " They confirm consent to sending content to Google in their own settings." : "")
    );
  }
  return (
    `${login} może teraz prosić KajetAI o zmiany w notatkach.` +
    (needsConsent ? " Zgodę na wysyłanie treści do Google potwierdzi u siebie w ustawieniach." : "")
  );
}

export function aiAccessTakenMsg(words: Words, login: string): string {
  return words.locale === "en-GB"
    ? `${login} no longer has access to KajetAI. The notes stay untouched.`
    : `${login} nie ma już dostępu do KajetAI. Notatki zostają nietknięte.`;
}

export function aiLimitDefaultMsg(words: Words, login: string): string {
  return words.locale === "en-GB"
    ? `${login} goes back to the default KajetAI limit.`
    : `${login} wraca do domyślnego limitu wywołań KajetAI.`;
}

export function aiLimitSetMsg(words: Words, login: string, perDay: number): string {
  if (words.locale === "en-GB") {
    return `${login} now has ${perDay} KajetAI ${perDay === 1 ? "call" : "calls"} a day.`;
  }
  const calls = polishPlural(perDay, "wywołanie", "wywołania", "wywołań");
  return `${login} ma teraz ${perDay} ${calls} KajetAI na dobę.`;
}

export function accountDeletedMsg(words: Words, login: string): string {
  return words.locale === "en-GB"
    ? `The account ${login} is deleted, with everything that was on it.`
    : `Konto ${login} skasowane razem ze wszystkim, co na nim było.`;
}

export function releaseNumberTaken(words: Words, number: number, version: string): string {
  return words.locale === "en-GB"
    ? `The release number ${number} already belongs to version ${version}. Raise the number, or delete that release.`
    : `Numer wydania ${number} ma już wersja ${version}. Podnieś numer albo skasuj tamto wydanie.`;
}

export function olderReleasesGone(words: Words, count: number): string {
  if (words.locale === "en-GB") {
    return `Older releases (${count}) have gone from the database and from the disk.`;
  }
  return `Starsze wydania (${count}) poszły z bazy i z dysku.`;
}

export function releaseReadyMsg(words: Words, version: string): string {
  return words.locale === "en-GB"
    ? `Version ${version} is ready to download.`
    : `Wersja ${version} jest już do pobrania.`;
}

export function releaseNowCurrentMsg(words: Words, version: string): string {
  return words.locale === "en-GB"
    ? `Version ${version} is the one to download now.`
    : `Do pobrania idzie teraz wersja ${version}.`;
}

export function releaseDeletedMsg(words: Words, version: string): string {
  return words.locale === "en-GB"
    ? `Release ${version} is gone from the database and from the disk.`
    : `Wydanie ${version} skasowane z bazy i z dysku.`;
}

/* --- Notatka --- */

export function attachmentAddedMsg(words: Words, name: string): string {
  return words.locale === "en-GB"
    ? `The file “${name}” is with the note now.`
    : `Plik „${name}” leży już przy notatce.`;
}

export function attachmentRemovedMsg(words: Words, name: string): string {
  return words.locale === "en-GB"
    ? `The file “${name}” is gone from the note.`
    : `Plik „${name}” zniknął z notatki.`;
}

export function shareMailSentMsg(words: Words, email: string): string {
  return words.locale === "en-GB"
    ? `We sent a message to ${email}.`
    : `Wysłaliśmy wiadomość na ${email}.`;
}

const DICTIONARIES: Record<Language, Words> = { pl, en };

export function words(language: Language): Words {
  return DICTIONARIES[language] ?? pl;
}

/** Wybór z ciasteczka, jak zapisuje go przeglądarka. */
export function languageFromCookies(jar: string | null | undefined): Language {
  if (!jar) return DEFAULT_LANGUAGE;
  for (const piece of jar.split(";")) {
    const at = piece.indexOf("=");
    if (at < 0) continue;
    if (piece.slice(0, at).trim() !== LANGUAGE_COOKIE) continue;
    return knownLanguage(decodeURIComponent(piece.slice(at + 1).trim()));
  }
  return DEFAULT_LANGUAGE;
}
