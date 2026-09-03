import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkLocalization, missingTranslations } from "../scripts/check-i18n.mjs";
import { collectInterfaceMessages } from "../scripts/i18n-inventory.mjs";
import { hasKazakhTranslation, translateToKazakh } from "../lib/kazakh-translations.ts";
import catalog from "../lib/i18n/kk.json" with { type: "json" };

test("all inventoried UI labels, attributes, dialogs and API errors have Kazakh entries", () => {
  const { messages, missing, missingCss } = checkLocalization();
  assert.ok(messages.size > 2500, "A reduced inventory must not silently hide gaps");
  assert.deepEqual(missing.map(([text, locations]) => `${locations[0].file}:${locations[0].line}: ${text}`), []);
  assert.deepEqual(missingCss, [], "CSS-only captions require an actual Kazakh CSS rule, not just a dictionary entry");
});

test("coverage catches a renamed button, new route, attributes, templates and errors", () => {
  const root = mkdtempSync(join(tmpdir(), "risestaff-i18n-"));
  try {
    for (const directory of ["app", "lib", "db"]) mkdirSync(join(root, directory));
    writeFileSync(join(root, "app/new-page.tsx"), `
      const error = "Специальная новая ошибка сервера";
      const hint = \`Ранее неизвестных событий: \${count}\`;
      export default () => <main><button>Открыть совершенно новый список</button>
        <input placeholder="Совсем новая подсказка" aria-label="Новое доступное имя" />
        <bdi data-no-translate>Имя клиента не переводим</bdi>
        <p>Создать компанию и открыть кабинет →</p></main>;
    `);
    const missing = missingTranslations(collectInterfaceMessages(root)).map(([text]) => text);
    assert.deepEqual(new Set(missing), new Set([
      "Специальная новая ошибка сервера", "Ранее неизвестных событий: {{0}}", "Открыть совершенно новый список",
      "Совсем новая подсказка", "Новое доступное имя",
    ]));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("catalogs preserve all template parameters and contain no translator markers", () => {
  const slots = (text) => [...text.matchAll(/\{\{\d+\}\}/g)].map((match) => match[0]).sort();
  for (const [source, target] of Object.entries(catalog)) {
    assert.ok(target.trim(), `Empty translation: ${source}`);
    assert.deepEqual(slots(target), slots(source), source);
    assert.doesNotMatch(target, /RSPARAM|__RS\d|TOKEN/, source);
  }
});

test("registration cabinet and checklist wording are both explicitly covered", () => {
  for (const phrase of ["Создать компанию и открыть кабинет →", "Создать компанию и открыть чек-лист →", "Открыть чек-лист"]) {
    assert.ok(hasKazakhTranslation(phrase), phrase);
    assert.notEqual(translateToKazakh(phrase), phrase);
  }
  assert.equal(hasKazakhTranslation("Открыть отсутствующий в словаре экран"), false);
});

test("mobile CSS-only transcript and collapse labels have Kazakh equivalents", () => {
  const css = readFileSync(new URL("../app/agent-polish.css", import.meta.url), "utf8");
  assert.ok(css.includes('html[lang="kk"] .result-audio-transcript::after'));
  assert.ok(css.includes('html[lang="kk"] .agent-submit-details[open] summary b::after'));
  for (const source of ["✓ Расшифровка проверена агентом", "Свернуть ↑"]) assert.ok(css.includes(`content: "${translateToKazakh(source)}"`));
});
