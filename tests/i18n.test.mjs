import assert from "node:assert/strict";
import test from "node:test";
import { translateToKazakh } from "../lib/kazakh-translations.ts";

test("translates key landing and cabinet interface text to Kazakh", () => {
  assert.equal(translateToKazakh("Запустить первую программу"), "Алғашқы бағдарламаны іске қосу");
  assert.equal(translateToKazakh("Рабочий стол"), "Басқару панелі");
  assert.equal(translateToKazakh("Кабинет агента"), "Агент кабинеті");
  assert.equal(translateToKazakh(" 50 000 AI-КРЕДИТОВ НА СТАРТЕ "), " БАСТАПҚЫДА 50 000 AI-КРЕДИТ ");
});

test("translates dynamic counters without changing business data", () => {
  assert.equal(translateToKazakh("3 заданий · 14 агентов · 6 результатов"), "3 тапсырма · 14 агент · 6 нәтиже");
  assert.equal(translateToKazakh("Открыть Northstar"), "Northstar ашу");
  assert.equal(translateToKazakh("user@example.com"), "user@example.com");
});
