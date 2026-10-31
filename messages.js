
// ========================================
// ERENSARYA - MESAJLASMA SISTEMI
// ========================================

let activeChatUser = null;
let messageChannel = null;
let messageContacts = [];
let loadingMessages = false;

const messageElement = id => document.getElementById(id);

const messagesPage = messageElement("messagesPage");
const contactList = messageElement("contactList");
const messageList = messageElement("messageList");
const chatHeader = messageElement("chatHeader");
const messageInput = messageElement("messageInput");
const messageForm = messageElement("messageForm");

// MESAJ SAYFASINI AC
messageElement("messagesBtn")?.addEventListener("click", openMessages);

messageElement("backMessages")?.addEventListener("click", () => {
  messagesPage.classList.add("hidden");
  messageElement("feed")?.classList.remove("hidden");
  messageElement("profilePage")?.classList.add("hidden");
  stopMessageRealtime();
});

// MESAJ SAYFASI
async function openMessages() {
  if (!currentUser) {
    showAuth("login");
    return;
  }

  messageElement("feed")?.classList.add("hidden");
  messageElement("profilePage")?.classList.add("hidden");

  messagesPage.classList.remove("hidden");

  await loadMessageContacts();
  startMessageRealtime();
}

// KULLANICILARI YUKLE
async function loadMessageContacts() {
  if (!currentUser) return;

  contactList.innerHTML =
    '<p class="chat-empty">Kullanıcılar yükleniyor...</p>';

  const { data, error } = await db
    .from("profiles")
    .select("id, username, avatar_url")
    .neq("id", currentUser.id)
    .order("username");

  if (error) {
    contactList.textContent = error.message;
    return;
  }

  messageContacts = data || [];
  renderMessageContacts(messageContacts);
}

// KULLANICI LİSTESİ
function renderMessageContacts(users) {
  contactList.innerHTML = "";

  if (!users.length) {
    contactList.innerHTML =
      '<p class="chat-empty">Henüz başka kullanıcı bulunamadı.</p>';
    return;
  }

  users.forEach(user => {
    const button = document.createElement("button");
    button.className = "contact-item";

    if (activeChatUser?.id === user.id) {
      button.classList.add("selected");
    }

    const avatar = document.createElement("div");
    avatar.className = "contact-avatar";

    if (user.avatar_url) {
      const image = document.createElement("img");
      image.src = user.avatar_url;
      image.alt = "";
      avatar.append(image);
    } else {
      avatar.textContent =
        (user.username || "?").charAt(0).toUpperCase();
    }

    const details = document.createElement("div");
    details.className = "contact-details";

    const name = document.createElement("strong");
    name.textContent = "@" + user.username;

    const status = document.createElement("small");
    status.textContent = "Sohbet başlat";

    details.append(name, status);
    button.append(avatar, details);

    button.addEventListener("click", () => {
      openConversation(user);
    });

    contactList.append(button);
  });
}

// KULLANICI ARAMA
messageElement("contactSearch")?.addEventListener("input", event => {
  const search = event.target.value.toLowerCase().trim();

  const filtered = messageContacts.filter(user =>
    user.username.toLowerCase().includes(search)
  );

  renderMessageContacts(filtered);
});

// SOHBET AC
async function openConversation(user) {
  if (!user || !currentUser) return;

  activeChatUser = user;
  renderMessageContacts(messageContacts);

  chatHeader.innerHTML = "";

  const avatar = document.createElement("div");
  avatar.className = "chat-header-avatar";
  avatar.textContent =
    (user.username || "?").charAt(0).toUpperCase();

  const info = document.createElement("div");
  info.className = "chat-header-info";

  const name = document.createElement("strong");
  name.textContent = "@" + user.username;

  const status = document.createElement("small");
  status.textContent = "Özel sohbet";

  info.append(name, status);
  chatHeader.append(avatar, info);

  messageInput.disabled = false;
  messageInput.placeholder = "Mesajını yaz...";

  messageElement("sendMessageBtn").disabled = false;

  await loadMessages();
}

