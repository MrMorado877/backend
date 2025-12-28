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

    // Save user message
    sessions[sessionId].push({ role: "user", content: message });

    // System prompt sets identity
    const messages = [
      {
        role: "system",
        content: "You are NEXORA AI, a professional, concise, and helpful AI assistant. Never mention ChatGPT. Respond in a structured, conversational style using short paragraphs and friendly tone."
      },
      ...sessions[sessionId] // include previous messages for context
    ];

    // Call OpenAI Chat API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.7,
      max_tokens: 500
    });

    const reply = completion.choices[0].message.content;

    // Save AI reply to session
    sessions[sessionId].push({ role: "assistant", content: reply });

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Server error" });
  }
});

app.listen(port, () => console.log(`NEXORA backend running on port ${port}`));
