import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Lightweight app translations. Default language is Hebrew. Add keys here and use `t('key')`
// from any component via `useLang()`. Falls back to the English string, then the key itself.
const TRANSLATIONS = {
  he: {
    myProfile: 'הפרופיל שלי',
    players: 'שחקנים',
    games: 'משחקים',
    league: 'ליגה',
    deposit: 'הפקדות',
    agents: 'סוכנים',
    showChipless: "הצג שחקנים ללא צ'יפים",
    playersTitle: 'שחקנים',
    playersHoldingChips: "שחקנים שמחזיקים צ'יפים",
    searchPlaceholder: 'חיפוש לפי שם משתמש או שם...',
    playersWord: 'שחקנים',
    colUsername: 'שם משתמש',
    colFullName: 'שם מלא',
    colAgent: 'סוכן',
    noPlayers: 'לא נמצאו שחקנים',
    clubRules: 'תקנון המועדון',
    depositTitle: 'הפקדת KashCash',
    depositSubtitle: 'תשלום מאובטח דרך KashCash',
    amount: 'סכום',
    customAmount: 'או הזן סכום אחר',
    processing: 'מעבד...',
    depositBtn: 'הפקדת KashCash',
    securePayments: 'התשלומים מעובדים באופן מאובטח דרך KashCash',
    completePayment: 'השלם את התשלום',
    cancel: 'ביטול',
    scanQr: 'סרוק את קוד ה-QR להשלמת התשלום',
    verifyingPayment: 'מאמת תשלום מול KashCash...',
    paymentConfirmed: "התשלום אושר! הצ'יפים יתווספו לחשבונך בקרוב.",
    paymentFailed: 'התשלום בוטל או נדחה. נסה שוב.',
    depositHistory: 'היסטוריית הפקדות',
    colDate: 'תאריך',
    colAmount: 'סכום',
    colTxid: 'מזהה עסקה',
    colStatus: 'סטטוס',
    statusAdded: 'נוסף',
    statusPending: 'ממתין',
  },
  en: {
    myProfile: 'My Profile',
    players: 'Players',
    games: 'Games',
    league: 'League',
    deposit: 'Deposit KashCash',
    agents: 'Agents',
    showChipless: 'Show players without chips',
    playersTitle: 'Players',
    playersHoldingChips: 'Players who hold chips',
    searchPlaceholder: 'Search by username or name...',
    playersWord: 'players',
    colUsername: 'Username',
    colFullName: 'Full Name',
    colAgent: 'Agent',
    noPlayers: 'No players found',
    clubRules: 'Club Rules',
    depositTitle: 'KashCash Deposit',
    depositSubtitle: 'Secure payment via KashCash',
    amount: 'Amount',
    customAmount: 'Or enter custom amount',
    processing: 'Processing...',
    depositBtn: 'Deposit KashCash',
    securePayments: 'Payments are processed securely by KashCash',
    completePayment: 'Complete your payment',
    cancel: 'Cancel',
    scanQr: 'Scan the QR code to complete your payment',
    verifyingPayment: 'Verifying payment with KashCash...',
    paymentConfirmed: 'Payment confirmed! Chips will be added to your account shortly.',
    paymentFailed: 'Payment was cancelled or rejected. Please try again.',
    depositHistory: 'Deposit History',
    colDate: 'Date',
    colAmount: 'Amount',
    colTxid: 'KashCash TxID',
    colStatus: 'Status',
    statusAdded: 'Added',
    statusPending: 'Pending',
  },
};

const LangContext = createContext({ lang: 'he', toggleLang: () => {}, setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'he');
  useEffect(() => { localStorage.setItem('lang', lang); }, [lang]);
  const toggleLang = useCallback(() => setLang(l => (l === 'he' ? 'en' : 'he')), []);
  const t = useCallback(
    (key) => (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS.en[key] || key,
    [lang]
  );
  return <LangContext.Provider value={{ lang, toggleLang, setLang, t }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
