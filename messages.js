// ========================================
// ERENSARYA - PROFESYONEL MESAJLAŞMA
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

// ========================================
// ARAYÜZÜ HAZIRLA
// ========================================

function setupMessageInterface() {
  if (!messagesPage) return;

  messagesPage.classList.add("er-messages");

  const sidebar = messagesPage.querySelector(".messages-sidebar");
  const panel = messagesPage.querySelector(".chat-panel");

  sidebar?.classList.add("er-contact-panel");
  panel?.classList.add("er-chat-panel");

  setupKeyboardViewport();
}

// ========================================
// KLAVYE VE EKRAN BOYUTU
// ========================================

function setupKeyboardViewport() {
  if (!window.visualViewport) return;

  const updateViewport = () => {
    if (!messagesPage || messagesPage.classList.contains("hidden")) return;

    const height = window.visualViewport.height;
    messagesPage.style.setProperty(
      "--chat-viewport-height",
      `${height}px`
    );
  };

  window.visualViewport.addEventListener("resize", updateViewport);
  window.visualViewport.addEventListener("scroll", updateViewport);
  updateViewport();
}

// ========================================
// MESAJ SAYFASINI AÇ
// ========================================

messageElement("messagesBtn")?.addEventListener("click", openMessages);

messageElement("backMessages")?.addEventListener("click", closeMessages);

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

  resetChatHeader();

  if (messageInput) {
    messageInput.value = "";
    messageInput.disabled = true;
    messageInput.placeholder = "Önce bir sohbet seç...";
  }

  const sendButton = messageElement("sendMessageBtn");
  if (sendButton) sendButton.disabled = true;

  await loadMessageContacts();
  startMessageRealtime();
}

// ========================================
// MESAJ SAYFASINI KAPAT
// ========================================

function closeMessages() {
  messagesPage?.classList.add("hidden");
  messagesPage?.classList.remove("chat-open");

  messageElement("feed")?.classList.remove("hidden");
  messageElement("profilePage")?.classList.add("hidden");

  activeChatUser = null;

  stopMessageRealtime();
}

// ========================================
// BOŞ SOHBET BAŞLIĞI
// ========================================

function resetChatHeader() {
  if (!chatHeader) return;

  chatHeader.innerHTML = `
    <div class="chat-welcome-icon">✉</div>
    <h3>ERENSARYA Mesajlaşma</h3>
    <p>Sohbet etmek için bir kullanıcı seç.</p>
  `;
}

// ========================================
// KİŞİ LİSTESİNE GERİ DÖN
// ========================================

function backToContacts() {
  activeChatUser = null;

  messagesPage?.classList.remove("chat-open");

  if (messageInput) {
    messageInput.value = "";
    messageInput.disabled = true;
    messageInput.placeholder = "Önce bir sohbet seç...";
  }

  const sendButton = messageElement("sendMessageBtn");
  if (sendButton) sendButton.disabled = true;

  resetChatHeader();
  renderMessageContacts(messageContacts);
}

// ========================================
// KULLANICILARI YÜKLE
// ========================================

async function loadMessageContacts() {
  if (!currentUser || !contactList) return;

  contactList.innerHTML =
    '<p class="chat-empty">Kullanıcılar yükleniyor...</p>';

  const { data, error } = await db
    .from("profiles")
    .select("id, username, avatar_url")
    .neq("id", currentUser.id)
    .order("username");

  if (error) {
    contactList.textContent = "Kullanıcılar yüklenemedi: " + error.message;
    return;
  }

  messageContacts = data || [];
  renderMessageContacts(messageContacts);
}

// ========================================
// KİŞİ LİSTESİNİ OLUŞTUR
// ========================================

function renderMessageContacts(users) {
  if (!contactList) return;

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
// KİŞİ ARAMA
// ========================================

messageElement("contactSearch")?.addEventListener("input", event => {
  const search = event.target.value.toLowerCase().trim();

  const filtered = messageContacts.filter(user =>
    (user.username || "").toLowerCase().includes(search)
  );

  renderMessageContacts(filtered);
});

// ========================================
// SOHBET BAŞLIĞINI OLUŞTUR
// ========================================

function createChatHeader(user) {
  if (!chatHeader) return;

  chatHeader.innerHTML = "";

  const back = document.createElement("button");
  back.type = "button";
  back.className = "chat-back-btn";
  back.textContent = "‹";
  back.setAttribute("aria-label", "Kişi listesine dön");
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
  status.textContent = "ERENSARYA özel sohbet";

  info.append(name, status);
  chatHeader.append(back, avatar, info);
}

// ========================================
// SOHBETİ AÇ
// ========================================

async function openConversation(user) {
  if (!user || !currentUser) return;

  activeChatUser = user;
  loadingMessages = false;

  createChatHeader(user);

  // Kişi listesini tamamen gizle.
  messagesPage?.classList.add("chat-open");

  if (messageInput) {
    messageInput.disabled = false;
    messageInput.placeholder = "Mesajını yaz...";
  }

  const sendButton = messageElement("sendMessageBtn");
  if (sendButton) sendButton.disabled = false;

  await loadMessages();

  // Sohbet açılır açılmaz klavyeyi otomatik açma.
  // Kullanıcı yazma alanına dokununca klavye açılır.
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
        <h3>Sohbete hoş geldin</h3>
        <p>İlk mesajını göndererek konuşmayı başlat.</p>
      </div>
    `;
    return;
  }

  data.forEach(message => renderMessage(message));

  scrollMessagesToBottom();

  const unread = data
    .filter(message =>
      message.receiver_id === currentUser.id && !message.is_read
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

// ========================================
// MESAJLARI AŞAĞI KAYDIR
// ========================================

function scrollMessagesToBottom() {
  if (!messageList) return;

  requestAnimationFrame(() => {
    messageList.scrollTop = messageList.scrollHeight;
  });
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

  if (button) button.disabled = true;

  const { error } = await db
    .from("messages")
    .insert({
      sender_id: currentUser.id,
      receiver_id: receiverId,
      content: content.slice(0, 2000)
    });

  if (button) button.disabled = false;

  if (error) {
    showError("Mesaj gönderilemedi: " + error.message);
    return;
  }

  messageInput.value = "";

  await loadMessages();

  // Klavye açıksa açık kalmasına izin ver.
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
// OTURUM KAPANINCA
// ========================================

db.auth.onAuthStateChange(event => {
  if (event === "SIGNED_OUT") {
    activeChatUser = null;
    messageContacts = [];

    stopMessageRealtime();

    messagesPage?.classList.add("hidden");
    messagesPage?.classList.remove("chat-open");

    messageElement("feed")?.classList.remove("hidden");
  }
});

// ========================================
// BAŞLAT
// ========================================

setupMessageInterface();
