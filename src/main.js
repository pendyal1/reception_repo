import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const eventStart = new Date("2026-09-06T18:30:00-04:00");
const placeholderProjectId = "YOUR_PROJECT_ID";
const coupleAdminEmails = new Set(["ap4839@columbia.edu", "pallaviputcha@gmail.com"]);
const weatherEndpoint =
  "https://api.open-meteo.com/v1/forecast?latitude=35.994&longitude=-78.899&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit&timezone=America%2FNew_York";

const elements = {
  adminLinks: document.querySelectorAll(".admin-link"),
  adminSection: document.querySelector("#admin"),
  authButton: document.querySelector("#authButton"),
  authAvatar: document.querySelector("#authAvatar"),
  authButtonText: document.querySelector("#authButtonText"),
  daysLeft: document.querySelector("#daysLeft"),
  hoursLeft: document.querySelector("#hoursLeft"),
  minutesLeft: document.querySelector("#minutesLeft"),
  secondsLeft: document.querySelector("#secondsLeft"),
  guestName: document.querySelector("#guestName"),
  guestEmail: document.querySelector("#guestEmail"),
  rsvpForm: document.querySelector("#rsvpForm"),
  rsvpStatus: document.querySelector("#rsvpStatus"),
  photoInput: document.querySelector("#photoInput"),
  fileSummary: document.querySelector("#fileSummary"),
  appleSearch: document.querySelector("#appleSearch"),
  appleSearchButton: document.querySelector("#appleSearchButton"),
  appleResults: document.querySelector("#appleResults"),
  songNote: document.querySelector("#songNote"),
  playlistStatus: document.querySelector("#playlistStatus"),
  sharedPlaylist: document.querySelector("#sharedPlaylist"),
  downloadApplePlaylist: document.querySelector("#downloadApplePlaylist"),
  weatherArt: document.querySelector("#weatherArt"),
  weatherCondition: document.querySelector("#weatherCondition"),
  weatherTemp: document.querySelector("#weatherTemp"),
  weatherUpdated: document.querySelector("#weatherUpdated"),
  heroSection: document.querySelector("#invite"),
  detailsSection: document.querySelector("#details"),
  rsvpSection: document.querySelector("#rsvp"),
  uploadButton: document.querySelector("#uploadButton"),
  uploadProgress: document.querySelector("#uploadProgress"),
  uploadStatus: document.querySelector("#uploadStatus"),
  refreshRsvps: document.querySelector("#refreshRsvps"),
  refreshUploads: document.querySelector("#refreshUploads"),
  rsvpRows: document.querySelector("#rsvpRows"),
  uploadGallery: document.querySelector("#uploadGallery"),
};

const appState = {
  user: null,
  isAdmin: false,
  auth: null,
  db: null,
  storage: null,
  playlistSongs: [],
};

function updateCountdown() {
  const delta = Math.max(eventStart.getTime() - Date.now(), 0);
  const totalSeconds = Math.floor(delta / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;

  elements.daysLeft.textContent = String(days);
  elements.hoursLeft.textContent = String(hours).padStart(2, "0");
  elements.minutesLeft.textContent = String(minutes).padStart(2, "0");
  elements.secondsLeft.textContent = String(seconds).padStart(2, "0");
}

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? "#ffcabd" : "";
}

function setSignedInUi(user) {
  document.body.classList.toggle("is-signed-in", Boolean(user));
  elements.authButtonText.textContent = user ? "Sign out" : "Sign in";
  elements.authAvatar.hidden = !user?.photoURL;
  elements.authAvatar.src = user?.photoURL || "";
  elements.guestName.value = user?.displayName || elements.guestName.value || "";
  elements.guestEmail.value = user?.email || elements.guestEmail.value || "";
}

function isConfigured() {
  return firebaseConfig.projectId && firebaseConfig.projectId !== placeholderProjectId;
}

function requireUser(statusElement) {
  if (!appState.user) {
    setStatus(statusElement, "Please sign in with Google first.", true);
    return false;
  }
  return true;
}

function safeText(value) {
  return value == null || value === "" ? "-" : String(value);
}

function hasAdminEmail(user) {
  return coupleAdminEmails.has((user?.email || "").toLowerCase());
}

function setAdminUi(isAdmin) {
  elements.adminLinks.forEach((link) => {
    link.hidden = !isAdmin;
  });
  elements.adminSection.hidden = !isAdmin;
}

