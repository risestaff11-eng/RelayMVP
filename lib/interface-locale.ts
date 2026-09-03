import { translateToKazakh } from "./kazakh-translations";

// For browser-only effects (native confirm, canvas/PDF, generated messages).
// Never changes stored values, status enums or server calculations.
export function currentInterfaceLocale() {
  return typeof document !== "undefined" && document.documentElement.lang === "kk" ? "kk-KZ" : "ru-RU";
}
export function localizeInterface(value: string) {
  return currentInterfaceLocale() === "kk-KZ" ? translateToKazakh(value) : value;
}
