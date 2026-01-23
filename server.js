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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ------------------- DB Helpers ------------------- */

async function getUser(email) {
  const q = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  if (q.rows.length) return q.rows[0];

  const ins = await pool.query(
    "INSERT INTO users (email) VALUES ($1) RETURNING *",
    [email]
  );
  return ins.rows[0];
}

async function getLatestChat(userId) {
  const q = await pool.query(
    "SELECT * FROM chats WHERE user_id=$1 ORDER BY id DESC LIMIT 1",
    [userId]
  );
  if (q.rows.length) return q.rows[0];

  const ins = await pool.query(
    "INSERT INTO chats (user_id,title) VALUES ($1,'New Chat') RETURNING *",
    [userId]
  );
  return ins.rows[0];
}

/* ------------------- AI Chat ------------------- */

app.post("/api/chat", async (req, res) => {
  try {
    const { email, message, language } = req.body;
    if (!email || !message) return res.status(400).json({ error: "Missing data" });

    const user = await getUser(email);
    const chat = await getLatestChat(user.id);

    await pool.query(
      "INSERT INTO messages (chat_id,sender,content) VALUES ($1,'user',$2)",
      [chat.id, message]
    );

    let reply;

    try {
      const ai = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `You are Nexora AI. Reply in ${language || "English"} with friendly tone, emojis and line breaks.` },
          { role: "user", content: message }
        ]
      });

      reply = ai.choices[0].message.content;
    } catch (err) {
      console.log("⚠️ OpenAI fallback used");
      reply = `🤖 Nexora (offline)\n\nYou said:\n"${message}"\n\nTry again later 😊`;
    }

    await pool.query(
      "INSERT INTO messages (chat_id,sender,content) VALUES ($1,'bot',$2)",
      [chat.id, reply]
    );

    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------- Chat Titles ------------------- */

app.post("/api/chat/titles", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await getUser(email);

    const q = await pool.query(
      "SELECT id,title FROM chats WHERE user_id=$1 ORDER BY id DESC",
      [user.id]
    );

    res.json({ titles: q.rows });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------- Chat History ------------------- */

app.post("/api/chat/history", async (req, res) => {
  try {
    const { chatId } = req.body;

    const q = await pool.query(
      "SELECT sender,content FROM messages WHERE chat_id=$1 ORDER BY id",
      [chatId]
    );

    res.json({ history: q.rows });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------- Rename Chat ------------------- */

app.post("/api/chat/rename", async (req, res) => {
  const { chatId, newTitle } = req.body;
  await pool.query("UPDATE chats SET title=$1 WHERE id=$2", [newTitle, chatId]);
  res.json({ success: true });
});

/* ------------------- Delete Chat ------------------- */

app.post("/api/chat/delete", async (req, res) => {
  const { chatId } = req.body;
  await pool.query("DELETE FROM chats WHERE id=$1", [chatId]);
  res.json({ success: true });
});

/* ------------------- Health Check ------------------- */

app.get("/", (req,res)=>{
  res.send("Nexora AI Backend Live 🚀");
});

/* ------------------- Server ------------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Nexora backend running on port", PORT);
});
