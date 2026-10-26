# Сайт для бьюти-мастера с онлайн-записью · демо

**Открыть сайт:** https://aleksarulezzz.ru/lashmaker/

Раньше этот проект лежал в папке `lashmaker/` репозитория главного сайта
([aleksarulezzz-lab.github.io](https://github.com/aleksarulezzz-lab/aleksarulezzz-lab.github.io)).
Теперь это отдельный репозиторий: GitHub Pages публикует его по адресу `aleksarulezzz.ru/lashmaker/`,
потому что домен привязан к главному сайту, а имя репозитория совпадает с путём.

## Что где

| Путь | Что это |
|---|---|
| `index.html`, `assets/` | Сам сайт мастера |
| `variant-*.html`, `proto-*.html`, `design-history.html` и др. | Варианты дизайна и прототипы |
| `worker/` | Cloudflare Worker: API онлайн-записи, Telegram-бот, напоминания, статистика. Подробности в [worker/README.md](worker/README.md) |
| `docs/` | План системы записи через Telegram |

Иконки (`/favicon*.png`, `/favicon.svg`) берутся с главного сайта.
Страница-кейс `cases/lashmaker.html` осталась в репозитории главного сайта.

## Публикация

* Сайт: любой пуш в `main`, и через пару минут GitHub Pages обновит его.
* Worker: `git push` его **не** публикует, а нужно выполнить `cd worker && npm run deploy` (см. `worker/README.md`).
