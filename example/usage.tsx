/**
 * Usage examples — all features in one file
 *
 * These are real-world patterns, not toy demos.  Each section is
 * independently copy-pasteable.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. App setup
// ─────────────────────────────────────────────────────────────────────────────

import { I18nProvider, useTranslation, T } from "../src/runtime/react";

// i18n.config.ts  — single source of truth for build + runtime
export const i18nConfig = {
  supported: ["en", "da", "de", "fr", "ar"],
  default: "en",
  storageKey: "preferred_locale",
  cookieName: "app_locale",
  pathIndex: 1,             // /da/products → "da"
  loadLocale: (locale: string) =>
    import(`../locales/${locale}.js`) as any,
};

// App.tsx
function App({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider
      config={i18nConfig}
      fallback={<div>Loading…</div>}
    >
      {children}
    </I18nProvider>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// 2. Plain translation — text visible without keys
// ─────────────────────────────────────────────────────────────────────────────

function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t("Settings")}</h1>
      <p>{t("Manage your account preferences")}</p>
    </div>
  );
}

// JSX equivalent — identical DX
function SettingsPageJSX() {
  return (
    <div>
      <h1><T>Settings</T></h1>
      <p><T>Manage your account preferences</T></p>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// 3. String interpolation
// ─────────────────────────────────────────────────────────────────────────────

function WelcomeBanner({ user }: { user: { name: string } }) {
  const { t } = useTranslation();

  // Source: "Hello, {name}!"
  // da.js:  (v)=>`Hej, ${v.name}!`
  return <p>{t("Hello, {name}!", { name: user.name })}</p>;
}

// JSX version — React children as the source string
function WelcomeBannerJSX({ user }: { user: { name: string } }) {
  return <p><T name={user.name}>{"Hello, {name}!"}</T></p>;
}


// ─────────────────────────────────────────────────────────────────────────────
// 4. Pluralization (ICU)
// ─────────────────────────────────────────────────────────────────────────────

function CartSummary({ count }: { count: number }) {
  const { t } = useTranslation();

  // Source: "You have {count, plural, one {# item} other {# items}} in your cart"
  // Compiled da.js entry (emitted by the compiler):
  //   (v,_pf)=>`Du har ${_pf(v.count,"da",0,"one","# vare","other","# varer")} i din indkøbskurv`
  return (
    <p>
      {t(
        "You have {count, plural, one {# item} other {# items}} in your cart",
        { count },
      )}
    </p>
  );
}

// JSX version
function CartSummaryJSX({ count }: { count: number }) {
  return (
    <p>
      <T count={count}>
        {"You have {count, plural, one {# item} other {# items}} in your cart"}
      </T>
    </p>
  );
}

// Arabic has 6 plural forms — handled automatically by Intl.PluralRules
// Source:  "لديك {count, plural, zero {لا رسائل} one {رسالة واحدة} two {رسالتان} few {# رسائل} many {# رسالة} other {# رسالة}}"
// The compiler emits the right _pf call; the runtime resolves it via "ar" PluralRules.


// ─────────────────────────────────────────────────────────────────────────────
// 5. Exact value matching in plurals (=N)
// ─────────────────────────────────────────────────────────────────────────────

function FriendCount({ count }: { count: number }) {
  const { t } = useTranslation();

  // =0 → special message, =1 → "just you", one → "1 friend", other → "N friends"
  return (
    <p>
      {t(
        "{count, plural, =0 {No friends yet — invite someone!} =1 {Just you for now} one {# friend} other {# friends}}",
        { count },
      )}
    </p>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// 6. Gender / select
// ─────────────────────────────────────────────────────────────────────────────

function ProfileUpdate({ gender }: { gender: "male" | "female" | "other" }) {
  const { t } = useTranslation();

  // Source: "{gender, select, male {He updated his profile} female {She updated her profile} other {They updated their profile}}"
  // Compiled da.js:
  //   (v)=>`${((v)=>{switch(v.gender){case "male":return`Han opdaterede sin profil`;case "female":return`Hun opdaterede sin profil`;default:return`De opdaterede deres profil`;}})(v)}`
  return <p>{t("{gender, select, male {He updated his profile} female {She updated her profile} other {They updated their profile}}", { gender })}</p>;
}


// ─────────────────────────────────────────────────────────────────────────────
// 7. Rich React children (links, bold, icons — no dangerouslySetInnerHTML)
// ─────────────────────────────────────────────────────────────────────────────

function TermsNotice() {
  return (
    <p>
      <T
        link={<a href="/terms" className="underline" />}
        bold={<strong />}
      >
        {"By continuing you agree to {link}our {bold}Terms of Service{/bold}{/link}"}
      </T>
    </p>
  );
  // Renders: By continuing you agree to <a href="/terms">our <strong>Terms of Service</strong></a>
}


// ─────────────────────────────────────────────────────────────────────────────
// 8. Number formatting
// ─────────────────────────────────────────────────────────────────────────────

function PriceDisplay({ amount }: { amount: number }) {
  const { formatNumber, formatCurrency, formatPercent } = useTranslation();

  return (
    <div>
      {/* "en" → "1,234,567.89"  |  "de" → "1.234.567,89" */}
      <p>{formatNumber(1_234_567.89)}</p>

      {/* "en" → "$9.99"  |  "da" → "9,99 kr." */}
      <p>{formatCurrency(9.99, "USD")}</p>
      <p>{formatCurrency(9.99, "DKK")}</p>

      {/* "en" → "42%"  |  "ar" → "٤٢٪" */}
      <p>{formatPercent(0.42)}</p>

      {/* Full control via Intl options */}
      <p>{formatNumber(amount, { maximumFractionDigits: 0, notation: "compact" })}</p>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// 9. Date formatting
