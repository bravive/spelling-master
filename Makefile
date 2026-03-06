LOG_FILE := /tmp/spell-master-server.log

.PHONY: server restart dev build test logs

# Restart the Express API server (kills any running instance first)
restart:
	@pkill -f "node server.js" 2>/dev/null || true
	@sleep 0.5
	node server.js >> $(LOG_FILE) 2>&1 &
	@echo "Server restarted on port 3001 (log: $(LOG_FILE))"

# Tail server logs (Ctrl+C to stop)
logs:
	tail -f $(LOG_FILE)

# Start API server only
server:
	node server.js >> $(LOG_FILE) 2>&1

# Start both API server and Vite dev server
dev:
	npm run dev:full

# Build for production
build:
	npm run build

# Run unit tests
test:
	npm test
