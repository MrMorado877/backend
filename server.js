// ====== VARIABLES ======
const backend = "https://backend-b80q.onrender.com/api/chat";
const sidebar = document.getElementById("sidebar");
const main = document.getElementById("main");
const chatArea = document.getElementById("chatArea");
const input = document.getElementById("input");

let chats = JSON.parse(localStorage.getItem("nexoraChats") || "[]");
let currentChat = null;

// ====== SIDEBAR ======
function toggleSidebar() {
  sidebar.classList.toggle("closed");
  main.classList.toggle("full");
}

// Sidebar default closed
sidebar.classList.add("closed");
main.classList.add("full");

// ====== THEME ======
function toggleTheme() {
  document.body.classList.toggle("light");
}

// ====== CHAT MANAGEMENT ======
function save() {
  localStorage.setItem("nexoraChats", JSON.stringify(chats));
}

function newChat() {
  currentChat = { id: Date.now(), title: "New Chat", messages: [] };
  chats.unshift(currentChat);
  save();
  renderTitles();
  loadChat(currentChat);
}

function renderTitles() {
  const box = document.getElementById("chatTitles");
  box.innerHTML = "";
  chats.forEach(c => {
    const d = document.createElement("div");
    d.className = "chat-title";
    d.textContent = c.title;
    d.onclick = () => loadChat(c);
    box.appendChild(d);
  });
}

function loadChat(chat) {
  currentChat = chat;
  chatArea.innerHTML = "";
  chat.messages.forEach(m => addMessage(m.text, m.role, false));
}

// ====== MESSAGES ======
function addMessage(text, role, store = true) {
  const d = document.createElement("div");
  d.className = `message ${role}`;
  d.innerHTML = marked.parse(text);
  chatArea.appendChild(d);
  chatArea.scrollTop = chatArea.scrollHeight;

  if (store) {
    currentChat.messages.push({ role, text });
    if (currentChat.messages.length === 1) {
      currentChat.title = text.slice(0, 25);
      renderTitles();
    }
    save();
  }
  return d;
}

// ====== TYPING EFFECT WITH PARAGRAPH SEPARATION ======
function typeEffect(el, text) {
  el.innerHTML = "";

  const paragraphs = text.split("\n\n");
  let paraIndex = 0;

  function typeParagraph() {
    if (paraIndex >= paragraphs.length) return;

    let words = paragraphs[paraIndex].split(" ");
    let i = 0;

    const t = setInterval(() => {
      if (i < words.length) {
        el.innerHTML += words[i] + " ";
        chatArea.scrollTop = chatArea.scrollHeight;
        i++;
      } else {
        clearInterval(t);
        paraIndex++;
        if (paraIndex < paragraphs.length) {
          el.innerHTML += "<hr>";
          typeParagraph();
        }
      }
    }, 40);
  }

  typeParagraph();
}

// ====== SEND MESSAGE ======
input.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

async function sendMessage() {
  if (!currentChat) newChat();
  const msg = input.value.trim();
  if (!msg) return;

  addMessage(msg, "user");
  input.value = "";

  const botDiv = document.createElement("div");
  botDiv.className = "message bot";
  chatArea.appendChild(botDiv);

  chatArea.scrollTop = chatArea.scrollHeight;

  // Typing sound
  const typingSound = new Audio("/sounds/type.mp3");
  typingSound.loop = true;
  typingSound.play();

  try {
    const response = await fetch(backend, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        sessionId: currentChat.id
      })
    });

    const data = await response.json();
    typingSound.pause();
    typingSound.currentTime = 0;

    typeEffect(botDiv, data.reply);
    currentChat.messages.push({ role: "bot", text: data.reply });
    save();

  } catch (err) {
    typingSound.pause();
    typingSound.currentTime = 0;
    botDiv.textContent = "Server error";
  }
}

// ====== MOBILE SWIPE FOR SIDEBAR ======
let startX = 0;
document.addEventListener("touchstart", e => startX = e.touches[0].clientX);
document.addEventListener("touchend", e => {
  let endX = e.changedTouches[0].clientX;
  if (endX - startX > 80) sidebar.classList.remove("closed"), main.classList.remove("full");
  if (startX - endX > 80) sidebar.classList.add("closed"), main.classList.add("full");
});

// ====== INIT ======
if (chats.length) {
  loadChat(chats[0]);
  renderTitles();
}
