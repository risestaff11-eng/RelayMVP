import { translateToKazakh } from "./kazakh-translations";

export const TRANSLATED_ATTRIBUTES = ["placeholder", "title", "aria-label", "aria-description", "alt", "data-label"] as const;
const protectedSelector = '[data-no-translate], [data-i18n-data], [translate="no"]';

export function translateInterfaceTree(root: HTMLElement | Document) {
  const document = root instanceof Document ? root : root.ownerDocument ?? globalThis.document;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest(`script, style, code, pre, textarea, [contenteditable], ${protectedSelector}`)) continue;
    const translated = translateToKazakh(node.data);
    if (translated === node.data) continue;
    // An option without a value submits its displayed text. Preserve the
    // original form contract before localizing the label (including after HMR).
    if (parent.tagName === "OPTION" && !parent.hasAttribute("value")) parent.setAttribute("value", parent.textContent ?? "");
    node.data = translated;
  }
  const elements = root instanceof Element ? [root, ...root.querySelectorAll<HTMLElement>("*")] : [...root.querySelectorAll<HTMLElement>("*")];
  for (const element of elements) {
    if (element.closest(protectedSelector)) continue;
    for (const attribute of TRANSLATED_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (value) {
        const translated = translateToKazakh(value);
        if (translated !== value) element.setAttribute(attribute, translated);
      }
    }
  }
}
