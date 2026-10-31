
// ===================================
// ERENSARYA - SUPABASE CONNECTION
// ===================================

const SUPABASE_URL = "https://zhxysowjrvzflrduqbaj.supabase.co";
const SUPABASE_KEY = "sb_publishable_-vUDT5LRwj89sLihzu7MyQ_jpGzbDQM";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let currentUser = null;
let currentProfile = null;
let currentTab = "forYou";
let activeCommentVideo = null;

// ===================================
// HELPERS
// ===================================

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function getElement(id) {
  return document.getElementById(id);
}

function showError(message) {
  alert(message || "Bir hata oluştu.");
}

// ===================================
// ERNSARYA - USERNAME AUTH SYSTEM
// ===================================

function makeLoginEmail(username) {
  return username.trim().toLowerCase() + "@erensarya.invalid";
}

async function init() {
  if (!window.supabase) {
    console.error("Supabase yüklenmedi.");
    return;
  }

  const { data, error } = await db.auth.getSession();

  if (error) {
    console.error(error);
    return;
  }

  currentUser = data.session?.user || null;

  if (currentUser) await loadMyProfile();

  updateAuthBar();
  await loadFeed("forYou");
}

async function loadMyProfile() {
  if (!currentUser) return;

  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  currentProfile = data;
}

function updateAuthBar() {
  const bar = getElement("authBar");
  if (!bar) return;

  if (currentUser) {
    bar.innerHTML = `
      <span>Merhaba, @${escapeHTML(
        currentProfile?.username || "Kullanıcı"
      )}</span>
      <button onclick="logout()">Çıkış Yap</button>
    `;
  } else {
    bar.innerHTML = `
      <button onclick="showAuth('login')">Giriş Yap</button>
      <button class="dark-btn" onclick="showAuth('signup')">
        Kayıt Ol
      </button>
    `;
  }
}

function showAuth(type) {
  const modal = getElement("authModal");
  if (!modal) return;

  modal.classList.remove("hidden");

  const signup = type === "signup";

  getElement("authTitle").textContent =
    signup ? "ERENSARYA'ya Katıl" : "Tekrar Hoş Geldin";

  getElement("authSubmit").textContent =
    signup ? "Hesap Oluştur" : "Giriş Yap";

  getElement("authForm").dataset.type = type;
  getElement("authMessage").textContent = "";
}

function closeModal() {
  getElement("authModal")?.classList.add("hidden");
}

getElement("authForm")?.addEventListener("submit", async function(e) {
  e.preventDefault();

  const type = this.dataset.type;
  const username = getElement("username").value.trim().toLowerCase();
  const password = getElement("password").value;
  const message = getElement("authMessage");
  const submit = getElement("authSubmit");

  submit.disabled = true;
  message.textContent = "İşlem yapılıyor...";

  try {
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      throw new Error("Kullanıcı adı 3-30 karakter olmalı. Harf, rakam ve _ kullanabilirsin.");
    }

    if (password.length < 6) {
      throw new Error("Şifre en az 6 karakter olmalı.");
    }

    const email = makeLoginEmail(username);

    if (type === "signup") {
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: {
          data: { username }
        }
      });

      if (error) throw error;

      if (data.session) {
        currentUser = data.user;
        await loadMyProfile();
        closeModal();
        updateAuthBar();
        await loadFeed("forYou");
      } else {
        message.textContent =
          "Kayıt oluşturuldu. Giriş yapabilmek için Supabase e-posta doğrulama ayarını kontrol et.";
      }
    } else {
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      currentUser = data.user;
      await loadMyProfile();
      closeModal();
      updateAuthBar();
      await loadFeed("forYou");
    }
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

async function logout() {
  const { error } = await db.auth.signOut();

  if (error) return showError(error.message);

  currentUser = null;
  currentProfile = null;

  updateAuthBar();
  await loadFeed("forYou");
}

db.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user || null;

  if (event === "SIGNED_OUT") {
    currentProfile = null;
    updateAuthBar();
  }
});
// ===================================
// VIDEO CARD
// ===================================

