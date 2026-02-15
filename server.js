import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 10000;
const chats = {};

let MODEL = null;

/* Find a working Gemini model */
async function findModel() {
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  const models = data.models || [];

  const usable = models.find(m =>
    (m.supportedGenerationMethods || []).includes("generateContent")
  );

  if (!usable) {
    console.error("❌ No usable Gemini model found for this key.");
    return;
  }

  MODEL = usable.name;
  console.log("✅ Using model:", MODEL);
}

/* Start */
await findModel();

app.get("/", (req, res) => {
  res.send("Nexora Gemini backend running");
});

app.post("/chat", async (req, res) => {
  const { email, message } = req.body;
  if (!message) return res.json({ reply: "Say something 🙂" });

  if (!chats[email]) chats[email] = [];

  chats[email].push({ role: "user", parts: [{ text: message }] });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: chats[email],
          generationConfig: { temperature: 0.7 }
        })
      }
    );

    const data = await response.json();

    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Hello 👋 I am Nexora AI (fallback reply).";

    chats[email].push({ role: "model", parts: [{ text: reply }] });

    res.json({ reply });

  } catch (err) {
    console.error("AI ERROR:", err);
    res.json({ reply: "Hello 👋 I am Nexora AI (fallback reply)." });
  }
});

app.listen(PORT, () => {
  console.log("🚀 Nexora running on port", PORT);
});
