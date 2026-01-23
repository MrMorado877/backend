import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// In-memory storage
let chats = {};

// Helper to generate chat title
function generateTitle(message) {
  return message.length > 20 ? message.slice(0, 20) + "..." : message;
}

// Routes (same as before)
app.post("/api/chat/titles", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });
  const userChats = chats[email] || [];
  const titles = userChats.map(chat => ({ id: chat.id, title: chat.title }));
  res.json({ titles });
});

app.post("/api/chat/history", (req, res) => {
  const { chatId } = req.body;
  if (!chatId) return res.status(400).json({ error: "Chat ID required" });

  let found = null;
  for (let email in chats) {
    found = chats[email].find(chat => chat.id === chatId);
    if (found) break;
  }
  if (!found) return res.status(404).json({ error: "Chat not found" });

  res.json({ history: found.history });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { email, message } = req.body;
    if (!email || !message) return res.status(400).json({ error: "Email and message required" });

    if (!chats[email]) chats[email] = [];
    let chat = chats[email].length ? chats[email][chats[email].length - 1] : null;
    if (!chat) {
      const id = uuidv4();
      chat = { id, title: generateTitle(message), history: [] };
      chats[email].push(chat);
    }

    chat.history.push({ sender: "user", content: message });

    const gptMessages = chat.history.map(msg => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.content
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: gptMessages
    });

    const reply = completion.choices[0].message.content;
    chat.history.push({ sender: "bot", content: reply });

    res.json({ reply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
