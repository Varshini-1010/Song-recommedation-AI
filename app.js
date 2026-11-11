const MOODS = ["Happy", "Calm", "Sad", "Energetic", "Romantic", "Focused", "Nostalgic", "Party"];
const form = document.getElementById("form");
const moodRow = document.getElementById("moods");
const errorEl = document.getElementById("error");
const goBtn = document.getElementById("go");
let selectedMood = "";
let lastSongs = []; // remembered so "Give me different songs" can ask for new ones

// Build the mood buttons; only one mood can be selected at a time
MOODS.forEach((mood) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mood";
  btn.textContent = mood;
  btn.setAttribute("aria-pressed", "false");
  btn.addEventListener("click", () => {
    selectedMood = selectedMood === mood ? "" : mood;
    document.querySelectorAll(".mood").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.textContent === selectedMood)));
  });
  moodRow.appendChild(btn);
});

const show = (id) => ["empty", "loading", "playlist"].forEach((x) =>
  (document.getElementById(x).hidden = x !== id));

const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function getPlaylist(different = false) {
  errorEl.textContent = "";
  const data = Object.fromEntries(new FormData(form));
  data.mood = selectedMood;
  data.exclude = different ? lastSongs.map((s) => `${s.title} by ${s.artist}`) : [];
  if (!data.mood && !data.activity && !data.genres && !data.artists) {
    errorEl.textContent = "Choose a mood or fill in at least one field.";
    return;
  }

  goBtn.disabled = true;
  show("loading");
  try {
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Something went wrong.");
    renderPlaylist(result, data);
  } catch (err) {
    errorEl.textContent = err.message;
    show("empty");
  } finally {
    goBtn.disabled = false;
  }
}

function renderPlaylist({ playlist_name, songs }, data) {
  document.getElementById("pname").textContent = playlist_name;
  lastSongs = songs;
  const parts = [
    data.mood && `a ${data.mood.toLowerCase()} mood`,
    data.activity && data.activity.charAt(0).toLowerCase() + data.activity.slice(1),
  ].filter(Boolean);
  let meta = `${songs.length} songs`;
  if (parts.length) meta += ` for ${parts.join(" and ")}`;
  if (data.languages) meta += `, in ${data.languages}`;
  document.getElementById("pmeta").textContent = meta;

  document.getElementById("tracks").innerHTML = songs.map((s) => {
    const q = encodeURIComponent(`${s.title} ${s.artist}`);
    const details = [s.genre, s.language, s.year].filter(Boolean).map(escapeHtml).join(", ");
    return `<li>
      <div>
        <div class="t-title">${escapeHtml(s.title)}</div>
        <div class="t-artist">${escapeHtml(s.artist)}</div>
        <p class="t-reason">${escapeHtml(s.reason)}</p>
        <span class="t-tag">${details}</span>
      </div>
      <div class="links">
        <a href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">YouTube</a>
        <a href="https://open.spotify.com/search/${q}" target="_blank" rel="noopener">Spotify</a>
      </div>
    </li>`;
  }).join("");
  show("playlist");
  if (window.innerWidth <= 860) document.querySelector(".results").scrollIntoView({ behavior: "smooth" });
}

form.addEventListener("submit", (e) => { e.preventDefault(); getPlaylist(false); });
document.getElementById("again").addEventListener("click", () => getPlaylist(true));
