# Yaler

Yaler — платформа для запуска агентских программ: компания создаёт задания и награды, приглашает агентов по одной ссылке и ведёт каждую рекомендацию от передачи до проверки и выплаты.

## Рабочие поверхности

| Поверхность | Адрес | Назначение |
| --- | --- | --- |
| Лендинг | [risestaff.kz](https://risestaff.kz/) | Знакомство с продуктом и регистрация компании |
| Кабинет компании | [company.risestaff.kz](https://company.risestaff.kz/) | Программы, агенты, результаты и выплаты |
| Кабинет агента | [agents.risestaff.kz](https://agents.risestaff.kz/) | Задания, рекомендации, статусы и вознаграждения |

Маршрутизация между доменами находится в `lib/domain-routing.ts` и применяется в `worker/index.ts`.

## Стек

- React 19 и vinext
- Cloudflare Workers
- Cloudflare D1 + Drizzle ORM
- Cloudflare R2 для файлов
- Gemini для AI-помощника (опционально)
- Sites для production-хостинга

## Локальный запуск

Требуется Node.js `>=22.13.0` и pnpm 11.

```bash
git clone https://github.com/risestaff11-eng/YalerMVP.git
cd YalerMVP
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Приложение будет доступно на `http://localhost:3000`. Локальные D1 и R2 создаются через Cloudflare Vite plugin; состояние хранится в игнорируемой папке `.wrangler/`.

## Проверка изменений

```bash
pnpm lint
pnpm test
```

`pnpm test` выполняет production build и запускает проверки рендеринга и маршрутизации. Эти же команды выполняются в GitHub Actions для каждого pull request.

После изменения `db/schema.ts` создайте миграцию и добавьте её в коммит:

```bash
pnpm db:generate
```

## Структура

- `app/` — страницы, API и интерфейсы компании/агента
- `db/` — схема D1 и доступ к данным
- `drizzle/` — версионируемые SQL-миграции
- `lib/` — авторизация, доменная маршрутизация, AI и хранилище
- `public/` — публичные изображения и иконки
- `tests/` — проверки сборки, HTML и доменов
- `worker/` — Cloudflare Worker entrypoint
- `.openai/hosting.json` — привязки существующего Sites-проекта

## Развёртывание

Полная инструкция, необходимые права, bindings, переменные окружения и checklist публикации находятся в [DEPLOYMENT.md](./DEPLOYMENT.md).

Важно: доступ к GitHub позволяет просматривать код и запускать его локально. Для публикации в существующий production-проект участнику также нужна роль Editor/Owner в Sites. Секреты не хранятся в GitHub.
