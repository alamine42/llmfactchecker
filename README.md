# GroundCheck

Fact-check AI responses with real-time source verification.

## Project Structure

```
groundcheck/
├── packages/
│   ├── extension/     # Chrome Extension (Manifest V3)
│   ├── backend/       # Vercel Serverless Functions
│   └── factcheck/     # Python FastAPI Microservice
├── docker-compose.yml # Local development
└── turbo.json         # Monorepo task runner
```

## Prerequisites

- Node.js >= 20.0.0
- pnpm 9.x
- Python 3.11+
- Docker (optional, for local Python service)

## Getting Started

### Install Dependencies

```bash
pnpm install
```

### Development

Start all services:

```bash
pnpm dev
```

Or start individual packages:

```bash
# Extension (with hot reload)
cd packages/extension && pnpm dev

# Backend
cd packages/backend && pnpm dev

# Python service
cd packages/factcheck
uv pip install -e ".[dev]"
uvicorn factcheck.main:app --reload
```

### Loading the Extension

1. Run `pnpm dev` in `packages/extension`
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" and select `packages/extension/dist`

### Docker (Python Service)

```bash
docker-compose up
```

## Scripts

- `pnpm dev` - Start all services in development mode
- `pnpm build` - Build all packages
- `pnpm lint` - Run ESLint on all packages
- `pnpm test` - Run tests for all packages
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm format` - Format code with Prettier

## Health Checks

- Backend: `http://localhost:3000/api/health`
- Python service: `http://localhost:8000/health`
