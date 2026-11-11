# SongSense – AI Song Recommendation App

SongSense recommends real songs based on your mood, activity, favourite genres, artists and languages. It uses the Claude API from Anthropic to generate a playlist, with YouTube and Spotify search links for every song.

## Tech stack
- **Front end:** HTML, CSS, JavaScript (in `public/`)
- **Back end:** Node.js + Express (`server.js`)
- **AI:** Claude API through the official `@anthropic-ai/sdk`

## How it works
1. The user picks a mood and fills in their preferences.
2. The browser sends them to `POST /api/recommend` on the Express server.
3. The server calls Claude with a system prompt and a **tool schema**, which forces Claude to reply in structured JSON (title, artist, year, language, genre, reason).
4. The server returns that JSON, and the page renders it as a numbered playlist.

The API key stays on the server and is never sent to the browser. The server also validates input and limits each visitor to 10 requests per minute to protect your API credit.

## 1. Get an API key
1. Go to https://console.anthropic.com and sign up.
2. Add credit under **Billing** (the API is paid per use; the default Haiku model is the cheapest).
3. Open **API Keys** → **Create Key**, and copy it. Keep it secret.

## 2. Run it on your computer
Requires Node.js 20 or later.
```bash
npm install
cp .env.example .env        # then paste your key into .env
npm run dev
```
Open http://localhost:3000

## 3. Deploy it free on Render
1. Create a new repository on GitHub and push this folder to it (the `.gitignore` keeps `.env` and `node_modules` out).
2. Sign in at https://render.com with GitHub.
3. Click **New** → **Blueprint**, pick your repository, and Render reads `render.yaml` automatically.
   (Or click **New** → **Web Service**, with Build command `npm install` and Start command `npm start`.)
4. When asked, enter your **ANTHROPIC_API_KEY**.
5. Click **Deploy**. Your app goes live at `https://songsense-ai.onrender.com` (or a similar URL).

Note: on Render's free plan, the app sleeps after about 15 minutes of no visitors, so the first request after that takes around 30–60 seconds.

## API
`POST /api/recommend`
```json
{ "mood": "Calm", "activity": "Studying", "genres": "Lo-fi", "artists": "A. R. Rahman", "languages": "Tamil, English", "count": 8 }
```
Response:
```json
{ "playlist_name": "Late Night Calm", "songs": [ { "title": "...", "artist": "...", "year": 2006, "language": "Tamil", "genre": "Melody", "reason": "..." } ] }
```
