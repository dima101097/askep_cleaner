# Askep Cleaner

<img src="icon.png" width="64" alt="Askep Cleaner icon">

Розширення для Google Chrome, яке автоматично сканує та очищає браузерні дані для сайту [askep.net](https://askep.net) (МІС Аскеп).

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/ndjbgeinngmkgfcbcohaagjblacgpoek?label=Chrome%20Web%20Store&logo=google-chrome&logoColor=white&color=4285F4)](https://chromewebstore.google.com/detail/askep-cleaner/ndjbgeinngmkgfcbcohaagjblacgpoek)

---

## Можливості

- 🔍 **Автосканування** — при відкритті розширення одразу перевіряє наявність даних
- 🗂️ **Cache** — кешовані ресурси сайту
- 🍪 **Cookies** — сесійні та постійні
- 💾 **localStorage** — постійне сховище
- ⏱️ **sessionStorage** — токени сесії
- 🗃️ **IndexedDB** — офлайн-дані та кешовані форми
- ⚙️ **Service Workers** — фонові скрипти застарілих версій
- 🌐 **Швидкий перехід** — якщо ви не на сайті, кнопка відкриє askep.net у новій вкладці
- ♻️ **Автоперезавантаження** та закриття popup після очищення

---

## Встановлення

### Через Chrome Web Store *(рекомендовано)*
[![Chrome Web Store](https://img.shields.io/badge/Встановити-Chrome%20Web%20Store-4285F4?logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/askep-cleaner/ndjbgeinngmkgfcbcohaagjblacgpoek)

### Вручну (для розробників)
1. Завантажте або склонуйте репозиторій
2. Відкрийте Chrome і перейдіть на `chrome://extensions/`
3. Увімкніть **Режим розробника** (Developer mode) у правому верхньому куті
4. Натисніть **Завантажити нерозпаковане** (Load unpacked)
5. Оберіть папку з розширенням

---

## Використання

1. Перейдіть на будь-яку сторінку `askep.net`
2. Натисніть іконку розширення — сканування запуститься автоматично
3. Перегляньте результати по кожному типу даних
4. Натисніть **🧹 Очистити знайдене** — сторінка перезавантажиться і popup закриється

---

## Налаштування

Відкрити: **правий клік на іконці розширення → Параметри**

| Налаштування | За замовчуванням | Опис |
|---|---|---|
| Скривати «Чисто» | ✅ Увімкнено | Не показувати типи даних зі статусом «Чисто» після сканування |
| Попередження перед очищенням | ✅ Увімкнено | Показувати діалог підтвердження перед очищенням |
| Затримка після очищення | ✅ Увімкнено | Показувати повідомлення «Очищено» перед закриттям. Якщо вимкнено — закривається одразу |

---

## Дозволи

| Дозвіл | Причина |
|---|---|
| `browsingData` | Очищення кешу, cookies, localStorage, IndexedDB |
| `activeTab` | Отримання URL поточної вкладки |
| `scripting` | Сканування sessionStorage, IndexedDB та Service Workers на сторінці |
| `storage` | Збереження налаштувань користувача |
| `host_permissions: *.askep.net` | Дія обмежена виключно доменом askep.net |

---

## Версії

| Версія | Зміни |
|---|---|
| v2.0 | Автосканування, підтримка sessionStorage / IndexedDB / Service Workers, налаштування, кнопка відкриття сайту, підтвердження очищення, затримка після очищення |
| v1.2 | Базове очищення cache, cookies, localStorage |