// ─────────────────────────────────────────────────────────────────────────────

function EventCard({ date }: { date: Date }) {
  const { formatDate, formatRelativeAuto } = useTranslation();

  return (
    <div>
      {/* Preset: "en" → "Apr 21, 2026"  |  "da" → "21. apr. 2026" */}
      <p>{formatDate(date, "medium")}</p>

      {/* Preset: "en" → "Monday, April 21, 2026" */}
      <p>{formatDate(date, "full")}</p>

      {/* Custom options */}
      <p>{formatDate(date, { weekday: "short", month: "short", day: "numeric" })}</p>

      {/* Auto relative: "3 days ago" / "in 2 hours" / "om 3 dage" */}
      <p>{formatRelativeAuto(date)}</p>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// 10. List formatting
// ─────────────────────────────────────────────────────────────────────────────

function TagList({ tags }: { tags: string[] }) {
  const { formatList } = useTranslation();

  // "en" → "React, TypeScript, and Vite"
  // "da" → "React, TypeScript og Vite"
  // "zh" → "React、TypeScript和Vite"
  return <p>{formatList(tags)}</p>;
}


// ─────────────────────────────────────────────────────────────────────────────
// 11. Locale switcher
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORTED_LOCALES = [
  { code: "en", label: "English" },
  { code: "da", label: "Dansk" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
];

function LocaleSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <select value={locale} onChange={(e) => setLocale(e.target.value)}>
      {SUPPORTED_LOCALES.map(({ code, label }) => (
        <option key={code} value={code}>{label}</option>
      ))}
    </select>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// 12. Outside React — Zod schemas, error constants
// ─────────────────────────────────────────────────────────────────────────────

import { translate } from "../src/runtime/react";

// Load the messages map however makes sense (passed down, singleton, etc.)
declare const messages: Record<string, any>;
declare const locale: string;

const VALIDATION_ERRORS = {
  required: (l: string, msgs: typeof messages) =>
    translate("This field is required", msgs, l),
  email: (l: string, msgs: typeof messages) =>
    translate("Please enter a valid email address", msgs, l),
};


// ─────────────────────────────────────────────────────────────────────────────
// 13. Translator context comments (in compiler manifest, not runtime)
// ─────────────────────────────────────────────────────────────────────────────

// In your source code, attach a comment via the second arg — the compiler
// picks it up and writes it into translation-manifest.json for translators.
// This does not affect the runtime at all.

function BookingButton() {
  const { t } = useTranslation();
  return (
    <button>
      {t("Book", {
        // @i18n-comment: verb — to reserve a slot, not a physical book
      } as any)}
    </button>
  );
}

// The compiler emits in translation-manifest.json:
// {
//   "Book": {
//     "comment": "verb — to reserve a slot, not a physical book",
//     "locations": ["src/components/BookingButton.tsx:3"]
//   }
// }
