# Deploy On Render

This project can deploy as a single Render Web Service.
The FastAPI backend serves the built Vite frontend from the same URL.

## Option 1: Use `render.yaml`

Render can detect [render.yaml](/Users/reyna.feng/Documents/experiment/render.yaml) and create the web service for you.
This setup uses [Dockerfile](/Users/reyna.feng/Documents/experiment/Dockerfile), which:

- installs frontend dependencies
- runs `npm run build`
- installs Python dependencies
- serves the React app and API from one service

## Option 2: Configure Manually

Create a Web Service and let Render use the repo's `Dockerfile`.
No separate Static Site is required.

## Notes

- [requirements.txt](/Users/reyna.feng/Documents/experiment/requirements.txt) forwards to [backend/requirements.txt](/Users/reyna.feng/Documents/experiment/backend/requirements.txt), so Render can install Python dependencies from the repo root.
- The frontend uses relative `/api` calls by default, which works well for this single-service deployment.
- [backend/app.py](/Users/reyna.feng/Documents/experiment/backend/app.py) now serves [dist](/Users/reyna.feng/Documents/experiment/dist) so the web app is available at the same URL as the API.