async function renderVideo(video, feed) {
  const card = document.createElement("article");
  card.className = "video-card";

  const profile = video.profiles || {};
  const username = profile.username || "Kullanıcı";

  const player = document.createElement("video");
  player.className = "video-player";
  player.src = video.video_url;
  player.controls = true;
  player.playsInline = true;
  player.preload = "metadata";

  const info = document.createElement("div");
  info.className = "video-info";

  const userRow = document.createElement("div");
  userRow.className = "video-user";

  const userName = document.createElement("strong");
  userName.textContent = "@" + username;
  userName.onclick = () => showProfile(video.user_id);

  userRow.append(userName);

  if (currentUser && video.user_id !== currentUser.id) {
    const followBtn = document.createElement("button");
    followBtn.className = "follow-btn";
    followBtn.textContent = "Takip Et";

    const { data: existing } = await db
      .from("follows")
      .select("id")
      .eq("follower_id", currentUser.id)
      .eq("following_id", video.user_id)
      .maybeSingle();

    if (existing) {
      followBtn.textContent = "Takip Ediliyor";
      followBtn.classList.add("following");
    }

    followBtn.onclick = () =>
      toggleFollow(video.user_id, followBtn);

    userRow.append(followBtn);
  }

  const description = document.createElement("p");
  description.className = "video-description";
  description.textContent = video.description || "";

  info.append(userRow, description);

  const actions = document.createElement("div");
  actions.className = "video-actions";

  // LIKE

  const likeBtn = document.createElement("button");

  const { count: likeCount } = await db
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("video_id", video.id);

  let liked = false;

  if (currentUser) {
    const { data: existingLike } = await db
      .from("likes")
      .select("id")
      .eq("video_id", video.id)
      .eq("user_id", currentUser.id)
      .maybeSingle();

    liked = !!existingLike;
  }

  let count = likeCount || 0;

  likeBtn.textContent = `${liked ? "♥" : "♡"} ${count}`;

  likeBtn.onclick = async () => {
    if (!currentUser) {
      showAuth("login");
      return;
    }

    const { error } = liked
      ? await db.from("likes").delete()
          .eq("video_id", video.id)
          .eq("user_id", currentUser.id)
      : await db.from("likes").insert({
          video_id: video.id,
          user_id: currentUser.id
        });

    if (error) return showError(error.message);

    liked = !liked;
    count += liked ? 1 : -1;

    likeBtn.textContent = `${liked ? "♥" : "♡"} ${count}`;
  };

  // COMMENTS

  const commentBtn = document.createElement("button");
  commentBtn.textContent = "💬 Yorum";
  commentBtn.onclick = () => openComments(video.id);

  // SHARE

  const shareBtn = document.createElement("button");
  shareBtn.textContent = "↗ Paylaş";

  shareBtn.onclick = async () => {
    const shareData = {
      title: "ERENSARYA",
      text: video.description || "Bu videoyu izle!",
      url: location.origin + location.pathname + "?video=" + video.id
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        alert("Video bağlantısı kopyalandı.");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        showError("Paylaşım başarısız.");
      }
    }
  };

  actions.append(likeBtn, commentBtn, shareBtn);
  card.append(player, info, actions);
  feed.append(card);
}

// ===================================
// AUTOPLAY
// ===================================

function setupAutoplay() {
  const videos = document.querySelectorAll(".video-player");

  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target;

      if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, { threshold: [0, 0.7] });

  videos.forEach(video => observer.observe(video));
}

// ===================================
// VIDEO UPLOAD
// ===================================

async function uploadVideo() {
  if (!currentUser) {
    showAuth("login");
    return;
  }

  getElement("videoInput")?.click();
}

getElement("videoInput")?.addEventListener("change", async function() {
  const file = this.files[0];
  if (!file) return;

  if (!currentUser) {
    showAuth("login");
    this.value = "";
    return;
  }

  if (!file.type.startsWith("video/")) {
    showError("Lütfen video seç.");
    this.value = "";
    return;
  }

  if (file.size > 100 * 1024 * 1024) {
    showError("Video en fazla 100 MB olabilir.");
    this.value = "";
    return;
  }

  const extension = file.name.split(".").pop().toLowerCase();
  const allowed = ["mp4", "webm", "mov"];

  if (!allowed.includes(extension)) {
    showError("Desteklenmeyen video formatı.");
    this.value = "";
    return;
  }

  const description = prompt("Videon için açıklama yaz:") || "";

  const path =
    `${currentUser.id}/${crypto.randomUUID()}.${extension}`;

  try {
    const { error: uploadError } = await db.storage
      .from("videos")
      .upload(path, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = db.storage
      .from("videos")
      .getPublicUrl(path);

    const { error: insertError } = await db
      .from("videos")
      .insert({
        user_id: currentUser.id,
        video_url: publicData.publicUrl,
        description: description.slice(0, 500)
      });

    if (insertError) {
      await db.storage.from("videos").remove([path]);
      throw insertError;
    }

    alert("Videon başarıyla paylaşıldı!");
    await loadFeed("forYou");
  } catch (error) {
    showError("Video yüklenemedi: " + error.message);
  } finally {
    this.value = "";
  }
});

// ===================================
// FOLLOW SYSTEM
// ===================================

async function toggleFollow(userId, button) {
  if (!currentUser) {
    showAuth("login");
    return;
  }

  if (userId === currentUser.id) return;

  const { data: existing, error } = await db
    .from("follows")
    .select("id")
    .eq("follower_id", currentUser.id)
    .eq("following_id", userId)
    .maybeSingle();

  if (error) return showError(error.message);

  if (existing) {
    const { error: removeError } = await db
      .from("follows")
      .delete()
      .eq("id", existing.id);

    if (removeError) return showError(removeError.message);

    button.textContent = "Takip Et";
    button.classList.remove("following");
  } else {
    const { error: addError } = await db
      .from("follows")
      .insert({
        follower_id: currentUser.id,
        following_id: userId
      });

    if (addError) return showError(addError.message);

    button.textContent = "Takip Ediliyor";
    button.classList.add("following");
  }
}

// ===================================
// COMMENTS
// ===================================

async function openComments(videoId) {
  activeCommentVideo = videoId;

  getElement("commentModal")?.classList.remove("hidden");

  await loadComments();
}

async function loadComments() {
  const list = getElement("commentList");
  if (!list) return;

  list.textContent = "Yorumlar yükleniyor...";

  const { data, error } = await db
    .from("comments")
    .select(`
      *,
      profiles!comments_user_id_fkey(username)
    `)
    .eq("video_id", activeCommentVideo)
    .order("created_at", { ascending: false });

  if (error) {
    list.textContent = error.message;
    return;
  }

  list.innerHTML = "";

  if (!data.length) {
    list.textContent = "Henüz yorum yok.";
    return;
  }

  data.forEach(comment => {
    const item = document.createElement("div");
    item.className = "comment-item";

    const name = document.createElement("strong");
    name.textContent =
      "@" + (comment.profiles?.username || "Kullanıcı");

    const content = document.createElement("p");
    content.textContent = comment.content;

    item.append(name, content);
    list.append(item);
  });
}

getElement("commentForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!currentUser) {
    showAuth("login");
    return;
  }

  const input = getElement("commentInput");
  const content = input.value.trim();

  if (!content || !activeCommentVideo) return;

  const { error } = await db.from("comments").insert({
    video_id: activeCommentVideo,
    user_id: currentUser.id,
    content: content.slice(0, 500)
  });

  if (error) {
    showError(error.message);
    return;
  }

  input.value = "";
  await loadComments();
});

