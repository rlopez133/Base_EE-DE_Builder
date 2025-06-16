# EE-DE Builder - Simple Development Makefile

.PHONY: help setup dev backend frontend stop clean

# Configuration
PYTHON := python3
VENV_DIR := venv
BACKEND_DIR := backend
FRONTEND_DIR := frontend

## Show available commands
help:
	@echo "EE-DE Builder Development Commands:"
	@echo ""
	@echo "  setup      - Install all dependencies (run once)"
	@echo "  dev        - Start both backend and frontend servers"
	@echo "  backend    - Start only backend server"
	@echo "  frontend   - Start only frontend server" 
	@echo "  stop       - Stop all development servers"
	@echo "  clean      - Clean build artifacts"
	@echo ""
	@echo "Quick start: make setup && make dev"

## Install all dependencies
setup:
	@echo "Setting up development environment..."
	@if [ ! -d "$(VENV_DIR)" ]; then \
		$(PYTHON) -m venv $(VENV_DIR); \
		echo "Created Python virtual environment"; \
	fi
	@. $(VENV_DIR)/bin/activate && pip install --upgrade pip
	@. $(VENV_DIR)/bin/activate && pip install -r requirements.txt
	@echo "Installed Python dependencies"
	@cd $(FRONTEND_DIR) && npm install
	@echo "Installed Node.js dependencies"
	@echo "Setup complete! Run 'make dev' to start servers"

## Start both backend and frontend servers
dev: stop
	@echo "Starting development servers..."
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost:3000"
	@echo "API Docs: http://localhost:8000/docs"
	@echo ""
	@. $(VENV_DIR)/bin/activate && cd $(BACKEND_DIR) && python -m app.main &
	@sleep 2
	@cd $(FRONTEND_DIR) && npm start &
	@echo "Servers starting... Press Ctrl+C to stop"
	@wait

## Start only backend server
backend:
	@echo "Starting backend server at http://localhost:8000"
	@. $(VENV_DIR)/bin/activate && cd $(BACKEND_DIR) && python -m app.main

## Start only frontend server
frontend:
	@echo "Starting frontend server at http://localhost:3000"
	@cd $(FRONTEND_DIR) && npm start

## Stop all development servers
stop:
	@echo "Stopping servers..."
	@pkill -f "python.*app.main" 2>/dev/null || true
	@pkill -f "node.*react-scripts" 2>/dev/null || true
	@pkill -f "uvicorn" 2>/dev/null || true
	@echo "Servers stopped"

## Clean build artifacts
clean: stop
	@echo "Cleaning build artifacts..."
	@rm -rf $(FRONTEND_DIR)/build 2>/dev/null || true
	@rm -rf $(FRONTEND_DIR)/node_modules/.cache 2>/dev/null || true
	@find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
	@find . -name "*.pyc" -delete 2>/dev/null || true
	@echo "Cleaned up"
