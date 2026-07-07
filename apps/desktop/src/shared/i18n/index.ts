import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Pliki tłumaczeń: locales/<lang>/<feature>.json, każdy o kształcie { "<feature>": { ... } }.
// import.meta.glob wciąga je automatycznie — dodanie nowego feature'a nie wymaga edycji tego pliku.
const modules = import.meta.glob<{ default: Record<string, unknown> }>(
  "./locales/*/*.json",
  { eager: true }
);

const resources: Record<string, { translation: Record<string, unknown> }> = {};
for (const [path, mod] of Object.entries(modules)) {
  const lang = path.split("/")[2];
  resources[lang] ??= { translation: {} };
  Object.assign(resources[lang].translation, mod.default);
}

const STORAGE_KEY = "uiLang";

void i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem(STORAGE_KEY) ?? "pl",
  fallbackLng: "pl",
  interpolation: { escapeValue: false }
});

export function setUiLanguage(lng: string): void {
  localStorage.setItem(STORAGE_KEY, lng);
  void i18n.changeLanguage(lng);
}

export const UI_LANGUAGES = [
  { value: "pl", label: "Polski" },
  { value: "en", label: "English" }
] as const;

export default i18n;
