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

// PostgreSQL
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Get or create user
async function getUser(email) {
  let res = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
  if (!res.rows[0]) {
    const newUser = await pool.query(
      "INSERT INTO users(name,email,password) VALUES($1,$2,$3) RETURNING id",
      ["Nexora User", email, "nopassword"]
    );
    return newUser.rows[0].id;
  }
  return res.rows[0].id;
}

// Chat endpoint
app.post("/api/chat", async (req,res)=>{
  try{
    const {message, language, email} = req.body;
    if(!email||!message) return res.status(400).json({reply:"Missing email or message"});
    const userId = await getUser(email);

    // Latest chat
    let chatRes = await pool.query(
      "SELECT id,title FROM chats WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1",
      [userId]
    );
    let chatId, chatTitle;
    if(chatRes.rows[0]){
      chatId = chatRes.rows[0].id;
      chatTitle = chatRes.rows[0].title;
    }else{
      const suggestedTitle = message.length>30 ? message.slice(0,30)+"..." : message;
      const newChat = await pool.query(
        "INSERT INTO chats(user_id,title) VALUES($1,$2) RETURNING id,title",
        [userId,suggestedTitle]
      );
      chatId = newChat.rows[0].id;
      chatTitle = newChat.rows[0].title;
    }

    await pool.query("INSERT INTO messages(chat_id,role,content) VALUES($1,$2,$3)", [chatId,"user",message]);

    // OpenAI call
    let reply;
    try{
      const completion = await openai.chat.completions.create({
        model:"gpt-3.5-turbo",
        messages:[
          {role:"system",content:"You are Nexora AI, friendly, multi-line, use emojis."},
          {role:"user", content:message}
        ],
        temperature:0.7
      });
      reply = completion.choices[0].message.content;
    }catch(err){
      console.error("OpenAI failed:", err.message);
      reply = `🤖 Nexora (mock reply): You said → "${message}"`;
    }

    await pool.query("INSERT INTO messages(chat_id,role,content) VALUES($1,$2,$3)", [chatId,"ai",reply]);
    res.json({reply, chatId, chatTitle});
  }catch(err){ console.error(err); res.status(500).json({reply:"Server error ❌"}); }
});

// Chat titles
app.post("/api/chat/titles", async (req,res)=>{
  try{
    const {email} = req.body;
    const userId = await getUser(email);
    const titles = await pool.query("SELECT id,title FROM chats WHERE user_id=$1 ORDER BY created_at DESC",[userId]);
    res.json({titles: titles.rows});
  }catch(err){ console.error(err); res.status(500).json({titles:[]}); }
});

// Chat history
app.post("/api/chat/history", async (req,res)=>{
  try{
    const {email, chatId} = req.body;
    const userId = await getUser(email);
    const history = await pool.query("SELECT role as sender, content FROM messages WHERE chat_id=$1 ORDER BY created_at ASC",[chatId]);
    res.json({history: history.rows});
  }catch(err){ console.error(err); res.status(500).json({history:[]}); }
});

// Rename
app.post("/api/chat/rename", async (req,res)=>{
  try{
    const {chatId,newTitle} = req.body;
    await pool.query("UPDATE chats SET title=$1 WHERE id=$2",[newTitle,chatId]);
    res.json({success:true});
  }catch(err){ console.error(err); res.status(500).json({success:false}); }
});

// Delete
app.post("/api/chat/delete", async (req,res)=>{
  try{
    const {chatId} = req.body;
    await pool.query("DELETE FROM messages WHERE chat_id=$1",[chatId]);
    await pool.query("DELETE FROM chats WHERE id=$1",[chatId]);
    res.json({success:true});
  }catch(err){ console.error(err); res.status(500).json({success:false}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log(`✅ Backend running on Render at port ${PORT}`));
