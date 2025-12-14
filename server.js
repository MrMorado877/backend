// server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = 3000;

/* ===============================
   MIDDLEWARE
================================ */
app.use(cors());
app.use(express.json());

/* ===============================
   GEMINI SETUP
================================ */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});

/* ===============================
   YOUR PLAN SYSTEM (FREE / PRO)
================================ */
const SAFE_LIMITS = {
  free: {
    RPD: 10, // half of Gemini free tier (your idea)
    RPM: 2
  },
  pro: {
    RPD: 18,
    RPM: 4
  }
};

/* ===============================
   IN-MEMORY USAGE TRACKER
================================ */
const usageStore = {};

/* ===============================
   LIMITER MIDDLEWARE
================================ */
function usageLimiter(req, res, next) {
  const userId = req.body.userId || "guest";
  const plan = req.body.plan === "pro" ? "pro" : "free";
  const today = new Date().toISOString().split("T")[0];
  const now = Date.now();

  if (!usageStore[userId] || usageStore[userId].date !== today) {
    usageStore[userId] = {
      date: today,
      daily: 0,
      minute: [],
      plan
    };
  }

  const limits = SAFE_LIMITS[plan];

  // Clean old RPM timestamps
  usageStore[userId].minute = usageStore[userId].minute.filter(
    t => now - t < 60000
  );

  if (usageStore[userId].minute.length >= limits.RPM) {
    return res.json({
      reply: "✔️ Too many requests. Please wait a moment 😊"
    });
  }

  if (usageStore[userId].daily >= limits.RPD) {
    return res.json({
      reply:
        plan === "free"
          ? "✔️ Free daily limit reached 😊 Upgrade to PRO."
          : "✔️ Daily limit reached 😊 Try again tomorrow."
    });
  }

  usageStore[userId].minute.push(now);
  usageStore[userId].daily++;

  next();
}

/* ===============================
   CHAT API (USED BY FRONTEND)
================================ */
app.post("/api/chat", usageLimiter, async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.json({
        reply: "Please type something 😊"
      });
    }

    const result = await model.generateContent(userMessage);

    const reply =
      result?.response?.text?.() ||
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return res.json({
        reply: "I’m a bit tired right now 😊 Please try again later."
      });
    }

    res.json({ reply });

  } catch (error) {
    console.error("Gemini error:", error);

    res.json({
      reply:
        "✔️ Connection error 😊 Free-tier limit may be exhausted."
    });
  }
});

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("MORADO AI backend is live 🚀");
});

/* ===============================
   START SERVER
================================ */
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
