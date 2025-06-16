# EE-DE Builder Makefile
# Automates development environment setup and common tasks

.PHONY: help setup dev backend frontend install-backend install-frontend clean test build stop health check-deps move-requirements

# Default target
.DEFAULT_GOAL := help

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Configuration
PYTHON := python3
VENV_DIR := venv
BACKEND_DIR := backend
FRONTEND_DIR := frontend
BACKEND_PORT := 8000
FRONTEND_PORT := 3000

## Display help information
help:
	@echo "$(GREEN)EE-DE Builder Development Commands$(NC)"
	@echo ""
	@echo "$(YELLOW)Setup Commands:$(NC)"
	@echo "  setup              Complete project setup (recommended for first time)"
	@echo "  install-backend    Install Python backend dependencies"
	@echo "  install-frontend   Install Node.js frontend dependencies"
	@echo "  move-requirements  Move backend requirements.txt to root and cleanup"
	@echo ""
	@echo "$(YELLOW)Development Commands:$(NC)"
	@echo "  dev                Start both backend and frontend servers"
	@echo "  backend            Start only backend server"
	@echo "  frontend           Start only frontend server"
	@echo "  stop               Stop all development servers"
	@echo ""
	@echo "$(YELLOW)Utility Commands:$(NC)"
	@echo "  health             Check service health"
	@echo "  test               Run tests"
	@echo "  build              Build frontend for production"
	@echo "  clean              Clean build artifacts and stop servers"
	@echo "  check-deps         Check if required dependencies are installed"
	@echo ""
	@echo "$(YELLOW)Quick Start:$(NC)"
	@echo "  make setup && make dev"

## Complete project setup
setup: check-deps move-requirements install-backend install-frontend
	@echo "$(GREEN)✅ Setup complete! Run 'make dev' to start development servers$(NC)"

## Check if required dependencies are installed
check-deps:
	@echo "$(YELLOW)Checking dependencies...$(NC)"
	@command -v $(PYTHON) >/dev/null 2>&1 || { echo "$(RED)❌ Python 3 is required but not installed$(NC)"; exit 1; }
	@command -v node >/dev/null 2>&1 || { echo "$(RED)❌ Node.js is required but not installed$(NC)"; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "$(RED)❌ npm is required but not installed$(NC)"; exit 1; }
	@if command -v podman >/dev/null 2>&1; then \
		echo "$(GREEN)✅ Container runtime: Podman found$(NC)"; \
	elif command -v docker >/dev/null 2>&1; then \
		echo "$(GREEN)✅ Container runtime: Docker found$(NC)"; \
	else \
		echo "$(YELLOW)⚠️  No container runtime found. Install Podman or Docker for container building$(NC)"; \
	fi
	@echo "$(GREEN)✅ All required dependencies found$(NC)"

## Move backend requirements.txt to root and remove artifact version
move-requirements:
	@echo "$(YELLOW)Moving requirements.txt to root directory...$(NC)"
	@if [ -f "$(BACKEND_DIR)/requirements.txt" ]; then \
		cp "$(BACKEND_DIR)/requirements.txt" ./requirements.txt; \
		echo "$(GREEN)✅ Moved backend/requirements.txt to root$(NC)"; \
	else \
		echo "$(RED)❌ Backend requirements.txt not found$(NC)"; \
		exit 1; \
	fi
	@if [ -f "artifact/requirements.txt" ]; then \
		echo "$(YELLOW)⚠️  Removing redundant artifact/requirements.txt$(NC)"; \
		rm -f artifact/requirements.txt; \
		echo "$(GREEN)✅ Removed artifact/requirements.txt$(NC)"; \
	fi

## Install Python backend dependencies
install-backend:
	@echo "$(YELLOW)Setting up Python virtual environment...$(NC)"
	@if [ ! -d "$(VENV_DIR)" ]; then \
		$(PYTHON) -m venv $(VENV_DIR); \
		echo "$(GREEN)✅ Created virtual environment$(NC)"; \
	fi
	@echo "$(YELLOW)Installing Python dependencies...$(NC)"
	@. $(VENV_DIR)/bin/activate && pip install --upgrade pip
	@. $(VENV_DIR)/bin/activate && pip install -r requirements.txt
	@echo "$(GREEN)✅ Python dependencies installed$(NC)"

