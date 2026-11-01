// ========================================
// ERENSARYA - YENİ MESAJLAŞMA SİSTEMİ
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

let contactPanel = null;
let chatPanel = null;

// ========================================
// MOBİL ARAYÜZÜ HAZIRLA
// ========================================

function setupMessageInterface() {
  if (!messagesPage || !contactList || !chatHeader) return;

  messagesPage.classList.add("er-messages");

  contactPanel =
    contactList.closest(".contacts-panel") ||
    contactList.parentElement;

  chatPanel =
    chatHeader.closest(".chat-panel") ||
    chatHeader.parentElement;

  // Üst başlık
  let toolbar = messageElement("messageToolbar");

  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.id = "messageToolbar";
    toolbar.className = "message-toolbar";

    toolbar.innerHTML = `
      <div class="message-toolbar-title">
        <strong>Mesajlar</strong>
        <small>Özel sohbetlerin</small>
      </div>
      <button type="button" id="messageThemeBtn"
        class="message-theme-btn" aria-label="Temayı değiştir">
        ☾
      </button>
    `;

    messagesPage.prepend(toolbar);
  }

  // Sohbete geri dönme düğmesi
  if (!messageElement("chatBackBtn")) {
    const back = document.createElement("button");
    back.id = "chatBackBtn";
    back.type = "button";
    back.className = "chat-back-btn";
    back.textContent = "‹";
    back.setAttribute("aria-label", "Sohbet listesine dön");

    chatHeader.prepend(back);

    back.addEventListener("click", backToContacts);
  }

  // Tema
  applyMessageTheme();

  messageElement("messageThemeBtn")?.addEventListener(
    "click",
    toggleMessageTheme
  );
}

// ========================================
// TEMA SİSTEMİ
// ========================================

function applyMessageTheme() {
  if (!messagesPage) return;

  const theme = localStorage.getItem("erensarya-message-theme") || "light";

  messagesPage.classList.toggle("theme-dark", theme === "dark");

  const button = messageElement("messageThemeBtn");

  if (button) {
    button.textContent = theme === "dark" ? "☀" : "☾";
    button.title = theme === "dark" ? "Beyaz tema" : "Siyah tema";
  }
}

function toggleMessageTheme() {
  const current =
    localStorage.getItem("erensarya-message-theme") || "light";

  localStorage.setItem(
    "erensarya-message-theme",
    current === "light" ? "dark" : "light"
  );

  applyMessageTheme();
}

// ========================================
// SAYFAYI AÇ
// ========================================

messageElement("messagesBtn")?.addEventListener("click", openMessages);

messageElement("backMessages")?.addEventListener("click", () => {
  closeMessages();
});

async function openMessages() {
  if (!currentUser) {
    showAuth("login");
    return;
  }

  setupMessageInterface();

  messageElement("feed")?.classList.add("hidden");
  messageElement("profilePage")?.classList.add("hidden");

  messagesPage?.classList.remove("hidden");
  messagesPage?.classList.remove("chat-open");

  activeChatUser = null;

  if (messageInput) {
    messageInput.disabled = true;
    messageInput.placeholder = "Önce bir sohbet seç...";
  }

  messageElement("sendMessageBtn").disabled = true;

  applyMessageTheme();

  await loadMessageContacts();
  startMessageRealtime();
}

function closeMessages() {
  messagesPage?.classList.add("hidden");
  messageElement("feed")?.classList.remove("hidden");

  stopMessageRealtime();
  activeChatUser = null;
}

function backToContacts() {
  activeChatUser = null;

  messagesPage?.classList.remove("chat-open");

  if (messageInput) {
    messageInput.value = "";
    messageInput.disabled = true;
    messageInput.placeholder = "Önce bir sohbet seç...";
  }

  messageElement("sendMessageBtn").disabled = true;

  renderMessageContacts(messageContacts);
}

// ========================================
// KULLANICILARI YÜKLE
// ========================================

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

// ========================================
// KULLANICI LİSTESİ
// ========================================