function closeComments() {
  getElement("commentModal")?.classList.add("hidden");
  activeCommentVideo = null;
}

// ===================================
// PROFILE
// ===================================

async function showMyProfile() {
  if (!currentUser) {
    showAuth("login");
    return;
  }

  await showProfile(currentUser.id);
}

async function showProfile(userId) {
  const page = getElement("profilePage");
  const feed = getElement("feed");

  if (!page || !feed) return;

  feed.classList.add("hidden");
  page.classList.remove("hidden");
  page.textContent = "Profil yükleniyor...";

  const { data: profile, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    page.textContent = "Profil bulunamadı.";
    return;
  }

  const [
    { count: followers },
    { count: following },
    { data: userVideos }
  ] = await Promise.all([
    db.from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", userId),

    db.from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userId),

    db.from("videos")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
  ]);

  page.innerHTML = `
    <div class="profile-avatar">👤</div>
    <h2>@${escapeHTML(profile.username)}</h2>
    <p>${escapeHTML(profile.bio || "")}</p>

    <div class="profile-stats">
      <span><b>${userVideos?.length || 0}</b><br>Video</span>
      <span><b>${followers || 0}</b><br>Takipçi</span>
      <span><b>${following || 0}</b><br>Takip</span>
    </div>

    <div id="profileVideos"></div>
  `;

  if (currentUser && currentUser.id === userId) {
    const edit = document.createElement("button");
    edit.className = "dark-btn";
    edit.textContent = "Biyografiyi Düzenle";

    edit.onclick = async () => {
      const bio = prompt("Yeni biyografin:", profile.bio || "");
      if (bio === null) return;

      const { error } = await db
        .from("profiles")
        .update({ bio: bio.slice(0, 160) })
        .eq("id", currentUser.id);

      if (error) return showError(error.message);

      await showProfile(userId);
    };

    page.insertBefore(edit, page.querySelector("#profileVideos"));
  } else if (currentUser) {
    const follow = document.createElement("button");
    follow.className = "follow-btn";
    follow.textContent = "Takip Et";

    const { data: existing } = await db
      .from("follows")
      .select("id")
      .eq("follower_id", currentUser.id)
      .eq("following_id", userId)
      .maybeSingle();

    if (existing) {
      follow.textContent = "Takip Ediliyor";
      follow.classList.add("following");
    }

    follow.onclick = () => toggleFollow(userId, follow);

    page.insertBefore(follow, page.querySelector("#profileVideos"));
  }

  const videoArea = page.querySelector("#profileVideos");

  if (!userVideos?.length) {
    videoArea.textContent = "Henüz video paylaşılmamış.";
    return;
  }

  userVideos.forEach(video => {
    const player = document.createElement("video");
    player.src = video.video_url;
    player.controls = true;
    player.playsInline = true;
    player.className = "video-player";
    videoArea.append(player);
  });
}

// ===================================
// SEARCH
// ===================================

if (getElement("searchBtn")) {
  getElement("searchBtn").onclick = async () => {
    const username = prompt("Kullanıcı adı ara:");

    if (!username?.trim()) return;

    const { data, error } = await db
      .from("profiles")
      .select("id,username")
      .ilike("username", username.trim())
      .limit(1);

    if (error) return showError(error.message);

    if (!data?.length) {
      alert("Kullanıcı bulunamadı.");
      return;
    }

    await showProfile(data[0].id);
  };
}

// ===================================
// START
// ===================================

init();
