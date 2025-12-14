// server.js
import express from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("Backend is live!");
});

// Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Chat API
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.json({ reply: "Please send a message." });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    const result = await model.generateContent(message);

    const reply =
      result?.response?.text?.() ||
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;

    // Only fallback — NOT a limit message
    if (!reply) {
      return res.json({
        reply: "Sorry, I couldn’t generate a reply. Please try again."
      });
    }

    res.json({ reply });

  } catch (error) {
    console.error("Gemini error:", error.message);

    res.json({
      reply: "Something went wrong. Please try again later."
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
