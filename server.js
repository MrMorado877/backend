import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
import OpenAI from "openai";

dotenv.config();

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// Postgres connection using DATABASE_URL from Render env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // needed for Render Postgres
});

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- TEST ROUTE ---
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend alive 🚀" });
});

// --- CHAT ENDPOINT ---
app.post("/api/chat", async (req, res) => {
  try {
    const { message, language, email } = req.body;
    if (!email) return res.status(400).json({ error: "User email required" });

    // Optional: Store message in DB
    const chatRes = await pool.query(
      "INSERT INTO messages (user_email, sender, content) VALUES ($1,$2,$3) RETURNING id",
      [email, "user", message]
    );
    const messageId = chatRes.rows[0].id;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: `You are Nexora AI. Respond in ${language || "English"}` },
        { role: "user", content: message },
      ],
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content;

    // Save bot reply
    await pool.query(
      "INSERT INTO messages (user_email, sender, content) VALUES ($1,$2,$3)",
      [email, "bot", reply]
    );

    res.json({ reply });
  } catch (err) {
    console.error("AI chat error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- CHAT HISTORY ---
app.post("/api/history", async (req, res) => {
  try {
    const { email, chatId } = req.body;
    if (!email) return res.status(400).json({ error: "User email required" });

    let messages;
    if (chatId) {
      messages = await pool.query(
        "SELECT id, sender, content, created_at FROM messages WHERE id=$1",
        [chatId]
      );
    } else {
      messages = await pool.query(
        "SELECT id, sender, content, created_at FROM messages WHERE user_email=$1 ORDER BY created_at ASC",
        [email]
      );
    }

    res.json({ history: messages.rows });
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- CHAT TITLES ---
app.post("/api/titles", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "User email required" });

    const titlesRes = await pool.query(
      `SELECT DISTINCT ON (id) id, content AS title, created_at 
       FROM messages 
       WHERE user_email=$1 AND sender='user' 
       ORDER BY id DESC, created_at DESC`,
      [email]
    );

    res.json({ titles: titlesRes.rows });
  } catch (err) {
    console.error("Titles error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- START SERVER ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Nexora backend running on port ${PORT}`);
});
