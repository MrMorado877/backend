// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Pool } from "pg";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL local or Render URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Test route
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is alive 🚀" });
});

// Fetch chat titles for a user
app.post("/api/chat/titles", async (req, res) => {
  try {
    const { email } = req.body;
    const result = await pool.query(
      `SELECT id, title, created_at 
       FROM chats 
       WHERE user_email = $1 
       ORDER BY created_at DESC`,
      [email]
    );
    res.json({ titles: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch chat titles" });
  }
});

// Fetch chat history for a chatId
app.post("/api/chat/history", async (req, res) => {
  try {
    const { chatId } = req.body;
    const result = await pool.query(
      `SELECT sender, content, created_at 
       FROM messages 
       WHERE chat_id = $1 
       ORDER BY created_at ASC`,
      [chatId]
    );
    res.json({ history: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

// Send message and get AI reply
app.post("/api/chat", async (req, res) => {
  try {
    const { message, email } = req.body;

    // Check user
    let userRes = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    let userId;
    if (userRes.rows.length === 0) {
      const insertUser = await pool.query(
        "INSERT INTO users (name, email, created_at) VALUES ($1,$2,NOW()) RETURNING id",
        ["Anonymous", email]
      );
      userId = insertUser.rows[0].id;
    } else {
      userId = userRes.rows[0].id;
    }

    // Create chat
    const chatTitle = message.length > 20 ? message.substring(0, 20) + "..." : message;
    const chatInsert = await pool.query(
      "INSERT INTO chats (user_email, title, created_at) VALUES ($1,$2,NOW()) RETURNING id",
      [email, chatTitle]
    );
    const chatId = chatInsert.rows[0].id;

    // Save user message
    await pool.query(
      "INSERT INTO messages (chat_id,sender,content,created_at) VALUES ($1,$2,$3,NOW())",
      [chatId, "user", message]
    );

    // OpenAI GPT-4 reply
    const aiRes = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are friendly AI. Answer in multi-line format with emojis." },
        { role: "user", content: message }
      ],
      temperature: 0.7
    });

    const aiReply = aiRes.choices[0].message.content;

    // Save AI reply
    await pool.query(
      "INSERT INTO messages (chat_id,sender,content,created_at) VALUES ($1,$2,$3,NOW())",
      [chatId, "bot", aiReply]
    );

    res.json({ reply: aiReply, chatId, title: chatTitle });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Nexora backend running on port ${PORT}`));
