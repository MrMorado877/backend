// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const { Configuration, OpenAIApi } = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // For production, you can set origin to your front-end URL
app.use(bodyParser.json());
app.use(express.static("public")); // serve front-end files

// OpenAI setup
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

// In-memory chat storage (replace with DB if needed)
let chats = {}; // { email: [{ id, title, history: [{ sender, content }] }] }

// Helper to generate chat title
function generateTitle(message) {
  return message.length > 20 ? message.slice(0, 20) + "..." : message;
}

// Routes

// 1️⃣ Get chat titles
app.post("/api/chat/titles", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const userChats = chats[email] || [];
  const titles = userChats.map(chat => ({ id: chat.id, title: chat.title }));
  res.json({ titles });
});

// 2️⃣ Get chat history
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

// 3️⃣ Send message and get GPT reply
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

    // Save user message
    chat.history.push({ sender: "user", content: message });

    // Build messages for OpenAI
    const gptMessages = chat.history.map(msg => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.content
    }));

    // Call OpenAI GPT
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: gptMessages
    });

    const reply = completion.data.choices[0].message.content;

    // Save bot reply
    chat.history.push({ sender: "bot", content: reply });

    res.json({ reply });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
