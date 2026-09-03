# Kazakh interface localization

## What is localized

The shared RU/ҚАЗ preference (`relay_locale`) still works across the landing,
company, agent and admin surfaces. Existing Russian source strings stay the
canonical interface copy. `lib/kazakh-translations.ts` combines the original
catalog with `lib/i18n/kk.json`, normalizes whitespace, and supports parameterized
messages, number phrases and dates. No account/schema migration is required.

The supplemental catalog was drafted with machine translation, then reviewed
for product terminology, CRM stages, payment meanings, buttons and placeholders.
This is not a certified linguistic or legal translation. A native-language
editor should review long marketing and legal passages before relying on them
as approved public/legal copy.

The existing client-side mechanism is retained: server-rendered copy initially
uses Russian; the Kazakh preference localizes it after hydration. This does not
introduce separate `/kk` SEO pages or translated social-preview images.

## Adding or changing copy

1. Change the Russian interface text.
2. Run `pnpm i18n:check`. Missing entries include the file, line and exact text.
3. Add the Kazakh equivalent to `lib/i18n/kk.json`. Templates use `{{0}}`,
   `{{1}}`, etc. Preserve every parameter and any literal confirmation token.
4. Run `pnpm test`. Coverage, placeholder, DOM, registration and CRM tests are
   part of the normal suite, so CI rejects missing source messages.

The inventory scans all TypeScript/TSX files in `app`, `lib` and `db`, including
JSX text, label/placeholder attributes, string constants, dialogs, templates and
API error messages. It also inventories CSS `content` captions. CSS captions
need an explicit `html[lang="kk"]` rule: they aren't translated by the DOM helper.

Excluded: provider instructions/schemas, parsing tokens, console logs,
HTML email templates and protected business data. The scanner is deliberately
broad, but it cannot prove that every possible runtime concatenation is covered.
Add a runtime test when introducing a new dynamic message format.

## Protect business data

Use `<bdi data-no-translate>{record.name}</bdi>` for stored names, program and
task descriptions, comments, file names, and submitted answers. Keep fallbacks
outside that element so interface text such as “Не заполнено” translates.
Do not translate an entire card containing both labels and customer records.

Input values, textareas and editable areas are never rewritten. Explicit
`option.value` enums are preserved; options without an explicit value receive
their original Russian value before their displayed label changes. No translated
label is substituted for an API enum or a stored user-entered value.

`localizeInterface()` is for browser events such as native confirmation dialogs
and canvas exports. Don't use its document-based locale during server rendering.
Email delivery and AI-generated/customer-authored content keep their existing
language; this UI change doesn't infer a recipient language or rewrite data.

## Validation limits

Automated DOM tests exercise actual registration and CRM components, including
status changes, payout payloads, new modal content and preserved user records.
They use isolated fixtures, never production submissions or payments. Browser
layout checks and native-editor review are separate from source coverage.
