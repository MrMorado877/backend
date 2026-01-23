import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";
import OpenAI from "openai";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// PostgreSQL setup
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required for Render Postgres
});

// Test DB connection
pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch(err => console.error("❌ PostgreSQL connection error:", err));

// ================= ROUTES ================= //

// Test route
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is live 🚀" });
});

// Get chat history titles
app.post("/api/chat/titles", async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query(
      "SELECT id, title FROM chats WHERE user_email = $1 ORDER BY created_at DESC",
      [email]
    );
    res.json({ titles: result.rows });
  } catch (err) {
    console.error(err);
    res.json({ titles: [] });
  }
});

// Get chat messages
app.post("/api/chat/history", async (req, res) => {
  const { chatId } = req.body;
  try {
    const result = await pool.query(
      "SELECT sender, content, created_at FROM messages WHERE chat_id = $1 ORDER BY created_at ASC",
      [chatId]
    );
    res.json({ history: result.rows });
  } catch (err) {
    console.error(err);
    res.json({ history: [] });
  }
});

// Create new chat
app.post("/api/chat/new", async (req, res) => {
  const { email, title } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO chats(user_email, title) VALUES($1, $2) RETURNING id",
      [email, title || "New Chat"]
    );
    res.json({ chatId: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ chatId: null });
  }
});

// AI chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message, language, email, chatId } = req.body;

    // Validate
    if (!message) return res.json({ reply: "No message provided." });

    // ---------------- OpenAI ---------------- //
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: `You are Nexora AI. Respond in ${language || "English"} using multi-line, emojis, and friendly tone.` },
        { role: "user", content: message }
      ],
      temperature: 0.7
    });

    const reply = response.choices[0].message.content;

    // ---------------- Save to DB ---------------- //
    if (chatId) {
      await pool.query(
        "INSERT INTO messages(chat_id, sender, content) VALUES($1, $2, $3),($1, $4, $5)",
        [chatId, "user", message, "bot", reply]
      );
    }

    res.json({ reply });

  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ reply: "Server error. Please try again later." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Nexora backend running on port ${PORT}`);
});