function appendCell(row, ...values) {
  const cell = document.createElement("td");
  values.forEach((value, index) => {
    if (index > 0) cell.append(document.createElement("br"));
    const node = index > 0 ? document.createElement("small") : document.createElement("span");
    node.textContent = safeText(value);
    cell.append(node);
  });
  row.append(cell);
}

function getSelectedAttendance(form) {
  return new FormData(form).get("attendance");
}

function downloadTextFile(filename, lines) {
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function setPlaylistButtons() {
  const hasSongs = appState.playlistSongs.length > 0;
  elements.downloadApplePlaylist.disabled = !hasSongs;
}

function getLargerArtworkUrl(url) {
  return url ? url.replace("100x100bb", "300x300bb") : "";
}

function getAppleMusicUrl(song) {
  return song.appleMusicUrl || "";
}

function getSongExportLine(song) {
  const title = song.title || "Untitled song";
  const artist = song.artistName || "";
  const appleUrl = getAppleMusicUrl(song);
  const label = artist ? `${artist} - ${title}` : title;
  return appleUrl ? `${label} | ${appleUrl}` : label;
}

function renderAppleResults(results) {
  elements.appleResults.innerHTML = "";

  if (!results.length) {
    const empty = document.createElement("p");
    empty.className = "empty-playlist";
    empty.textContent = "No Apple Music results found. Try a different song or artist.";
    elements.appleResults.append(empty);
    return;
  }

  results.forEach((result) => {
    const item = document.createElement("article");
    const art = document.createElement("div");
    const details = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    const album = document.createElement("small");
    const addButton = document.createElement("button");

    item.className = "apple-result";
    art.className = "playlist-art";
    details.className = "playlist-song-details";
    addButton.className = "button secondary";
    addButton.type = "button";
    addButton.textContent = "Add song";

    if (result.artworkUrl100) {
      const image = document.createElement("img");
      image.src = getLargerArtworkUrl(result.artworkUrl100);
      image.alt = "";
      image.loading = "lazy";
      art.append(image);
    } else {
      art.textContent = "♪";
    }

    title.textContent = result.trackName || "Apple Music song";
    meta.textContent = result.artistName || "Unknown artist";
    album.textContent = result.collectionName || "";
    addButton.addEventListener("click", () => {
      addAppleSong(result).catch((error) => setStatus(elements.playlistStatus, error.message, true));
    });

    details.append(title, meta, album);
    item.append(art, details, addButton);
    elements.appleResults.append(item);
  });
}

function renderPlaylist() {
  elements.sharedPlaylist.innerHTML = "";
  setPlaylistButtons();

  if (!appState.playlistSongs.length) {
    const empty = document.createElement("p");
    empty.className = "empty-playlist";
    empty.textContent = "No songs yet. Add the first one.";
    elements.sharedPlaylist.append(empty);
    return;
  }

  appState.playlistSongs.forEach((song) => {
    const item = document.createElement("article");
    const art = document.createElement("div");
    const details = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    const note = document.createElement("small");
    const links = document.createElement("div");
    const apple = document.createElement("a");

    item.className = "playlist-song";
    art.className = "playlist-art";
    details.className = "playlist-song-details";
    links.className = "playlist-song-links";

    if (song.thumbnailUrl) {
      const image = document.createElement("img");
      image.src = song.thumbnailUrl;
      image.alt = "";
      image.loading = "lazy";
      art.append(image);
    } else {
      art.textContent = "♪";
    }

    title.textContent = song.title || "Apple Music song";
    meta.textContent = [song.artistName, song.collectionName].filter(Boolean).join(" - ");
    note.textContent = song.note || "";

    apple.href = getAppleMusicUrl(song) || `https://music.apple.com/search?term=${encodeURIComponent(song.title || "song")}`;
    apple.target = "_blank";
    apple.rel = "noreferrer";
    apple.textContent = "Apple Music";

    if (song.previewUrl) {
      const preview = document.createElement("a");
      preview.href = song.previewUrl;
      preview.target = "_blank";
      preview.rel = "noreferrer";
      preview.textContent = "Preview";
      links.append(apple, preview);
    } else {
      links.append(apple);
    }
    details.append(title, meta, note, links);
    item.append(art, details);
    elements.sharedPlaylist.append(item);
  });
}

async function loadPlaylist() {
  if (!appState.db) return;
  const snapshot = await getDocs(
    query(collection(appState.db, "playlistSongs"), orderBy("createdAt", "desc"), limit(50))
  );
  appState.playlistSongs = snapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...docSnapshot.data(),
  }));
  renderPlaylist();
}

