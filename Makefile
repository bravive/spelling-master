.PHONY: server restart dev build test

# Restart the Express API server (kills any running instance first)
restart:
	@pkill -f "node server.js" 2>/dev/null || true
	@sleep 0.5
	node server.js &
	@echo "Server restarted on port 3001"

# Start API server only
server:
	node server.js

# Start both API server and Vite dev server
dev:
	npm run dev:full

# Build for production
build:
	npm run build

# Run unit tests
test:
	npm test