// MESAJLARI YUKLE
async function loadMessages() {
  if (!activeChatUser || !currentUser || loadingMessages) return;

  loadingMessages = true;
  messageList.innerHTML =
    '<p class="chat-empty">Mesajlar yükleniyor...</p>';

  const { data, error } = await db
    .from("messages")
    .select("id,sender_id,receiver_id,content,created_at,is_read")
    .or(
      `and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChatUser.id}),and(sender_id.eq.${activeChatUser.id},receiver_id.eq.${currentUser.id})`
    )
    .order("created_at", { ascending: true });

  loadingMessages = false;

  if (error) {
    messageList.textContent = "Mesajlar yüklenemedi: " + error.message;
    return;
  }

  messageList.innerHTML = "";

  if (!data || data.length === 0) {
    messageList.innerHTML = `
      <div class="chat-start">
        <div class="chat-start-icon">💬</div>
        <h3>İlk mesajı gönder!</h3>
        <p>Bu sohbet henüz boş.</p>
      </div>
    `;
    return;
  }

  data.forEach(message => {
    renderMessage(message);
  });

  scrollMessagesToBottom();

  // GELEN MESAJLARI OKUNDU YAP
  const unread = data
    .filter(message =>
      message.receiver_id === currentUser.id &&
      !message.is_read
    )
    .map(message => message.id);

  if (unread.length) {
    const { error: readError } = await db
      .from("messages")
      .update({ is_read: true })
      .in("id", unread);

    if (readError) {
      console.error("Okundu bilgisi güncellenemedi:", readError);
    }
  }
}

// MESAJ BALONU
function renderMessage(message) {
  const mine = message.sender_id === currentUser.id;

  const bubble = document.createElement("div");
  bubble.className = mine
    ? "message-bubble mine"
    : "message-bubble";

  const content = document.createElement("div");
  content.className = "message-content";
  content.textContent = message.content;

  const footer = document.createElement("div");
  footer.className = "message-footer";

  const time = new Date(message.created_at);

  const clock = document.createElement("small");
  clock.textContent = time.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit"
  });

  footer.append(clock);

  if (mine) {
    const read = document.createElement("small");
    read.className = "read-status";
    read.textContent = message.is_read ? "✓✓" : "✓";
    footer.append(read);
  }

  bubble.append(content, footer);
  messageList.append(bubble);
}

function scrollMessagesToBottom() {
  messageList.scrollTop = messageList.scrollHeight;
}

// MESAJ GONDER
messageForm?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) {
    showAuth("login");
    return;
  }

  if (!activeChatUser) {
    showError("Önce bir kullanıcı seç.");
    return;
  }

  const content = messageInput.value.trim();

  if (!content) return;

  const button = messageElement("sendMessageBtn");
  button.disabled = true;

  const { error } = await db
    .from("messages")
    .insert({
      sender_id: currentUser.id,
      receiver_id: activeChatUser.id,
      content: content.slice(0, 2000)
    });

  button.disabled = false;

  if (error) {
    showError("Mesaj gönderilemedi: " + error.message);
    return;
  }

  messageInput.value = "";
  await loadMessages();
  messageInput.focus();
});

// GERCEK ZAMANLI MESAJLAR
function startMessageRealtime() {
  stopMessageRealtime();

  messageChannel = db
    .channel("erensarya-messages-" + currentUser.id)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages"
      },
      payload => {
        const message = payload.new || payload.old;

        if (!message) return;

        if (
          activeChatUser &&
          (
            (message.sender_id === currentUser.id &&
             message.receiver_id === activeChatUser.id) ||
            (message.sender_id === activeChatUser.id &&
             message.receiver_id === currentUser.id)
          )
        ) {
          loadMessages();
        }
      }
    )
    .subscribe(status => {
      if (status === "CHANNEL_ERROR") {
        console.error("Mesajlaşma bağlantısı kurulamadı.");
      }
    });
}

// REALTIME KAPAT
function stopMessageRealtime() {
  if (messageChannel) {
    db.removeChannel(messageChannel);
    messageChannel = null;
  }
}

// OTURUM KAPANINCA
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;

  if (
    currentUser &&
    !messagesPage.classList.contains("hidden")
  ) {
    loadMessages();
  }
});

// OTURUM DEĞİŞİNCE
db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    activeChatUser = null;
    messageContacts = [];
    stopMessageRealtime();

    messagesPage?.classList.add("hidden");
    messageElement("feed")?.classList.remove("hidden");
  }
});
