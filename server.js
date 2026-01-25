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

/* ================= DATABASE ================= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("render.com")
    ? { rejectUnauthorized: false }
    : false
});

pool.connect()
  .then(() => console.log("✅ PostgreSQL connected"))
  .catch(err => console.error("❌ DB error", err));

/* ================= OPENAI ================= */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const NEXORA_PROMPT = `
You are Nexora AI, created by Morado.
You are not ChatGPT.
You are not OpenAI.
You must identify yourself only as Nexora AI.
`;

/* ================= LOGIN ================= */
app.post("/api/login", async (req, res) => {
  const { email, name, picture } = req.body;

  try {
    await pool.query(
      `INSERT INTO users (email, name, picture)
       VALUES ($1,$2,$3)
       ON CONFLICT (email) DO NOTHING`,
      [email, name || "", picture || ""]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

/* ================= CHAT ================= */
app.post("/api/chat", async (req, res) => {
  const { email, message } = req.body;

  try {
    // FORCE user to exist (fixes foreign key crash)
    await pool.query(
      `INSERT INTO users (email)
       VALUES ($1)
       ON CONFLICT (email) DO NOTHING`,
      [email]
    );

    // Create chat
    const chat = await pool.query(
      `INSERT INTO chats (user_email) VALUES ($1) RETURNING id`,
      [email]
    );

    const chatId = chat.rows[0].id;

    // Save user message
    await pool.query(
      `INSERT INTO messages (chat_id, role, content)
       VALUES ($1,'user',$2)`,
      [chatId, message]
    );

    // Call Nexora AI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: NEXORA_PROMPT },
        { role: "user", content: message }
      ]
    });

    const reply = completion.choices[0].message.content;

    // Save Nexora reply
    await pool.query(
      `INSERT INTO messages (chat_id, role, content)
       VALUES ($1,'assistant',$2)`,
      [chatId, reply]
    );

    res.json({ reply });

  } catch (err) {
    console.error("Chat failure:", err);
    res.status(500).json({ error: "AI failed" });
  }
});

/* ================= HISTORY ================= */
app.post("/api/history", async (req, res) => {
  const { email } = req.body;

  try {
    const data = await pool.query(`
      SELECT m.role, m.content
      FROM chats c
      JOIN messages m ON c.id = m.chat_id
      WHERE c.user_email = $1
      ORDER BY m.created_at ASC
    `, [email]);

    res.json(data.rows);
  } catch (err) {
    res.status(500).json({ error: "History failed" });
  }
});

/* ================= PORT ================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Nexora backend running on port", PORT);
});
