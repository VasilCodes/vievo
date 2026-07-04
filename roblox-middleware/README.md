# Vievo Roblox ↔ Firebase Middleware

Bridge server, който позволява на Roblox игри да комуникират с Firebase.

## Инсталация

1. Инсталирай зависимостите:
```
npm install
```

2. Копирай `.env.example` като `.env`:
```
cp .env.example .env
```

3. **Свали service account JSON** от Firebase Console:
   - Project Settings → Service accounts → Generate new private key
   - Запази го като `serviceAccount.json` в тази папка

4. Стартирай:
```
npm start
```

## Как работи

Roblox ползва `HttpService` за HTTP заявки към този сървър.
Сървърът ползва Firebase Admin SDK (сигурен) или Firebase REST API (fallback).

## Endpoints

| Метод | Път | Описание |
|-------|-----|----------|
| POST | `/api/auth/register` | Създаване на акаунт |
| POST | `/api/auth/login` | Вход с имейл + парола |
| GET | `/api/user/:uid` | Връща потребителски данни |
| POST | `/api/user/:uid/set` | Обновява полета |
| POST | `/api/user/:uid/add-credits` | Добавя/маха кредити |
| GET | `/api/shop/:gameId` | Списък с артикули |
| POST | `/api/shop/:gameId/buy` | Купува артикул |
| POST | `/api/leaderboard/:gameId/submit` | Записва резултат |
| GET | `/api/leaderboard/:gameId` | Топ класация |
| GET | `/api/health` | Проверка на сървъра |

## Хостване

За production пусни на VPS (DigitalOcean, Hetzner) или Render/Railway.
