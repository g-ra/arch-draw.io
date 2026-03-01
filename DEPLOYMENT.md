# Deployment Guide

## Prerequisites

- Docker и Docker Compose установлены на сервере
- Домен настроен (опционально, для SSL)
- GitHub OAuth App создан (для авторизации)
- Traefik настроен (для production с SSL)

## Quick Start

### 1. Подготовка окружения

Скопируй `.env.production.example` в `.env`:
```bash
cp .env.production.example .env
```

Отредактируй `.env` - установи реальные значения:

```bash
# Database
POSTGRES_PASSWORD=your_strong_password_here

# API
JWT_SECRET=$(openssl rand -base64 32)  # Сгенерируй случайную строку
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Frontend
FRONTEND_URL=https://your-domain.com  # Или http://your-server-ip
VITE_API_URL=https://your-domain.com  # API будет доступен через nginx proxy
WEB_PORT=80  # Или 443 если используешь SSL
```

### 2. Запуск

```bash
# Собрать и запустить все сервисы
docker compose up -d --build

# Проверить статус
docker compose ps

# Посмотреть логи
docker compose logs -f
```

### 3. Проверка

Открой в браузере:
- Frontend: `http://your-server-ip` или `https://your-domain.com`
- API health: `http://your-server-ip:3001/health`

## Traefik Integration

Это приложение разработано для работы с существующим Traefik setup.

### Требования

- Traefik запущен с включенным Docker provider
- Внешняя сеть `proxy` создана
- Certificate resolver `letsencrypt` настроен
- Порты 80 и 443 обрабатываются Traefik

### Архитектура

- Traefik маршрутизирует `/api/*`, `/ws`, `/uploads/*` напрямую к API service
- Traefik маршрутизирует всё остальное к web service (статические файлы)
- Контейнеры не экспонируют порты (Traefik обрабатывает весь внешний доступ)

### Deployment

```bash
# 1. Убедись что сеть Traefik существует
docker network create proxy

# 2. Настрой окружение
cp .env.production.example .env
nano .env

# 3. Deploy
docker compose up -d --build

# 4. Проверь Traefik dashboard для верификации маршрутов
```

### Troubleshooting

- Проверь логи Traefik: `docker logs traefik`
- Верифицируй маршруты в Traefik dashboard
- Убедись что контейнеры в сети `proxy`: `docker network inspect proxy`

### Проверка после деплоя

```bash
# Проверь статус контейнеров
docker compose ps

# Проверь HTTPS доступ
curl -I https://draw.g3ra.ru
curl -I https://draw.g3ra.ru/api/health

# Проверь сетевое подключение
docker network inspect proxy | grep techflow
```

## Production Setup

### SSL с отдельным Traefik (альтернатива)

Если у тебя нет существующего Traefik, создай `docker-compose.prod.yml`:

```yaml
services:
  traefik:
    image: traefik:v2.10
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.email=your@email.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - traefik_letsencrypt:/letsencrypt
    networks:
      - proxy

volumes:
  traefik_letsencrypt:
```

Запуск:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Бэкапы PostgreSQL

Создай cron job для автоматических бэкапов:

```bash
# Добавь в crontab (crontab -e)
0 2 * * * docker compose exec -T postgres pg_dump -U techflow techflow | gzip > /backups/techflow_$(date +\%Y\%m\%d).sql.gz
```

Или используй скрипт:

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker compose exec -T postgres pg_dump -U techflow techflow | gzip > "$BACKUP_DIR/techflow_$DATE.sql.gz"
# Удалить бэкапы старше 30 дней
find $BACKUP_DIR -name "techflow_*.sql.gz" -mtime +30 -delete
```

### Восстановление из бэкапа

```bash
gunzip -c backup.sql.gz | docker compose exec -T postgres psql -U techflow -d techflow
```

## Useful Commands

```bash
# Посмотреть логи
docker compose logs -f

# Перезапустить сервисы
docker compose restart

# Остановить всё
docker compose down

# Пересобрать и запустить
docker compose up -d --build

# Выполнить миграции вручную
docker compose exec api npx prisma migrate deploy

# Зайти в БД
docker compose exec postgres psql -U techflow -d techflow
```
