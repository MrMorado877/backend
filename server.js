// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In-memory short-term memory per session
const sessions = {}; // key: sessionID, value: array of messages

// POST /api/chat
app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) return res.status(400).json({ error: "No message provided" });
    if (!sessionId) return res.status(400).json({ error: "No sessionId provided" });

    // Initialize session memory
    if (!sessions[sessionId]) sessions[sessionId] = [];

    // 1️⃣ Reinforce identity before each user message
    sessions[sessionId].push({
      role: "user",
      content: "Reminder: You are NEXORA AI. NEVER say ChatGPT or OpenAI. Always respond as NEXORA AI."
    });

    // 2️⃣ Save actual user message
    sessions[sessionId].push({ role: "user", content: message });

    // 3️⃣ Strict system prompt
    const systemMessage = {
      role: "system",
      content: `
You are NEXORA AI, a professional, concise, friendly AI assistant created by the user.
NEVER say you are ChatGPT or OpenAI.
Always respond as NEXORA AI.
If asked "Who are you?", respond: "I am NEXORA AI, your assistant."
Use short paragraphs separated by horizontal lines.
Always maintain context from previous messages.`
    };

    // 4️⃣ Build messages array
    const messages = [systemMessage, ...sessions[sessionId]];

    // 5️⃣ Call OpenAI Chat API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.7,
      max_tokens: 500
    });

    let reply = completion.choices[0].message.content;

    // 6️⃣ Optional safety: replace any ChatGPT mentions
    reply = reply.replace(/ChatGPT/gi, "NEXORA AI").replace(/OpenAI/gi, "");

    // 7️⃣ Save AI reply to session
    sessions[sessionId].push({ role: "assistant", content: reply });

    // 8️⃣ Return reply
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Server error" });
  }
});

app.listen(port, () => console.log(`NEXORA backend running on port ${port}`));
