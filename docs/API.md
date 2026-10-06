# API КӘСІПОДАҚ

Все ответы — JSON, кроме скачивания файлов. API и интерфейс работают на одном домене. CORS для чужих сайтов не разрешается. Авторизация — PHP session cookie. Получите `GET meta`, сохраните cookie и `data.csrf`. Передавайте `X-CSRF-Token: <csrf>` при POST/PUT/DELETE. После login/logout обновите токен из ответа. Пароли в ответах отсутствуют.

URL без mod_rewrite: `api.php?path=applications/ID/status`.
REST URL с rewrite или встроенным роутером: `/api/applications/ID/status`.

Список: `data: {items:[], total, page, pageSize}`. Параметры `page=1`, `pageSize=10` (максимум 100). Модули контента и члены поддерживают `q`; дополнительные фильтры ниже. Стандартные HTTP-коды: 200/201; 400 — валидация, 401 — вход, 403 — доступ/CSRF, 404 — отсутствует, 409 — конфликт/связи, 429 — лимит, 500 — ошибка сервера.

| Модуль | Метод и путь | Доступ / назначение |
|---|---|---|
| Meta | GET meta | CSRF, установка, настройки, текущий пользователь |
| Установка | POST setup | Только пока пользователей нет; email, password, firstName, lastName, demo |
| Главная | GET overview | Публичные агрегированные количества |
| Авторизация | POST auth/login | email, password |
| Авторизация | POST auth/logout | Вышедшая сессия очищается |
| Авторизация | GET auth/me | Текущий пользователь и свой профиль |
| Профиль | PUT auth/profile | firstName, lastName, middleName, phone, avatar |
| Пароль | PUT auth/password | currentPassword, password |
| Файлы | POST uploads | Вход; multipart field `file`, до 10 МБ |
| Файлы | GET files/{id} | Публичный документ/обложка или проверка владельца/администрации; `download=1` |
| Члены | GET members | ADMIN/CHAIRMAN; q, department, position, status |
| Члены | GET members/options | ADMIN/CHAIRMAN; доступные departments, positions |
| Члены | GET members/{id} | ADMIN/CHAIRMAN |
| Члены | POST members | ADMIN; профиль + email/password/role |
| Члены | PUT members/{id} | ADMIN; профиль + status |
| Члены | DELETE members/{id} | ADMIN; аккаунт и профиль; связи блокируют удаление |
| Заявки | GET applications | Вход; MEMBER только свои; status, type |
| Заявки | GET applications/{id} | Вход; член только владелец; комментарии, вложения, история |
| Заявки | POST applications | Белсенді мүше; type, title, description, amount, fileIds[] |
| Заявки | PUT applications/{id} | title, description; MEMBER только своя NEW |
| Заявки | DELETE applications/{id} | ADMIN/CHAIRMAN или владелец NEW |
| Заявки | POST applications/{id}/comments | Участник/администрация; text |
| Заявки | POST applications/{id}/attachments | Участник/администрация; fileId собственного файла |
| Заявки | POST applications/{id}/status | ADMIN/CHAIRMAN; status; сохраняется история и уведомление |
| Новости | GET news | Публично только PUBLISHED; администрация видит DRAFT; q, status |
| Новости | GET news/{slug} | Публичная публикация или администрация |
| Новости | POST news | ADMIN/CHAIRMAN |
| Новости | PUT news/{id} | ADMIN/CHAIRMAN |
| Новости | DELETE news/{id} | ADMIN/CHAIRMAN |
| Документы | GET documents | Публично; q, category |
| Документы | GET documents/{id} | Публично |
| Документы | POST documents | ADMIN; сначала загрузить файл, затем fileId |
| Документы | PUT documents/{id} | ADMIN |
| Документы | DELETE documents/{id} | ADMIN |
| Мероприятия | GET events | Публично; q, status |
| Мероприятия | GET events/{id} | Публично; число участников, статус собственной записи |
| Мероприятия | POST events | ADMIN/CHAIRMAN |
| Мероприятия | PUT events/{id} | ADMIN/CHAIRMAN |
| Мероприятия | DELETE events/{id} | ADMIN/CHAIRMAN |
| Участие | POST events/{id}/join | Вход; предстоящее мероприятие, повтор не дублирует запись |
| Участие | DELETE events/{id}/join | Вход; отменить свою запись |
| Статистика | GET statistics | ADMIN/CHAIRMAN; days=7/30/90/180/365 |
| Уведомления | GET notifications | Вход; свои items и unread |
| Уведомления | PUT notifications/{id}/read | Вход; только своё уведомление |
| Уведомления | PUT notifications/all/read | Вход; все свои прочитаны |
| Пользователи | GET users | ADMIN; пагинация |
| Пользователи | GET users/{id} | ADMIN |
| Пользователи | PUT users/{id} | ADMIN; email, role, isActive, необязательный password |
| Пользователи | DELETE users/{id} | ADMIN; защита последнего/собственного администратора |
| Настройки | GET settings | Публичные контакты и текст |
| Настройки | PUT settings | ADMIN; schoolName, address, phone, email, importantInfo |

## Поля

Член: `firstName,lastName,middleName,phone,position,department,joinDate,status`; joinDate YYYY-MM-DD, ACTIVE/INACTIVE. Создание также требует email и password, role ADMIN/CHAIRMAN/MEMBER (по умолчанию MEMBER).

Заявка: type MATERIAL/ONE_TIME/SOCIAL/OTHER; title 3–200, description 10–20000, amount от 0 до 100000000 тенге; fileIds максимум 10. amount хранится как целое количество тиынов. Состояния NEW/IN_REVIEW/NEEDS_INFO/APPROVED/REJECTED/COMPLETED. В ответе есть number — последовательный номер, id — случайный идентификатор.

Новость: `title,slug,shortDescription,content,image,status,notify`; slug — латинские буквы нижнего регистра/цифры/дефисы; DRAFT/PUBLISHED. `notify=true` отправляет уведомления активным аккаунтам при сохранении PUBLISHED.

Документ: `title,description,category,fileId`; категории RULES/RESOLUTIONS/MINUTES/ORDERS/REPORTS/REGULATIONS/OTHER. Ответ содержит fileUrl/fileName/fileType/fileSize.

Мероприятие: `title,description,date,startTime,endTime,location,image,organizer,status`; date YYYY-MM-DD, HH:mm; время окончания позже начала; UPCOMING/PAST/CANCELLED.

Изображения — `fileUrl` ранее загруженного изображения или путь к входящему в seed изображению. Произвольные внешние URL и пути запрещены. Поля текста — plain text; разметка не исполняется.

## Пример заявки

```json
{
  "type": "MATERIAL",
  "title": "Емделуге көмек",
  "description": "Материалдық көмек көрсетуіңізді сұраймын.",
  "amount": 50000,
  "fileIds": []
}
```

```json
{
  "success": false,
  "message": "Өрістерді тексеріңіз",
  "errors": [{"field":"title","message":"3–200 таңба енгізіңіз"}]
}
```
