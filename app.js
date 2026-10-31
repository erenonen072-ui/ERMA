
const input = document.getElementById("videoInput");
const feed = document.getElementById("feed");

let videos = [];

input.addEventListener("change", function () {
  const files = Array.from(this.files || []);

  files.forEach(file => {
    if (!file.type.startsWith("video/")) return;

    const url = URL.createObjectURL(file);

    const video = {
      url,
      name: file.name,
      likes: 0
    };

    videos.unshift(video);
  });

  renderVideos();
  this.value = "";
});

function renderVideos() {
  feed.innerHTML = "";

  if (videos.length === 0) {
    feed.innerHTML = `
      <div class="empty">
        <div class="empty-icon">▶</div>
        <h2>Henüz video yok</h2>
        <p>İlk videonu paylaş!</p>
      </div>
    `;
    return;
  }

  videos.forEach((video, index) => {
    const card = document.createElement("article");
    card.className = "video-card";

    const player = document.createElement("video");
    player.src = video.url;
    player.controls = true;
    player.playsInline = true;
    player.preload = "metadata";

    const info = document.createElement("div");
    info.className = "video-info";
    info.textContent = "@erensarya · " + video.name;

    const actions = document.createElement("div");
    actions.className = "video-actions";

    const like = document.createElement("button");
    like.textContent = "♡ " + video.likes;

    like.onclick = () => {
      video.likes++;
      like.textContent = "♥ " + video.likes;
    };

    const comment = document.createElement("button");
    comment.textContent = "💬 Yorum";
    comment.onclick = () => {
      const message = prompt("Yorumunu yaz:");
      if (message) alert("Yorum: " + message);
    };

    const share = document.createElement("button");
    share.textContent = "↗ Paylaş";

    share.onclick = async () => {
      if (navigator.share) {
        await navigator.share({
          title: "ERENSARYA",
          text: "Bu videoya göz at!"
        });
      } else {
        alert("Paylaşım bu tarayıcıda desteklenmiyor.");
      }
    };

    actions.append(like, comment, share);
    card.append(player, info, actions);
    feed.append(card);
  });
}

function setTab(tab, element) {
  document.querySelectorAll(".tabs button")
    .forEach(button => button.classList.remove("active"));

  if (element) element.classList.add("active");

  if (tab === "Takip") {
    alert("Takip akışı için kullanıcı sistemi gerekiyor.");
  } else if (tab === "Keşfet") {
    alert("Keşfet sayfası sonraki aşamada bağlanacak.");
  } else {
    renderVideos();
  }
}

function showProfile() {
  alert("Profil sistemi sonraki aşamada bağlanacak.");
}
