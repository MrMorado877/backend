import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

/* ============================
   In-Memory Storage
============================ */

const users = {};
const chats = {};
const messages = {};

/* ============================
   Health Check
============================ */

app.get("/", (req, res) => {
  res.send("Nexora AI Backend is running");
});

/* ============================
   Login
============================ */

app.post("/login", (req, res) => {
  const { email, name, picture } = req.body;

  if (!email) return res.status(400).json({ error: "Email required" });

  if (!users[email]) {
    users[email] = { email, name, picture, createdAt: Date.now() };
  }

  if (!chats[email]) {
    chats[email] = [];
  }

  res.json({ success: true, user: users[email] });
});

/* ============================
   Get Chats
============================ */

app.get("/chats/:email", (req, res) => {
  const { email } = req.params;
  res.json(chats[email] || []);
});

/* ============================
   Send Message to Nexora AI
============================ */

app.post("/chat", async (req, res) => {
  const { email, message } = req.body;

  if (!email || !message) {
    return res.status(400).json({ error: "Missing data" });
  }

  if (!chats[email]) chats[email] = [];
  if (!messages[email]) messages[email] = [];

  messages[email].push({ role: "user", content: message });

  try {
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are Nexora AI, an advanced helpful assistant." },
          ...messages[email]
        ]
      })
    });

    const data = await aiResponse.json();
    const reply = data.choices?.[0]?.message?.content || "No reply";

    messages[email].push({ role: "assistant", content: reply });
    chats[email].push({ user: message, ai: reply });

    res.json({ reply });

  } catch (err) {
    res.status(500).json({ error: "Nexora AI failed" });
  }
});

/* ============================
   Logout
============================ */

app.post("/logout", (req, res) => {
  res.json({ success: true });
});

/* ============================
   Start Server
============================ */

app.listen(PORT, () => {
  console.log("🚀 Nexora backend running on port " + PORT);
});
