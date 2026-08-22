# AGENTS — інженер репозиторію ЦПРПП м. Лубни (crpp1-l0)

Замовник у чаті — **Ярослав**. Мова — українська, коротко, без «води».
Формат відповіді: **Що зроблено** → **Що зламано / виявлені проблеми** → **Що далі**.
Контентні факти звіряти з репо (`git log`, код), не здогадуватись і не покладатись на пам'ять про минулі сесії.
Не нав'язувати задач: є варіанти — перелічити коротко й дати обрати.

## Координати

- Репозиторій: https://github.com/yaroslav28077/crpp1-l0 (owner `yaroslav28077`, гілка `main`)
- Production: https://effervescent-mandazi-b49b28.netlify.app/
- Стек: Next.js 16 App Router + TS 5 + Tailwind 4, React 19, Decap CMS 3.15.1, Netlify
- Пакет: `lubny-cprpp`, packageManager `pnpm@11.17.0`, Node 22
- Старий сайт (джерело міграції): https://lubny-cprpp.ho.ua

## Жорсткі правила репозиторію

1. **Мердж у `main` — лише після явної команди Ярослава «мердж».** Контентні дрібниці, коли він каже «додай відразу», — прямий коміт у `main`.
2. **Decap стирає неоголошені поля.** Не видаляти застарілі поля з `public/admin/config.yml` (напр. `rows`), поки дані не міграровані на 100 %.
3. **Ніякого `yaml.safe_dump`** для MD-файлів — тільки точкова текстова заміна (str_replace або регексна вставка).
4. У колекціях із `create: true` завжди `slug: '{{fields.slug}}'` (кириличні slug).
5. Пароль від адмінки не просити і не використовувати.
6. Медіа: `/images/*` віддається з `Cache-Control: immutable`. Нове фото = **нове ім'я файлу**.
7. Твердження про перф/пошук — тільки після `pnpm build` з цифрами.
8. Нову роботу робити свіжою гілкою від актуального `main`; не ребейзити старі гілки з дубльованою історією.

## Граблі

1. Блок `text` у Decap має ключ `text:`, а не `content:` — інакше блок порожній.
2. `gallery` ріже фото в квадрат (`aspect-square`) — для банерів не годиться. Широку картинку вставляти markdown-ом у текстовому блоці: `![alt](/images/uploads/file.jpg)`. Санітайзер `lib/markdown.ts` тег `img` пропускає.
3. Після `git reset --hard` можливий `Permission denied` на файлах, створених Python у `public/images/...` — прибрати каталог вручну перед ресетом.
4. Цей запуск — Windows + локальний клон: писати в репо звичайним git (`git push`). Якщо креденшелів нема — встановити/увійти через GitHub CLI, а не вигадувати обхідні шляхи.

## Конвенції контенту

**Новина** (`content/news/YYYY-MM-DD-slug.md`, 332 файли):

```yaml
title: '...'
date: '2026-08-18T10:03:00.000Z'
description: >-            # перші 1–2 речення + …
tags:
  - Серпень2026           # Місяць+Рік
  - '2026'
topics:
  - shkilna-biblioteka    # тема = slug сторінки, підтягує блок news_by_topic
gallery:
  - image: /images/notes/2026/08/bibl/01.jpg
author: ...
```

Фото: JPEG, ширина ≤1600, q84–86, ~100–250 КБ, шлях `public/images/notes/РІК/МІСЯЦЬ/тег/01.jpg`.

**Блоки сторінок** (`components/page-blocks.tsx`): `text`, `notice`, `accordion`, `news_list`, `news_by_topic`, `documents`, `table`, `plans`, `certificates`, `gallery`, `partners`, `cards`, `video`, `steps`, `cta`, `embed`.

Форма запису на консультацію: `https://forms.gle/FmyWyvGzqoBEPBwq6` (`content/settings/site.yml` → `consultation_url`).

**Команда** (`content/team/`): Оксана Педоряка — Директор (1) → Світлана Лісна — Консультант (2) → Альона Таранець — Консультант (3) → Людмила Іващенко — Психолог (4). Підписи й посади без запиту не чіпати. У планах 2021–2022 «Надія СІЧКАР» — історично коректно.

## Карта файлів

```
app/globals.css              — токени палітри (:root) + @theme inline
app/layout.tsx               — метадані, theme-color
components/site-header.tsx   — шапка, десктоп-меню (bg-surface-nav), мобільне меню
components/site-footer.tsx   — футер
components/page-blocks.tsx   — рендер усіх блоків
components/photo-gallery.tsx — галерея
lib/content.ts               — getTeam, getSiteSettings, парсинг блоків
lib/markdown.ts              — markdown → HTML + sanitize
content/pages/*.md           — сторінки
content/news/*.md            — новини
content/settings/site.yml    — team_photo, логотип, контакти, consultation_url
content/settings/navigation.yml — меню (7 розділів)
public/admin/config.yml      — Decap: team, settings, pages, news, plany, certificates
netlify.toml                 — деплой, кеш, заголовки безпеки
```

## Палітра (`app/globals.css`, `:root`)

```css
--surface: #0b2333;            /* шапка, футер, головний банер */
--surface-nav: #0f5a6e;        /* смуга головного меню */
--surface-muted: #0f4d63;      /* випадаючі підменю й наведення */
--surface-border: #17607a;
/* жовтий акцент недоторканий: --accent: oklch(0.85 0.15 90) */
```

## Аудит адмінки — скіл decap-cms-admin-ux

Встановлений у `C:\Users\Brain\.agents\skills\decap-cms-admin-ux\`:

```powershell
python C:\Users\Brain\.agents\skills\decap-cms-admin-ux\scripts\audit_admin.py . --json
python C:\Users\Brain\.agents\skills\decap-cms-admin-ux\scripts\check_decap_config.py public/admin/config.yml content
python C:\Users\Brain\.agents\skills\decap-cms-admin-ux\scripts\audit_tables.py content
```
