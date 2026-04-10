# PlaceIQ – AI-Powered Placement Intelligence Dashboard

## Stack
- Frontend: Vanilla HTML/CSS/JS (Chart.js)
- Backend: FastAPI, Motor (MongoDB), scikit-learn, Anthropic client
- Auth: JWT + bcrypt
- Deployment: Docker + docker-compose

## Quickstart
1) Install Docker & Docker Compose.
2) Set environment variable `OPENAI_API_KEY` (used for Claude calls).
3) Run `docker-compose up --build` from the repo root.
4) Frontend at http://localhost:3000, Backend at http://localhost:8000.

## Environment
- `MONGO_URI` (default: mongodb://mongo:27017)
- `JWT_SECRET` (default: placeiq-jwt-secret-2024)
- `OPENAI_API_KEY` (Claude access key; fallback logic returns canned advice if missing)

## Demo Credentials
- Admin: `admin@placeiq.edu` / `admin123`
- Student: `student1@placeiq.edu` / `student123`

## Architecture (ASCII)
```
+--------------------+          +-----------------------------+
|  frontend (Nginx)  |  fetch   |        backend (FastAPI)    |
|  HTML/CSS/JS       +--------->+  Auth, ML, Claude adapter   |
+---------+----------+          +----------+------------------+
          ^                                |
          | static                         | motor
          |                                v
          |                      +-----------------+
          +----------------------+   MongoDB 7     |
                                 +-----------------+
```

## Development
- Python deps in `backend/requirements.txt`
- Run backend locally: `cd backend && uvicorn main:app --reload`
- Serve frontend: `python -m http.server 3000` (or open files directly)

## Testing the API
- Health: `GET http://localhost:8000/`
- Login: `POST /auth/login {"email":"admin@placeiq.edu","password":"admin123"}`
- Protected endpoints require `Authorization: Bearer <token>`

## Notes
- Seeding runs automatically on startup when `users` collection is empty.
- ML scoring lives in `backend/ml_engine.py` and is framework-independent.
- CORS open for local development.
```