function renderMessageContacts(users) {
  contactList.innerHTML = "";

  if (!users.length) {
    contactList.innerHTML =
      '<p class="chat-empty">Henüz başka kullanıcı bulunamadı.</p>';
    return;
  }

  users.forEach(user => {
    const button = document.createElement("button");
    button.type = "button";
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

// ========================================
// KULLANICI ARAMA
// ========================================

messageElement("contactSearch")?.addEventListener("input", event => {
  const search = event.target.value.toLowerCase().trim();

  const filtered = messageContacts.filter(user =>
    (user.username || "").toLowerCase().includes(search)
  );

  renderMessageContacts(filtered);
});

// ========================================
// SOHBET AÇ
// ========================================

async function openConversation(user) {
  if (!user || !currentUser) return;

  activeChatUser = user;

  renderMessageContacts(messageContacts);

  chatHeader.innerHTML = "";

  const back = document.createElement("button");
  back.id = "chatBackBtn";
  back.type = "button";
  back.className = "chat-back-btn";
  back.textContent = "‹";
  back.setAttribute("aria-label", "Geri dön");
  back.addEventListener("click", backToContacts);

  const avatar = document.createElement("div");
  avatar.className = "chat-header-avatar";

  if (user.avatar_url) {
    const image = document.createElement("img");
    image.src = user.avatar_url;
    image.alt = "";
    avatar.append(image);
  } else {
    avatar.textContent =
      (user.username || "?").charAt(0).toUpperCase();
  }

  const info = document.createElement("div");
  info.className = "chat-header-info";

  const name = document.createElement("strong");
  name.textContent = "@" + user.username;

  const status = document.createElement("small");
  status.textContent = "Özel sohbet";

  info.append(name, status);
  chatHeader.append(back, avatar, info);

  messagesPage.classList.add("chat-open");

  messageInput.disabled = false;
  messageInput.placeholder = "Mesajını yaz...";

  messageElement("sendMessageBtn").disabled = false;

  await loadMessages();

  messageInput.focus();
}

// ========================================
// MESAJLARI YÜKLE
// ========================================

async function loadMessages() {
  if (!activeChatUser || !currentUser || loadingMessages) return;

  const chatUserId = activeChatUser.id;

  loadingMessages = true;

  messageList.innerHTML =
    '<p class="chat-empty">Mesajlar yükleniyor...</p>';

  const { data, error } = await db
    .from("messages")
    .select("id,sender_id,receiver_id,content,created_at,is_read")
    .or(
      `and(sender_id.eq.${currentUser.id},receiver_id.eq.${chatUserId}),and(sender_id.eq.${chatUserId},receiver_id.eq.${currentUser.id})`
    )
    .order("created_at", { ascending: true });

  loadingMessages = false;

  if (activeChatUser?.id !== chatUserId) return;

  if (error) {
    messageList.textContent =
      "Mesajlar yüklenemedi: " + error.message;
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

  data.forEach(message => renderMessage(message));

  scrollMessagesToBottom();

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

// ========================================
// MESAJ BALONU
// ========================================

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
  if (messageList) {
    messageList.scrollTop = messageList.scrollHeight;
  }
}

// ========================================
// MESAJ GÖNDER
// ========================================

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

  const receiverId = activeChatUser.id;
  const button = messageElement("sendMessageBtn");

  button.disabled = true;

  const { error } = await db
    .from("messages")
    .insert({
      sender_id: currentUser.id,
      receiver_id: receiverId,
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

// ========================================
// GERÇEK ZAMANLI MESAJLAR
// ========================================

function startMessageRealtime() {
  if (!currentUser) return;

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

        if (!message || !activeChatUser) return;

        const belongsToChat =
          (
            message.sender_id === currentUser.id &&
            message.receiver_id === activeChatUser.id
          ) ||
          (
            message.sender_id === activeChatUser.id &&
            message.receiver_id === currentUser.id
          );

        if (belongsToChat) {
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

// ========================================
// REALTIME KAPAT
// ========================================

function stopMessageRealtime() {
  if (messageChannel) {
    db.removeChannel(messageChannel);
    messageChannel = null;
  }
}

// ========================================
// SAYFA TEKRAR GÖRÜNÜR OLUNCA
// ========================================

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;

  if (
    currentUser &&
    messagesPage &&
    !messagesPage.classList.contains("hidden") &&
    activeChatUser
  ) {
    loadMessages();
  }
});

// ========================================
// OTURUM DEĞİŞİNCE
// ========================================

db.auth.onAuthStateChange(event => {
  if (event === "SIGNED_OUT") {
    activeChatUser = null;
    messageContacts = [];

    stopMessageRealtime();

    messagesPage?.classList.add("hidden");
    messageElement("feed")?.classList.remove("hidden");
  }
});

// ========================================
// BAŞLAT
// ========================================

setupMessageInterface();
