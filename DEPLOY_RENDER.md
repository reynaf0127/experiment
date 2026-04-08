# Deploy On Render

This project deploys best as two Render services:

1. A Python Web Service for the FastAPI backend
2. A Static Site for the Vite frontend

## Option 1: Use `render.yaml`

Render can detect [render.yaml](/Users/reyna.feng/Documents/experiment/render.yaml) and create both services for you.

After creating the services, set these environment variables:

- On `ab-test-lab-api`:
  - `CORS_ORIGINS=https://your-frontend-name.onrender.com`

- On `ab-test-lab-web`:
  - `VITE_API_BASE_URL=https://your-backend-name.onrender.com/api`

## Option 2: Configure Manually

### Backend web service

- Runtime: Python
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`

### Frontend static site

- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

Environment variables:

- `VITE_API_BASE_URL=https://your-backend-name.onrender.com/api`

## Notes

- [requirements.txt](/Users/reyna.feng/Documents/experiment/requirements.txt) forwards to [backend/requirements.txt](/Users/reyna.feng/Documents/experiment/backend/requirements.txt), so Render can install Python dependencies from the repo root.
- The frontend uses `VITE_API_BASE_URL` in production and falls back to `/api` locally.
- Restrict `CORS_ORIGINS` to your frontend Render domain instead of `*` in production.
