# English Boost

Static English-learning site (intensive plan, phrases, grammar, exams, flashcards, speaking practice) + a tiny Node API for per-user accounts and progress.

- `index.html` — student app (login → own progress, synced to server)
- `admin.html` — admin page: add / delete users, reset password / progress, view each user's report
- `data.js` — course content · `report.js` — progress report (shared by both pages) · `img/` — slides
- `server/server.js` — zero-dependency Node API (Node 18+), JSON storage

## Server setup (once)
```bash
# 1) run the API with pm2 (ADMIN_PASSWORD is required, min 8 chars)
cd <repo-path>
ADMIN_PASSWORD='choose-a-strong-one' pm2 start server/ecosystem.config.js --update-env
pm2 save
```
Data is stored in `~/.english-boost-data/db.json` (outside the web root). Override with `DATA_DIR`.

```nginx
# 2) nginx — inside the existing server { } block of the domain
location /english/api/ {
    proxy_pass http://127.0.0.1:3311/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
location ~ ^/english/(\.git|server)(/|$) { deny all; return 404; }
```

## Auto-deploy
Every push to `main` runs `.github/workflows/deploy.yml`: `git reset --hard origin/main` in `DEPLOY_PATH`, then `pm2 reload english-boost`.
Secrets: `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`, `DEPLOY_PATH` (optional `SERVER_PORT`).

## API
`POST /api/login` · `GET /api/me` · `GET|PUT /api/progress` · `POST /api/logout`
Admin: `POST /api/admin/login` · `GET|POST /api/admin/users` · `DELETE /api/admin/users/:id` · `GET /api/admin/users/:id/progress` · `POST /api/admin/users/:id/password` · `POST /api/admin/users/:id/reset-progress`
