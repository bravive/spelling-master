LOG_FILE := /tmp/spell-master-server.log

.PHONY: server restart dev build test logs mongo-up mongo-down mongo-shell migrate

# Restart the Express API server (kills any running instance first)
restart:
	@pkill -f "node --env-file=.env server.js" 2>/dev/null || true
	@sleep 0.5
	@if [ -f $(LOG_FILE) ] && [ $$(stat -f%z $(LOG_FILE)) -gt 104857600 ]; then \
		echo "Log file >100MB, truncating..."; \
		tail -c 1048576 $(LOG_FILE) > $(LOG_FILE).tmp && mv $(LOG_FILE).tmp $(LOG_FILE); \
	fi
	node --env-file=.env server.js >> $(LOG_FILE) 2>&1 &
	@echo "Server restarted on port 3001 (log: $(LOG_FILE))"

# Tail server logs (Ctrl+C to stop)
logs:
	tail -f $(LOG_FILE)

# Start API server only
server:
	node --env-file=.env server.js >> $(LOG_FILE) 2>&1

# Start both API server and Vite dev server
dev:
	npm run dev:full

# Build for production
build:
	npm run build

# Run unit tests
test:
	npm test

# MongoDB (Docker)
mongo-up:
	docker compose up -d

mongo-down:
	docker compose down

mongo-shell:
	docker compose exec mongo mongosh spellmaster

# Import existing JSON data into MongoDB
migrate:
	node --env-file=.env scripts/migrate-to-mongo.js
