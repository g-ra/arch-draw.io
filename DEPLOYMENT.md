# Deployment Guide

## Prerequisites

- Docker и Docker Compose установлены на сервере
- Домен настроен (опционально, для SSL)
- GitHub OAuth App создан (для авторизации)

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

## Production Setup

### SSL с Traefik (рекомендуется)

Создай `docker-compose.prod.yml`:

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
      - techflow_network

  web:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.web.rule=Host(`your-domain.com`)"
      - "traefik.http.routers.web.entrypoints=websecure"
      - "traefik.http.routers.web.tls.certresolver=letsencrypt"

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