async function addAppleSong(result) {
  if (!requireUser(elements.playlistStatus)) return;

  if (!result.trackViewUrl || !result.trackName) {
    setStatus(elements.playlistStatus, "Choose a valid Apple Music song.", true);
    return;
  }

  setStatus(elements.playlistStatus, "Adding song...");
  const payload = {
    appleMusicUrl: result.trackViewUrl,
    title: result.trackName,
    artistName: result.artistName || "",
    collectionName: result.collectionName || "",
    thumbnailUrl: getLargerArtworkUrl(result.artworkUrl100),
    previewUrl: result.previewUrl || "",
    note: elements.songNote.value.trim(),
    createdAt: serverTimestamp(),
  };

  await addDoc(collection(appState.db, "playlistSongs"), payload);
  elements.songNote.value = "";
  setStatus(elements.playlistStatus, "Song added to the Apple Music playlist.");
  await loadPlaylist();
}

async function searchAppleMusic() {
  const queryText = elements.appleSearch.value.trim();
  if (!queryText) {
    setStatus(elements.playlistStatus, "Enter a song or artist to search Apple Music.", true);
    return;
  }

  setStatus(elements.playlistStatus, "Searching Apple Music...");
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(queryText)}&media=music&entity=song&limit=8`
  );
  if (!response.ok) throw new Error("Apple Music search is unavailable right now.");
  const data = await response.json();
  renderAppleResults(data.results || []);
  setStatus(elements.playlistStatus, data.results?.length ? "Choose a song to add." : "");
}

function handlePlaylistDownload() {
  const lines = appState.playlistSongs.map(getSongExportLine).filter(Boolean);

  if (!lines.length) {
    setStatus(elements.playlistStatus, "No Apple Music songs yet.", true);
    return;
  }

  downloadTextFile("pallavi-aditya-apple-music-playlist.txt", lines);
  setStatus(elements.playlistStatus, "Apple Music list downloaded. Use Create in Apple Music to import it.");
}

function updateFlowerVisibility() {
  const viewportCenter = window.innerHeight / 2;
  const heroBox = elements.heroSection.getBoundingClientRect();
  const detailsBox = elements.detailsSection.getBoundingClientRect();
  const rsvpBox = elements.rsvpSection.getBoundingClientRect();
  const onHero = heroBox.top <= viewportCenter && heroBox.bottom >= viewportCenter;
  const onDetails = detailsBox.top <= viewportCenter && detailsBox.bottom >= viewportCenter;
  const onRsvp = rsvpBox.top <= viewportCenter && rsvpBox.bottom >= viewportCenter;
  const pastHero = heroBox.bottom <= viewportCenter;

  document.body.classList.toggle("show-flowers", (onHero || onRsvp) && !onDetails);
  document.body.classList.toggle("show-nav-title", pastHero);
}

function getWeatherPresentation(code, isDay) {
  if (code === 0) return { label: "Clear sky", art: isDay ? "is-sunny" : "is-night" };
  if ([1, 2].includes(code)) return { label: "Mostly clear", art: "is-partly-cloudy" };
  if (code === 3) return { label: "Cloudy", art: "is-cloudy" };
  if ([45, 48].includes(code)) return { label: "Foggy", art: "is-cloudy" };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { label: "Rain nearby", art: "is-rainy" };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "Snow nearby", art: "is-cloudy" };
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorms nearby", art: "is-stormy" };
  return { label: "Weather updating", art: "is-partly-cloudy" };
}

async function loadWeather() {
  try {
    const response = await fetch(weatherEndpoint);
    if (!response.ok) throw new Error("Weather request failed");

    const data = await response.json();
    const current = data.current;
    const unit = data.current_units?.temperature_2m || "°F";
    const temperature = Math.round(current.temperature_2m);
    const weather = getWeatherPresentation(current.weather_code, current.is_day === 1);
    const updated = new Date(current.time).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    elements.weatherTemp.textContent = `${temperature}${unit}`;
    elements.weatherCondition.textContent = `${weather.label} near The Glasshouse Kitchen in Durham.`;
    elements.weatherUpdated.innerHTML =
      `Updated ${updated}. Data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>.`;
    elements.weatherArt.className = `weather-art ${weather.art}`;
  } catch (error) {
    elements.weatherTemp.textContent = "Weather unavailable";
    elements.weatherCondition.textContent =
      "Live weather could not load. Expect a warm September evening in Durham.";
    elements.weatherUpdated.innerHTML =
      `Seasonal estimate from RDU climate normals. Live data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>.`;
    elements.weatherArt.className = "weather-art is-partly-cloudy";
  }
}

async function loadMyRsvp(user) {
  const snapshot = await getDoc(doc(appState.db, "rsvps", user.uid));
  if (!snapshot.exists()) return;

  const data = snapshot.data();
  elements.guestName.value = data.guestName || user.displayName || "";
  elements.guestEmail.value = data.guestEmail || user.email || "";
  document.querySelector("#dietary").value = data.dietary || "";
  document.querySelector("#message").value = data.message || "";

  const radio = document.querySelector(`input[name="attendance"][value="${data.attendance}"]`);
  if (radio) radio.checked = true;
  setStatus(elements.rsvpStatus, "Your saved RSVP is loaded.");
}

async function checkAdmin(user) {
  if (hasAdminEmail(user)) {
    appState.isAdmin = true;
  } else {
    const snapshot = await getDoc(doc(appState.db, "admins", user.uid));
    appState.isAdmin = snapshot.exists();
  }
  setAdminUi(appState.isAdmin);

  if (appState.isAdmin) {
    await Promise.all([loadRsvps(), loadUploads()]);
  }
}

async function handleAuthClick() {
  if (!isConfigured()) {
    alert("Add your Firebase web config in src/firebase-config.js before using sign-in.");
    return;
  }

  if (appState.user) {
    await signOut(appState.auth);
    return;
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(appState.auth, provider);
}

async function handleRsvp(event) {
  event.preventDefault();
  if (!requireUser(elements.rsvpStatus)) return;

  const attendance = getSelectedAttendance(elements.rsvpForm);
  if (!attendance) {
    setStatus(elements.rsvpStatus, "Please choose your RSVP response.", true);
    return;
  }

  const payload = {
    uid: appState.user.uid,
    guestName: elements.guestName.value.trim(),
    guestEmail: elements.guestEmail.value.trim(),
    attendance,
    partySize: 1,
    dietary: document.querySelector("#dietary").value.trim(),
    message: document.querySelector("#message").value.trim(),
    googleName: appState.user.displayName || "",
    googleEmail: appState.user.email || "",
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(appState.db, "rsvps", appState.user.uid), payload, { merge: true });
  setStatus(elements.rsvpStatus, "RSVP saved. Thank you.");
  if (appState.isAdmin) await loadRsvps();
}

function uploadOneFile(file, index, total) {
  return new Promise((resolve, reject) => {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `eventUploads/${appState.user.uid}/${Date.now()}-${index}-${safeName}`;
    const storageRef = ref(appState.storage, path);
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || "application/octet-stream",
      customMetadata: {
        ownerUid: appState.user.uid,
        ownerEmail: appState.user.email || "",
      },
    });

    task.on(
      "state_changed",
      (snapshot) => {
        const fileProgress = snapshot.bytesTransferred / snapshot.totalBytes;
        const totalProgress = ((index + fileProgress) / total) * 100;
        elements.uploadProgress.value = Math.round(totalProgress);
      },
      reject,
      async () => {
        await setDoc(doc(collection(appState.db, "uploads")), {
          ownerUid: appState.user.uid,
          ownerName: appState.user.displayName || "",
          ownerEmail: appState.user.email || "",
          storagePath: path,
          originalName: file.name,
          contentType: file.type || "",
          size: file.size,
          uploadedAt: serverTimestamp(),
        });
        resolve();
      }
    );
  });
}

async function handleUpload() {
  if (!requireUser(elements.uploadStatus)) return;

  const files = Array.from(elements.photoInput.files || []);
  if (!files.length) {
    setStatus(elements.uploadStatus, "Choose one or more photos first.", true);
    return;
  }

  elements.uploadButton.disabled = true;
  elements.uploadProgress.hidden = false;
  elements.uploadProgress.value = 0;
  setStatus(elements.uploadStatus, "Uploading privately...");

  try {
    for (const [index, file] of files.entries()) {
      await uploadOneFile(file, index, files.length);
    }

    elements.photoInput.value = "";
    elements.uploadProgress.value = 100;
    setStatus(
      elements.uploadStatus,
      `${files.length} private upload${files.length === 1 ? "" : "s"} received. Photos will be shared after the event!`
    );
    if (appState.isAdmin) await loadUploads();
  } catch (error) {
    setStatus(elements.uploadStatus, error.message || "Upload failed.", true);
  } finally {
    elements.uploadButton.disabled = false;
  }
}

async function loadRsvps() {
  if (!appState.isAdmin) return;
  elements.rsvpRows.innerHTML = `<tr><td colspan="3">Loading...</td></tr>`;

  const snapshot = await getDocs(query(collection(appState.db, "rsvps"), orderBy("updatedAt", "desc")));
  if (snapshot.empty) {
    elements.rsvpRows.innerHTML = `<tr><td colspan="3">No RSVPs yet.</td></tr>`;
    return;
  }

  elements.rsvpRows.innerHTML = "";
  snapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data();
    const row = document.createElement("tr");
    appendCell(row, data.guestName, data.guestEmail);
    appendCell(row, data.attendance);
    appendCell(row, data.dietary, data.message);
    elements.rsvpRows.append(row);
  });
}

async function loadUploads() {
  if (!appState.isAdmin) return;
  elements.uploadGallery.innerHTML = `<p>Loading...</p>`;

  const snapshot = await getDocs(query(collection(appState.db, "uploads"), orderBy("uploadedAt", "desc")));
  if (snapshot.empty) {
    elements.uploadGallery.innerHTML = `<p>No uploads yet.</p>`;
    return;
  }

  elements.uploadGallery.innerHTML = "";
  for (const docSnapshot of snapshot.docs) {
    const data = docSnapshot.data();
    const url = await getDownloadURL(ref(appState.storage, data.storagePath));
    const card = document.createElement("article");
    const link = document.createElement("a");
    const image = document.createElement("img");
    const caption = document.createElement("span");

    card.className = "upload-card";
    link.href = url;
    link.target = "_blank";
    link.rel = "noreferrer";
    image.src = url;
    image.alt = `Private upload from ${safeText(data.ownerName)}`;
    image.loading = "lazy";
    caption.textContent = `${safeText(data.ownerName)} - ${safeText(data.originalName)}`;

    link.append(image);
    card.append(link, caption);
    elements.uploadGallery.append(card);
  }
}

function initializeFirebase() {
  if (!isConfigured()) {
    setStatus(
      elements.rsvpStatus,
      "Firebase is not configured yet. Add your project config in src/firebase-config.js.",
      true
    );
    setStatus(
      elements.uploadStatus,
      "Firebase is not configured yet. Add your project config in src/firebase-config.js.",
      true
    );
    setStatus(
      elements.playlistStatus,
      "Firebase is not configured yet. Add your project config in src/firebase-config.js.",
      true
    );
    return;
  }

  const app = initializeApp(firebaseConfig);
  appState.auth = getAuth(app);
  appState.db = getFirestore(app);
  appState.storage = getStorage(app);

  onAuthStateChanged(appState.auth, async (user) => {
    appState.user = user;
    appState.isAdmin = false;
    setSignedInUi(user);
    setAdminUi(false);

    if (user) {
      try {
        await Promise.all([loadMyRsvp(user), checkAdmin(user), loadPlaylist()]);
      } catch (error) {
        console.error(error);
      }
    } else {
      loadPlaylist().catch(console.error);
    }
  });
}

elements.authButton.addEventListener("click", () => {
  handleAuthClick().catch((error) => alert(error.message || "Authentication failed."));
});
elements.rsvpForm.addEventListener("submit", (event) => {
  handleRsvp(event).catch((error) => setStatus(elements.rsvpStatus, error.message, true));
});
elements.uploadButton.addEventListener("click", handleUpload);
elements.appleSearchButton.addEventListener("click", () => {
  searchAppleMusic().catch((error) => setStatus(elements.playlistStatus, error.message, true));
});
elements.appleSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchAppleMusic().catch((error) => setStatus(elements.playlistStatus, error.message, true));
  }
});
elements.downloadApplePlaylist.addEventListener("click", handlePlaylistDownload);
elements.photoInput.addEventListener("change", () => {
  const count = elements.photoInput.files?.length || 0;
  elements.fileSummary.textContent = count
    ? `${count} photo${count === 1 ? "" : "s"} selected`
    : "JPG, PNG, HEIC, and other image files are welcome.";
});
elements.refreshRsvps.addEventListener("click", () => loadRsvps().catch(console.error));
elements.refreshUploads.addEventListener("click", () => loadUploads().catch(console.error));
window.addEventListener("scroll", updateFlowerVisibility, { passive: true });
window.addEventListener("resize", updateFlowerVisibility);

updateCountdown();
setInterval(updateCountdown, 1000);
updateFlowerVisibility();
loadWeather();
initializeFirebase();
