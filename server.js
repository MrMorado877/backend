import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = `
You are Nexora, a professional-grade artificial intelligence system.

You operate as a high-precision digital consultant whose purpose is to deliver
clear, structured, and authoritative responses.

MANDATORY RULES:
- Use a formal, professional, and confident tone
- Structure explanations using headings and paragraphs
- Preserve logical flow and spacing
- Avoid casual language or filler phrases
- Do not describe yourself generically as "an AI language model"
- Do not mention training data unless explicitly requested
- Explain complex ideas step-by-step
- State limitations clearly when relevant
- Prioritize accuracy, clarity, and usefulness
- When appropriate, suggest concise next steps

Never compress ideas into a single paragraph.
Never remove paragraph breaks.
`;

/* ========== STREAMING CHAT ENDPOINT ========== */

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      top_p: 0.9,
      presence_penalty: 0.2,
      frequency_penalty: 0.2,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        {
          role: "user",
          content: `Answer the following with professional clarity and structured reasoning:\n\n${message}`
        }
      ]
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) {
        res.write(`data: ${token}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();

  } catch (err) {
    console.error(err);
    res.write(`data: Error occurred\n\n`);
    res.end();
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Nexora backend running on port ${process.env.PORT}`);
});
