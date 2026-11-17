# English Boost

Static English-learning site (intensive plan, phrases, grammar, exams, flashcards, speaking practice) built from the intermediate course sessions.

- `index.html` — the app
- `data.js` — all course content (phrases, questions, speaking cards, grammar, plan)
- `img/` — slide images

No build step. Serve the folder as-is (works from any sub-path, e.g. `/english/`).

## Auto-deploy
Every push to `main` runs `.github/workflows/deploy.yml`, which SSHes into the server and runs `git reset --hard origin/main` inside `DEPLOY_PATH`.

Required repo secrets: `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`, `DEPLOY_PATH` (optional `SERVER_PORT`).
