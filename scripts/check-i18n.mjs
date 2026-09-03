import { pathToFileURL } from "node:url";
import { collectInterfaceMessages, collectCssCaptions } from "./i18n-inventory.mjs";
import { hasKazakhTranslation } from "../lib/kazakh-translations.ts";

export function missingTranslations(messages) {
  return [...messages].filter(([text]) => !hasKazakhTranslation(text));
}

export function checkLocalization(root = process.cwd()) {
  const messages = collectInterfaceMessages(root);
  const missing = missingTranslations(messages);
  const missingCss = collectCssCaptions(root).filter((caption) => caption.missingSelectors.length);
  return { messages, missing, missingCss };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { messages, missing, missingCss } = checkLocalization();
  for (const [text, locations] of missing) {
    for (const { file, line } of locations) console.error(`${file}:${line}: Missing Kazakh translation: ${JSON.stringify(text)}`);
  }
  for (const { file, line, missingSelectors } of missingCss) console.error(`${file}:${line}: Missing Kazakh CSS caption rule: ${missingSelectors.join(", ")}`);
  console.log(`Kazakh localization: ${messages.size - missing.length}/${messages.size} source messages covered.`);
  if (missing.length || missingCss.length) process.exitCode = 1;
}
