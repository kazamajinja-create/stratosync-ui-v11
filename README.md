# StratoSync Soccer Static UI (v2)

This is a lightweight demo UI for the StratoSync Soccer FastAPI backend.

## Local run
Open `index.html` in your browser.

- Default API URL: `http://localhost:8000`
- To point elsewhere, edit `config.js`:

```js
window.__CONFIG__ = { API_BASE_URL: "https://YOUR_API.onrender.com" };
```

## Deploy on Render (recommended)
Create a **Static Site** from this folder/repo.

**Build Command**
```bash
bash render-build.sh
```

**Publish Directory**
```
.
```

**Environment Variables**
- `API_BASE_URL` = `https://<your-fastapi-service>.onrender.com`

After deploy, your UI calls:
- `GET /health`
- `GET /v3/analyze?club_id=...`

If the browser blocks requests (CORS), allow the UI origin in the API service.
