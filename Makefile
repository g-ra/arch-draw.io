.PHONY: help dev prod build up down logs restart clean backup

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Start development environment (PostgreSQL only)
	docker compose -f docker-compose.dev.yml up -d
	@echo "✅ PostgreSQL running on localhost:5432"

prod: ## Deploy production environment
	./deploy.sh

build: ## Build all Docker images
	docker compose build

up: ## Start all services
	docker compose up -d

down: ## Stop all services
	docker compose down

logs: ## Show logs (use: make logs SERVICE=api)
	@if [ -z "$(SERVICE)" ]; then \
		docker compose logs -f; \
	else \
		docker compose logs -f $(SERVICE); \
	fi

restart: ## Restart services (use: make restart SERVICE=api)
	@if [ -z "$(SERVICE)" ]; then \
		docker compose restart; \
	else \
		docker compose restart $(SERVICE); \
	fi

clean: ## Remove all containers, volumes, and images
	docker compose down -v --rmi all

backup: ## Backup PostgreSQL database
	@mkdir -p backups
	@docker compose exec -T postgres pg_dump -U techflow techflow | gzip > backups/techflow_$$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "✅ Backup created in backups/"

restore: ## Restore from backup (use: make restore FILE=backups/file.sql.gz)
	@if [ -z "$(FILE)" ]; then \
		echo "❌ Please specify FILE=backups/file.sql.gz"; \
		exit 1; \
	fi
	@gunzip -c $(FILE) | docker compose exec -T postgres psql -U techflow -d techflow
	@echo "✅ Database restored from $(FILE)"
