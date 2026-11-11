import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(express.json({ limit: "10kb" }));
app.use(express.static("public"));

// The API key is read from the server's environment and never sent to the browser.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-5-5";

// Simple in-memory rate limit: 10 requests per minute per visitor, to protect your API credit.
const hits = new Map();
function rateLimit(req, res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 10) {
    return res.status(429).json({ error: "Too many requests. Wait a minute and try again." });
  }
  recent.push(now);
  hits.set(ip, recent);
  next();
}

// Claude must answer by calling this tool, so the reply is always valid, structured JSON.
const recommendTool = {
  name: "recommend_songs",
  description: "Return a list of real, existing song recommendations.",
  input_schema: {
    type: "object",
    properties: {
      playlist_name: { type: "string", description: "A short, catchy name for this playlist" },
      songs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            artist: { type: "string" },
            year: { type: "integer" },
            language: { type: "string" },
            genre: { type: "string" },
            reason: { type: "string", description: "One sentence on why it fits the request" },
          },
          required: ["title", "artist", "genre", "reason"],
        },
      },
    },
    required: ["playlist_name", "songs"],
  },
};

const SYSTEM_PROMPT = `You are a music recommendation assistant.
Recommend only real songs that actually exist, with the correct artist name.
Match the listener's mood, activity, genres, languages and favourite artists.
Mix well-known and lesser-known tracks, and avoid repeating the same artist more than twice.
Never quote or reproduce song lyrics. Describe the sound or feeling in your own words instead.
Keep each reason to one short sentence.`;

const clean = (value, max = 120) => String(value ?? "").trim().slice(0, max);

app.post("/api/recommend", rateLimit, async (req, res) => {
  const mood = clean(req.body.mood, 40);
  const activity = clean(req.body.activity, 60);
  const genres = clean(req.body.genres);
  const artists = clean(req.body.artists);
  const languages = clean(req.body.languages, 80);
  const exclude = Array.isArray(req.body.exclude) ? req.body.exclude.slice(0, 15).map((x) => clean(x, 100)) : [];
  const count = Math.min(Math.max(parseInt(req.body.count, 10) || 8, 3), 15);

  if (!mood && !activity && !genres && !artists) {
    return res.status(400).json({ error: "Choose a mood or fill in at least one field." });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "The server has no ANTHROPIC_API_KEY set. Add it to your environment variables." });
  }

  const request = [
    `Recommend ${count} songs.`,
    mood && `Mood: ${mood}`,
    activity && `Activity: ${activity}`,
    genres && `Preferred genres: ${genres}`,
    artists && `Artists I like: ${artists}`,
    languages && `Languages: ${languages}`,
    exclude.length && `Do not include these songs again: ${exclude.join("; ")}`,
  ].filter(Boolean).join("\n");

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools: [recommendTool],
      tool_choice: { type: "tool", name: "recommend_songs" },
      messages: [{ role: "user", content: request }],
    });

    const toolCall = message.content.find((block) => block.type === "tool_use");
    if (!toolCall) throw new Error("No recommendations returned");
    res.json(toolCall.input);
  } catch (err) {
    console.error("Claude API error:", err.status, err.message);
    const status = err.status === 401 ? 500 : err.status === 429 ? 429 : 502;
    const error =
      err.status === 401 ? "The API key was rejected. Check ANTHROPIC_API_KEY on the server."
      : err.status === 429 ? "The AI service is busy right now. Try again in a moment."
      : "Recommendations could not be generated. Try again.";
    res.status(status).json({ error });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SongSense running on http://localhost:${PORT}`));