## Install Node.js frontend dependencies  
install-frontend:
	@echo "$(YELLOW)Installing Node.js dependencies...$(NC)"
	@cd $(FRONTEND_DIR) && npm install
	@echo "$(GREEN)✅ Node.js dependencies installed$(NC)"

## Start both backend and frontend development servers
dev: stop
	@echo "$(GREEN)🚀 Starting EE-DE Builder development environment...$(NC)"
	@echo "$(YELLOW)Backend will be available at: http://localhost:$(BACKEND_PORT)$(NC)"
	@echo "$(YELLOW)Frontend will be available at: http://localhost:$(FRONTEND_PORT)$(NC)"
	@echo "$(YELLOW)API Documentation will be available at: http://localhost:$(BACKEND_PORT)/docs$(NC)"
	@echo ""
	@echo "$(YELLOW)Starting backend server...$(NC)"
	@. $(VENV_DIR)/bin/activate && cd $(BACKEND_DIR) && python -m app.main &
	@sleep 3
	@echo "$(YELLOW)Starting frontend server...$(NC)"
	@cd $(FRONTEND_DIR) && npm start &
	@echo ""
	@echo "$(GREEN)✅ Both servers are starting up!$(NC)"
	@echo "$(YELLOW)Press Ctrl+C to stop all servers$(NC)"
	@echo "$(YELLOW)Or run 'make stop' in another terminal$(NC)"
	@sleep 2
	@if command -v open >/dev/null 2>&1; then \
		echo "$(GREEN)🌐 Opening browser...$(NC)"; \
		sleep 5 && open http://localhost:$(FRONTEND_PORT) & \
	elif command -v xdg-open >/dev/null 2>&1; then \
		echo "$(GREEN)🌐 Opening browser...$(NC)"; \
		sleep 5 && xdg-open http://localhost:$(FRONTEND_PORT) & \
	fi
	@wait

## Start only backend server
backend:
	@echo "$(GREEN)🚀 Starting backend server...$(NC)"
	@echo "$(YELLOW)Backend will be available at: http://localhost:$(BACKEND_PORT)$(NC)"
	@echo "$(YELLOW)API Documentation: http://localhost:$(BACKEND_PORT)/docs$(NC)"
	@. $(VENV_DIR)/bin/activate && cd $(BACKEND_DIR) && python -m app.main

## Start only frontend server
frontend:
	@echo "$(GREEN)🚀 Starting frontend server...$(NC)"
	@echo "$(YELLOW)Frontend will be available at: http://localhost:$(FRONTEND_PORT)$(NC)"
	@cd $(FRONTEND_DIR) && npm start

## Stop all development servers
stop:
	@echo "$(YELLOW)Stopping development servers...$(NC)"
	@pkill -f "python.*app.main" 2>/dev/null || true
	@pkill -f "node.*react-scripts" 2>/dev/null || true
	@pkill -f "uvicorn" 2>/dev/null || true
	@lsof -ti:$(BACKEND_PORT) | xargs kill -9 2>/dev/null || true
	@lsof -ti:$(FRONTEND_PORT) | xargs kill -9 2>/dev/null || true
	@echo "$(GREEN)✅ Development servers stopped$(NC)"

## Check service health
health:
	@echo "$(YELLOW)Checking service health...$(NC)"
	@if curl -s http://localhost:$(BACKEND_PORT)/health >/dev/null 2>&1; then \
		echo "$(GREEN)✅ Backend is healthy$(NC)"; \
	else \
		echo "$(RED)❌ Backend is not responding$(NC)"; \
	fi
	@if curl -s http://localhost:$(FRONTEND_PORT) >/dev/null 2>&1; then \
		echo "$(GREEN)✅ Frontend is healthy$(NC)"; \
	else \
		echo "$(RED)❌ Frontend is not responding$(NC)"; \
	fi

## Run tests
test:
	@echo "$(YELLOW)Running backend tests...$(NC)"
	@. $(VENV_DIR)/bin/activate && cd $(BACKEND_DIR) && python -m pytest tests/ -v || echo "$(YELLOW)⚠️  No backend tests found$(NC)"
	@echo "$(YELLOW)Running frontend tests...$(NC)"
	@cd $(FRONTEND_DIR) && npm test -- --coverage --passWithNoTests

