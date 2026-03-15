// ============================================================
// Hebrew UI strings — ALL user-facing text
// /packages/shared/src/i18n/he.ts
// ============================================================

export const he = {
  // ─── General ───────────────────────────────────────────────
  app: {
    name: 'Sherlocked ERP',
    tagline: 'מערכת הניהול של שרלוקד האוס',
  },

  // ─── Auth ──────────────────────────────────────────────────
  auth: {
    login: 'כניסה למערכת',
    email: 'אימייל',
    password: 'סיסמה',
    loginButton: 'כניסה',
    logout: 'יציאה',
    loginError: 'פרטי הכניסה שגויים',
    forgotPassword: 'שכחתי סיסמה',
  },

  // ─── Navigation ─────────────────────────────────────────────
  nav: {
    dashboard: 'לוח בקרה',
    shifts: 'משמרות',
    shiftsConstraints: 'הגשת אילוצים',
    shiftsBoard: 'לוח משמרות',
    bookings: 'הזמנות',
    calendar: 'יומן משחקים',
    customers: 'רשימת לקוחות',
    slotsSettings: 'הגדרות סלוטים',
    slotsAdd: 'הוספת סלוטים',
    slotsDelete: 'מחיקת סלוטים',
    journalSettings: 'הגדרות יומן',
    exportImport: 'ייצוא / ייבוא',
    payments: 'ניהול תשלומים',
    paymentsList: 'רשימת תשלומים',
    paymentLink: 'יצירת לינק תשלום',
    paymentsReports: 'דוחות תשלום',
    cashRegister: 'ספירת קופה',
    tasks: 'משימות',
    dailyTasks: 'משימות יומיות',
    manageTasks: 'ניהול משימות',
    openingChecklist: 'צ\'ק ליסט פתיחה',
    closingChecklist: 'צ\'ק ליסט סגירה',
    vouchers: 'שוברים',
    vouchersList: 'רשימת שוברים',
    newVoucher: 'הזמנת שובר',
    voucherTypes: 'סוגי שוברים',
    operatorInfo: 'מידע למפעיל',
    employees: 'עובדים',
    attendance: 'דיווח נוכחות',
    payroll: 'דוח שעות',
    payrollHours: 'דוח שעות',
    payrollSalary: 'ניהול שכר',
    payrollHolidays: 'חגים ומועדים',
    payrollSummary: 'סיכום שכר חודשי',
    payrollBank: 'ניהול חשבונות בנק',
    settings: 'הגדרות',
    company: 'פרטי חברה',
    rooms: 'חדרים ומחירים',
    adminCalendar: 'הגדרות יומן',
    bookingSettings: 'הגדרות הזמנות',
    shiftsSettings: 'הגדרות משמרות',
    attendanceSettings: 'הגדרות נוכחות',
    whatsapp: 'WhatsApp',
    backup: 'גיבויים',
  },

  // ─── Rooms ─────────────────────────────────────────────────
  rooms: {
    room1: 'חדר 1',
    room2: 'חדר 2',
    room3: 'חדר 3',
    mythosVip: 'מיתוס VIP',
    mythosBadge: 'VIP',
    ageMin: 'גיל מינימלי',
    ageWarning: 'חדר זה מיועד לגילאי 16+ בלבד',
    noDiscounts: 'אין הנחות בחדר מיתוס VIP',
  },

  // ─── Booking Widget ─────────────────────────────────────────
  booking: {
    title: 'הזמן חדר בריחה',
    selectSlot: 'בחר שעה',
    book: 'הזמנה',
    bookNow: 'הזמן עכשיו',
    available: 'פנוי',
    unavailable: 'תפוס',
    step1: 'בחירת שעה',
    step2: 'פרטי הזמנה',
    step3: 'תשלום',

    // Form fields
    fullName: 'שם מלא',
    phone: 'פלאפון',
    email: 'אימייל',
    emailOptional: 'אימייל (לא חובה)',
    referralSource: 'איך הגעתם אלינו?',
    referralGoogle: 'גוגל',
    referralFacebook: 'פייסבוק',
    referralFriend: 'חבר',
    referralSign: 'שלט',
    referralOther: 'אחר',
    escapeExperience: 'ניסיון חדרי בריחה?',
    experienceFirst: 'ראשון',
    experience1to3: '1-3 חדרים',
    experience4plus: '4+',
    experienceExpert: 'מנוסים',
    participants: 'מספר משתתפים',
    notes: 'הערות הזמנה',
    notesOptional: 'הערות (לא חובה)',

    // Voucher
    hasVoucher: 'יש לי קוד שובר מתנה',
    voucherCode: 'קוד שובר',
    voucherValidate: 'אמת שובר',
    voucherValid: 'השובר תקין! הנחה: ₪{amount}',
    voucherInvalid: 'קוד שובר לא תקין',
    voucherUsed: 'השובר כבר שומש',
    voucherExpired: 'השובר פג תוקף',

    // Escape Club
    isClubMember: 'האם אתה חבר Escape Club?',
    clubYes: 'כן',
    clubNo: 'לא',
    clubMemberLookup: 'מספר פלאפון או מזהה חבר',
    clubMemberValid: 'חבר מועדון מאומת ✅',
    clubMemberInvalid: 'לא נמצא חבר מועדון עם פרטים אלה',
    clubJoinPromo: 'הצטרף עכשיו וקבל ₪15 הנחה!',
    clubJoinTitle: 'הצטרף ל-Escape Club',
    clubJoinSubtitle: 'הצטרף בחינם וקבל הטבות בכל ביקור',
    clubJoinButton: 'הצטרף וקבל הנחה',
    clubJoinMaybeLater: 'אולי בפעם הבאה',

    // Cancellation policy
    cancellationPolicy: 'מדיניות ביטולים',
    cancellationPolicyText: 'ביטול עד 24 שעות לפני — ללא חיוב • ביטול בין 24 שעות ל-2 שעות לפני — חיוב 50% • ביטול פחות מ-2 שעות / אי הגעה / איחור מעל 30 דק\' — חיוב מלא 100%',
    termsAccept: 'קראתי והסכמתי לתנאי התקנון',
    termsLink: 'תקנון שרלוקד האוס',

    // Summary panel
    room: 'חדר בריחה',
    date: 'תאריך',
    time: 'שעה',
    duration: '60 דקות',
    regularPrice: 'מחיר רגיל',
    memberPrice: 'מחיר מועדון',
    voucherDiscount: 'הנחת שובר',
    totalToPay: 'סה"כ לתשלום',
    timeLeft: 'זמן שנותר',

    // Hold mechanism
    holdWarning: 'זמן שנותר לסיום ההזמנה:',
    changeTime: 'החלף שעה',

    // Success
    successTitle: 'ההזמנה אושרה! ✅',
    successSubtitle: 'הפרטים נשלחו ב-WhatsApp',
    bookingId: 'מספר הזמנה',
  },

  // ─── Attendance ─────────────────────────────────────────────
  attendance: {
    title: 'דיווח נוכחות',
    clockIn: 'כניסה למשמרת',
    clockOut: 'יציאה ממשמרת',
    tokenPlaceholder: 'הכנס קוד WiFi (6 ספרות)',
    tokenInvalid: 'לא ניתן לרשום נוכחות — ודא שאתה במתחם',
    tokenValid: 'קוד אומת ✅',
    clockedIn: 'נרשמת בשעה {time}',
    clockedOut: 'יצאת בשעה {time} | משמרת: {duration}',
    runningTimer: 'זמן משמרת',
    noActiveShift: 'אין משמרת פעילה',
    manualEntry: 'הזנה ידנית',
  },

  // ─── Shifts ─────────────────────────────────────────────────
  shifts: {
    morning: 'בוקר',
    evening: 'ערב',
    morning1: 'בוקר1',
    morning2: 'בוקר2',
    evening1: 'ערב1',
    evening2: 'ערב2',
    available: 'פנוי',
    unavailable: 'לא פנוי',
    submit: 'שמור שיבוצים',
    constraintsSaved: 'האילוצים נשמרו בהצלחה',
    reminderMessage: 'תזכורת: מלא אילוצים לשבוע הבא',
  },

  // ─── Payroll ─────────────────────────────────────────────────
  payroll: {
    date: 'תאריך',
    day: 'יום',
    clockIn: 'כניסה',
    clockOut: 'יציאה',
    hours100: '100%',
    hours125: '125%',
    hours150: '150%',
    hours175: '175%',
    hours200: '200%',
    hoursShabbat: 'שבת',
    total: 'סה"כ',
    note: 'הערה',
    actions: 'פעולות',
    approved: 'מאושר',
    paid: 'שולם',
    draft: 'טיוטה',
    alertLongShift: 'עובד זה נרשם לכניסה לפני 10 שעות ללא יציאה',
  },

  // ─── Escape Club ────────────────────────────────────────────
  escapeClub: {
    title: 'Escape Club',
    benefit1: '₪15 הנחה לכל שחקן בכל משחק',
    benefit2: '₪50 מתנה ביום ההולדת',
    benefit3: 'הצעות בלעדיות לחברי מועדון',
    active: 'פעיל',
    inactive: 'לא פעיל',
    notMember: 'לא חבר מועדון',
    joinFree: 'הצטרף בחינם',
    memberSince: 'חבר מאז',
    totalSaved: 'הנחה צבורה',
    addBirthdayCredit: 'הוסף קרדיט יום הולדת',
    birthdayGift: '🎁 קרדיט יום הולדת ₪50 (תוקף 30 יום)',
    idNumber: 'ת.ז',
    dob: 'יום הולדת',
    area: 'אזור',
  },

  // ─── Payments ───────────────────────────────────────────────
  payments: {
    method_card: 'כרטיס אשראי',
    method_cash: 'מזומן',
    method_voucher: 'שובר',
    method_credit: 'אשראי קומפ',
    status_pending: 'ממתין',
    status_paid: 'שולם',
    status_failed: 'נכשל',
    status_refunded: 'הוחזר',
    createLink: 'צור לינק ושלח ללקוח',
    discount_military: 'חייל ₪10',
    discount_student: 'סטודנט ₪10',
    discount_family: 'משפחות חול ₪100',
    discount_club: 'מועדון ₪15 לאדם',
    vat: 'מע"מ',
    totalWithVat: 'סה"כ כולל מע"מ',
  },

  // ─── Cancellation ────────────────────────────────────────────
  cancellation: {
    title: 'ביטול הזמנה',
    bookingId: 'מספר הזמנה',
    cancelledAt: 'מועד ביטול',
    hoursUntilGame: 'שעות עד המשחק',
    fee: 'דמי ביטול',
    noFee: 'ללא חיוב',
    halfFee: 'חיוב 50%',
    fullFee: 'חיוב מלא 100%',
    confirmPartial: 'חיוב והחזר חלקי',
    confirmFull: 'חיוב מלא',
    confirmFree: 'ביטול ללא חיוב',
    cancel: 'ביטול',
    sendWhatsApp: 'שלח עדכון WhatsApp ללקוח',
  },

  // ─── Cash Register ─────────────────────────────────────────
  cashRegister: {
    title: 'ספירת קופה',
    room: 'חדר',
    shift: 'משמרת',
    openingAmount: 'פתיחה',
    cashSales: 'מכירות מזומן',
    cardSales: 'מכירות אשראי',
    closingAmount: 'סגירה',
    notes: 'הערות',
    save: 'שמור',
    morning: 'בוקר',
    evening: 'ערב',
  },

  // ─── WhatsApp ────────────────────────────────────────────────
  whatsapp: {
    connected: 'מחובר ✅',
    disconnected: 'מנותק ❌',
    scanQr: 'סרוק קוד QR לחיבור',
    qrRefresh: 'מרענן בעוד {seconds} שניות',
    template_confirmation: 'אישור הזמנה',
    template_reminder: 'תזכורת',
    template_birthday: 'ברכת יום הולדת',
    template_debt: 'יתרת חוב',
  },

  // ─── Days of week ─────────────────────────────────────────────
  days: {
    0: 'ראשון',
    1: 'שני',
    2: 'שלישי',
    3: 'רביעי',
    4: 'חמישי',
    5: 'שישי',
    6: 'שבת',
  },

  // ─── Common actions ───────────────────────────────────────────
  actions: {
    save: 'שמור',
    cancel: 'ביטול',
    edit: 'ערוך',
    delete: 'מחק',
    confirm: 'אשר',
    close: 'סגור',
    add: 'הוסף',
    search: 'חיפוש',
    filter: 'סינון',
    export: 'ייצוא',
    import: 'ייבוא',
    approve: 'אשר',
    back: 'חזור',
    next: 'הבא',
    prev: 'הקודם',
    loading: 'טוען...',
    error: 'שגיאה',
    success: 'הצלחה',
    required: 'שדה חובה',
  },

  // ─── Currency formatting ──────────────────────────────────────
  currency: {
    symbol: '₪',
    format: (amount: number) => `₪${amount.toLocaleString('he-IL')}`,
  },
} as const;

export type HebKeys = typeof he;
export default he;
