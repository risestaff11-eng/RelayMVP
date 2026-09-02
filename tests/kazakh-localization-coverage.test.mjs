import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const required = [
  ["app/onboarding/registration-form.tsx", "Создать компанию и открыть кабинет →"],
  ["app/company-application-form.tsx", "Оставить заявку"],
  ["app/page.tsx", "Заработать на рекомендациях"],
];

test("key Russian interface strings have a Kazakh dictionary entry", async () => {
  const dictionary = await readFile(new URL("../lib/kazakh-translations.ts", import.meta.url), "utf8");
  for (const [file, text] of required) {
    const page = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.ok(page.includes(text), `${file} changed: update the localization coverage list`);
    assert.match(dictionary, new RegExp(`"${text.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}"\\s*:`), `Missing Kazakh translation for: ${text}`);
  }
});