## Build frontend for production
build:
	@echo "$(YELLOW)Building frontend for production...$(NC)"
	@cd $(FRONTEND_DIR) && npm run build
	@echo "$(GREEN)✅ Frontend built successfully$(NC)"
	@echo "$(YELLOW)Production files are in $(FRONTEND_DIR)/build/$(NC)"

## Clean build artifacts and stop servers
clean: stop
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	@rm -rf $(FRONTEND_DIR)/build 2>/dev/null || true
	@rm -rf $(FRONTEND_DIR)/node_modules/.cache 2>/dev/null || true
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@echo "$(GREEN)✅ Cleaned build artifacts$(NC)"

## Clean everything including dependencies (nuclear option)
clean-all: clean
	@echo "$(RED)⚠️  This will remove all installed dependencies!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		echo ""; \
		echo "$(YELLOW)Removing virtual environment...$(NC)"; \
		rm -rf $(VENV_DIR); \
		echo "$(YELLOW)Removing node_modules...$(NC)"; \
		rm -rf $(FRONTEND_DIR)/node_modules; \
		echo "$(GREEN)✅ All dependencies removed$(NC)"; \
	else \
		echo ""; \
		echo "$(YELLOW)Aborted$(NC)"; \
	fi

## Development server logs
logs:
	@echo "$(YELLOW)Showing recent logs...$(NC)"
	@echo "$(GREEN)=== Backend Logs ===$(NC)"
	@tail -f /tmp/ee-de-builder-backend.log 2>/dev/null || echo "No backend logs found"
	@echo "$(GREEN)=== Frontend Logs ===$(NC)"  
	@tail -f /tmp/ee-de-builder-frontend.log 2>/dev/null || echo "No frontend logs found"

## Show development environment status
status:
	@echo "$(GREEN)=== EE-DE Builder Status ===$(NC)"
	@echo ""
	@echo "$(YELLOW)Virtual Environment:$(NC)"
	@if [ -d "$(VENV_DIR)" ]; then \
		echo "$(GREEN)✅ Virtual environment exists$(NC)"; \
		if [ -f "$(VENV_DIR)/bin/activate" ]; then \
			echo "$(GREEN)✅ Activation script found$(NC)"; \
		fi \
	else \
		echo "$(RED)❌ Virtual environment not found$(NC)"; \
	fi
	@echo ""
	@echo "$(YELLOW)Dependencies:$(NC)"
	@if [ -f "requirements.txt" ]; then \
		echo "$(GREEN)✅ Root requirements.txt exists$(NC)"; \
	else \
		echo "$(RED)❌ Root requirements.txt missing$(NC)"; \
	fi
	@if [ -f "$(FRONTEND_DIR)/node_modules/package.json" ]; then \
		echo "$(GREEN)✅ Frontend dependencies installed$(NC)"; \
	else \
		echo "$(RED)❌ Frontend dependencies not installed$(NC)"; \
	fi
	@echo ""
	@echo "$(YELLOW)Services:$(NC)"
	@if pgrep -f "python.*app.main" >/dev/null 2>&1; then \
		echo "$(GREEN)✅ Backend server running$(NC)"; \
	else \
		echo "$(RED)❌ Backend server not running$(NC)"; \
	fi
	@if pgrep -f "node.*react-scripts" >/dev/null 2>&1; then \
		echo "$(GREEN)✅ Frontend server running$(NC)"; \
	else \
		echo "$(RED)❌ Frontend server not running$(NC)"; \
	fi

## Quick development setup for new contributors
quick-start: setup
	@echo ""
	@echo "$(GREEN)🎉 Welcome to EE-DE Builder development!$(NC)"
	@echo ""
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "1. Run: $(GREEN)make dev$(NC) to start development servers"
	@echo "2. Open: $(GREEN)http://localhost:3000$(NC) in your browser"
	@echo "3. API docs: $(GREEN)http://localhost:8000/docs$(NC)"
	@echo ""
	@echo "$(YELLOW)Useful commands:$(NC)"
	@echo "• $(GREEN)make help$(NC)     - Show all available commands"
	@echo "• $(GREEN)make status$(NC)   - Check development environment status"
	@echo "• $(GREEN)make health$(NC)   - Check if services are running"
	@echo "• $(GREEN)make stop$(NC)     - Stop all development servers"
	@echo "• $(GREEN)make clean$(NC)    - Clean build artifacts"
	@echo ""
	@echo "$(GREEN)Happy coding! 🚀$(NC)"
