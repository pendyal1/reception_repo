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
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {
  deleteObject,
  getBlob,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const eventStart = new Date("2026-09-06T18:30:00-04:00");
const rsvpDeadline = new Date("2026-07-31T23:59:59-04:00");
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
  eventDaysLeft: document.querySelector("#eventDaysLeft"),
  eventHoursLeft: document.querySelector("#eventHoursLeft"),
  eventMinutesLeft: document.querySelector("#eventMinutesLeft"),
  eventSecondsLeft: document.querySelector("#eventSecondsLeft"),
  rsvpDaysLeft: document.querySelector("#rsvpDaysLeft"),
  rsvpHoursLeft: document.querySelector("#rsvpHoursLeft"),
  rsvpMinutesLeft: document.querySelector("#rsvpMinutesLeft"),
  rsvpSecondsLeft: document.querySelector("#rsvpSecondsLeft"),
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
  downloadRsvps: document.querySelector("#downloadRsvps"),
  downloadUploads: document.querySelector("#downloadUploads"),
  adminRsvpStatus: document.querySelector("#adminRsvpStatus"),
  adminUploadStatus: document.querySelector("#adminUploadStatus"),
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

function getCountdownParts(targetDate) {
  const delta = Math.max(targetDate.getTime() - Date.now(), 0);
  const totalSeconds = Math.floor(delta / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
    seconds: totalSeconds % 60,
  };
}

function setCountdown(parts, slots) {
  slots.days.textContent = String(parts.days);
  slots.hours.textContent = String(parts.hours).padStart(2, "0");
  slots.minutes.textContent = String(parts.minutes).padStart(2, "0");
  slots.seconds.textContent = String(parts.seconds).padStart(2, "0");
}

function updateCountdown() {
  setCountdown(getCountdownParts(eventStart), {
    days: elements.eventDaysLeft,
    hours: elements.eventHoursLeft,
    minutes: elements.eventMinutesLeft,
    seconds: elements.eventSecondsLeft,
  });
  setCountdown(getCountdownParts(rsvpDeadline), {
    days: elements.rsvpDaysLeft,
    hours: elements.rsvpHoursLeft,
    minutes: elements.rsvpMinutesLeft,
    seconds: elements.rsvpSecondsLeft,
  });
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

function escapeHtml(value) {
  return safeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sanitizeFileName(value, fallback = "file") {
  return (value || fallback).replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

function getDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runNext() {
    const currentIndex = nextIndex;
    nextIndex += 1;
    if (currentIndex >= items.length) return;
    results[currentIndex] = await worker(items[currentIndex], currentIndex);
    await runNext();
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, runNext);
  await Promise.all(workers);
  return results;
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

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadTextFile(filename, lines) {
  downloadBlob(filename, new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
}

function ensureZipLibrary() {
  if (window.JSZip) return Promise.resolve(window.JSZip);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-jszip]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.JSZip), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load ZIP exporter.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
    script.async = true;
    script.dataset.jszip = "true";
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => {
      script.remove();
      reject(new Error("Could not load ZIP exporter."));
    };
    document.head.append(script);
  });
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
    const controls = document.createElement("div");

    item.className = "playlist-song";
    art.className = "playlist-art";
    details.className = "playlist-song-details";
    links.className = "playlist-song-links";
    controls.className = "playlist-admin-controls";

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

    if (appState.isAdmin) {
      const editButton = document.createElement("button");
      const removeButton = document.createElement("button");
      editButton.className = "text-button";
      removeButton.className = "text-button danger";
      editButton.type = "button";
      removeButton.type = "button";
      editButton.textContent = "Edit";
      removeButton.textContent = "Remove";
      editButton.addEventListener("click", () => {
        editPlaylistSong(song).catch((error) => setStatus(elements.playlistStatus, error.message, true));
      });
      removeButton.addEventListener("click", () => {
        removePlaylistSong(song).catch((error) => setStatus(elements.playlistStatus, error.message, true));
      });
      controls.append(editButton, removeButton);
      details.append(controls);
    }

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

function requireAdmin(statusElement) {
  if (!appState.isAdmin) {
    setStatus(statusElement, "This action is only available to Pallavi and Aditya.", true);
    return false;
  }
  return true;
}

async function editPlaylistSong(song) {
  if (!requireAdmin(elements.playlistStatus)) return;

  const title = window.prompt("Song title", song.title || "");
  if (title === null) return;
  const artistName = window.prompt("Artist", song.artistName || "");
  if (artistName === null) return;
  const note = window.prompt("Note", song.note || "");
  if (note === null) return;

  await updateDoc(doc(appState.db, "playlistSongs", song.id), {
    title: title.trim() || "Apple Music song",
    artistName: artistName.trim(),
    note: note.trim(),
  });
  setStatus(elements.playlistStatus, "Playlist song updated.");
  await loadPlaylist();
}

async function removePlaylistSong(song) {
  if (!requireAdmin(elements.playlistStatus)) return;

  const confirmed = window.confirm(`Remove "${song.title || "this song"}" from the playlist?`);
  if (!confirmed) return;

  await deleteDoc(doc(appState.db, "playlistSongs", song.id));
  setStatus(elements.playlistStatus, "Playlist song removed.");
  await loadPlaylist();
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
  renderPlaylist();

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

function getRsvpQuery() {
  return query(collection(appState.db, "rsvps"), orderBy("updatedAt", "desc"));
}

function getUploadQuery() {
  return query(collection(appState.db, "uploads"), orderBy("uploadedAt", "desc"));
}

async function loadRsvps() {
  if (!appState.isAdmin) return;
  elements.rsvpRows.innerHTML = `<tr><td colspan="4">Loading...</td></tr>`;

  const snapshot = await getDocs(getRsvpQuery());
  if (snapshot.empty) {
    elements.rsvpRows.innerHTML = `<tr><td colspan="4">No RSVPs yet.</td></tr>`;
    return;
  }

  elements.rsvpRows.innerHTML = "";
  snapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data();
    const row = document.createElement("tr");
    const actions = document.createElement("td");
    const controls = document.createElement("div");
    const editButton = document.createElement("button");
    const deleteButton = document.createElement("button");

    appendCell(row, data.guestName, data.guestEmail);
    appendCell(row, data.attendance);
    appendCell(row, data.dietary, data.message);

    controls.className = "admin-row-actions";
    editButton.className = "text-button";
    deleteButton.className = "text-button danger";
    editButton.type = "button";
    deleteButton.type = "button";
    editButton.textContent = "Edit";
    deleteButton.textContent = "Delete";
    editButton.addEventListener("click", () => {
      editRsvp(docSnapshot.id, data).catch((error) => setStatus(elements.adminRsvpStatus, error.message, true));
    });
    deleteButton.addEventListener("click", () => {
      deleteRsvp(docSnapshot.id, data).catch((error) => setStatus(elements.adminRsvpStatus, error.message, true));
    });

    controls.append(editButton, deleteButton);
    actions.append(controls);
    row.append(actions);
    elements.rsvpRows.append(row);
  });
}

async function editRsvp(uid, data) {
  if (!requireAdmin(elements.adminRsvpStatus)) return;

  const guestName = window.prompt("Guest name", data.guestName || "");
  if (guestName === null) return;
  const guestEmail = window.prompt("Guest email", data.guestEmail || "");
  if (guestEmail === null) return;
  const attendance = window.prompt("Response: yes, no, or maybe", data.attendance || "yes");
  if (attendance === null) return;
  const normalizedAttendance = attendance.trim().toLowerCase();
  if (!["yes", "no", "maybe"].includes(normalizedAttendance)) {
    setStatus(elements.adminRsvpStatus, "Response must be yes, no, or maybe.", true);
    return;
  }
  const dietary = window.prompt("Dietary notes", data.dietary || "");
  if (dietary === null) return;
  const message = window.prompt("Message", data.message || "");
  if (message === null) return;

  await updateDoc(doc(appState.db, "rsvps", uid), {
    guestName: guestName.trim(),
    guestEmail: guestEmail.trim(),
    attendance: normalizedAttendance,
    dietary: dietary.trim(),
    message: message.trim(),
    updatedAt: serverTimestamp(),
  });
  setStatus(elements.adminRsvpStatus, "RSVP updated.");
  await loadRsvps();
}

async function deleteRsvp(uid, data) {
  if (!requireAdmin(elements.adminRsvpStatus)) return;

  const confirmed = window.confirm(`Delete RSVP for ${data.guestName || data.guestEmail || "this guest"}?`);
  if (!confirmed) return;

  await deleteDoc(doc(appState.db, "rsvps", uid));
  setStatus(elements.adminRsvpStatus, "RSVP deleted.");
  await loadRsvps();
}

async function downloadRsvpsAsWord() {
  if (!requireAdmin(elements.adminRsvpStatus)) return;

  setStatus(elements.adminRsvpStatus, "Preparing RSVP Word file...");
  const snapshot = await getDocs(getRsvpQuery());
  if (snapshot.empty) {
    setStatus(elements.adminRsvpStatus, "No RSVPs to download.", true);
    return;
  }

  const rows = snapshot.docs
    .map((docSnapshot) => {
      const data = docSnapshot.data();
      const name = `${escapeHtml(data.guestName)}<br><small>${escapeHtml(data.guestEmail)}</small>`;
      const response = escapeHtml(data.attendance);
      const notes = `${escapeHtml(data.dietary)}<br>${escapeHtml(data.message)}`;
      return `<tr><td>${name}</td><td>${response}</td><td>${notes}</td></tr>`;
    })
    .join("");

  const documentHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Pallavi & Aditya RSVP List</title>
    <style>
      body { font-family: Georgia, serif; color: #1f1f1f; }
      h1 { color: #5b202b; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #9a7a3a; padding: 8px; vertical-align: top; }
      th { background: #12382d; color: #fff8e7; text-align: left; }
      small { color: #555; }
    </style>
  </head>
  <body>
    <h1>Pallavi & Aditya RSVP List</h1>
    <table>
      <thead>
        <tr><th>Name</th><th>Response</th><th>Notes</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;

  downloadBlob(
    `pallavi-aditya-rsvp-list-${getDateStamp()}.doc`,
    new Blob(["\ufeff", documentHtml], { type: "application/msword;charset=utf-8" })
  );
  setStatus(elements.adminRsvpStatus, "RSVP Word file downloaded.");
}

async function loadUploads() {
  if (!appState.isAdmin) return;
  elements.uploadGallery.innerHTML = `<p>Loading...</p>`;

  const snapshot = await getDocs(getUploadQuery());
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
    const controls = document.createElement("div");
    const renameButton = document.createElement("button");
    const deleteButton = document.createElement("button");

    card.className = "upload-card";
    controls.className = "upload-controls";
    renameButton.className = "text-button";
    deleteButton.className = "text-button danger";
    renameButton.type = "button";
    deleteButton.type = "button";
    renameButton.textContent = "Rename";
    deleteButton.textContent = "Delete";
    link.href = url;
    link.target = "_blank";
    link.rel = "noreferrer";
    image.src = url;
    image.alt = `Private upload from ${safeText(data.ownerName)}`;
    image.loading = "lazy";
    caption.textContent = `${safeText(data.ownerName)} - ${safeText(data.originalName)}`;
    renameButton.addEventListener("click", () => {
      renameUpload(docSnapshot.id, data).catch((error) => setStatus(elements.adminUploadStatus, error.message, true));
    });
    deleteButton.addEventListener("click", () => {
      deleteUpload(docSnapshot.id, data).catch((error) => setStatus(elements.adminUploadStatus, error.message, true));
    });

    link.append(image);
    controls.append(renameButton, deleteButton);
    card.append(link, caption, controls);
    elements.uploadGallery.append(card);
  }
}

async function renameUpload(uploadId, data) {
  if (!requireAdmin(elements.adminUploadStatus)) return;

  const ownerName = window.prompt("Uploaded by", data.ownerName || "");
  if (ownerName === null) return;
  const originalName = window.prompt("Photo label", data.originalName || "");
  if (originalName === null) return;

  await updateDoc(doc(appState.db, "uploads", uploadId), {
    ownerName: ownerName.trim(),
    originalName: originalName.trim() || data.originalName || "Photo",
  });
  setStatus(elements.adminUploadStatus, "Photo details updated.");
  await loadUploads();
}

async function deleteUpload(uploadId, data) {
  if (!requireAdmin(elements.adminUploadStatus)) return;

  const confirmed = window.confirm(`Delete ${data.originalName || "this photo"}?`);
  if (!confirmed) return;

  try {
    await deleteObject(ref(appState.storage, data.storagePath));
  } catch (error) {
    if (error.code !== "storage/object-not-found") throw error;
  }
  await deleteDoc(doc(appState.db, "uploads", uploadId));
  setStatus(elements.adminUploadStatus, "Photo deleted.");
  await loadUploads();
}

async function getUploadBlob(data) {
  const storageRef = ref(appState.storage, data.storagePath);

  try {
    return await getBlob(storageRef);
  } catch (error) {
    const url = await getDownloadURL(storageRef);
    const response = await fetch(url);
    if (!response.ok) throw error;
    return response.blob();
  }
}

async function downloadUploadsAsZip() {
  if (!requireAdmin(elements.adminUploadStatus)) return;

  elements.downloadUploads.disabled = true;
  setStatus(elements.adminUploadStatus, "Preparing photo ZIP...");

  try {
    const snapshot = await getDocs(getUploadQuery());
    if (snapshot.empty) {
      setStatus(elements.adminUploadStatus, "No photos to download.", true);
      return;
    }

    const JSZip = await ensureZipLibrary();
    const zip = new JSZip();
    let completed = 0;

    const files = await runPool(snapshot.docs, 4, async (docSnapshot, index) => {
      const data = docSnapshot.data();
      const blob = await getUploadBlob(data);
      const owner = sanitizeFileName(data.ownerName || data.ownerEmail || "guest", "guest");
      const originalName = sanitizeFileName(data.originalName || `photo-${index + 1}`, `photo-${index + 1}`);
      completed += 1;
      setStatus(elements.adminUploadStatus, `Downloaded ${completed} of ${snapshot.size} photos...`);
      return {
        name: `${String(index + 1).padStart(2, "0")}-${owner}-${originalName}`,
        blob,
      };
    });

    files.forEach((file) => {
      zip.file(file.name, file.blob, { compression: "STORE" });
    });

    setStatus(elements.adminUploadStatus, "Building ZIP file...");
    const zipBlob = await zip.generateAsync(
      { type: "blob", compression: "STORE", streamFiles: true },
      (metadata) => {
        setStatus(elements.adminUploadStatus, `Building ZIP file... ${Math.round(metadata.percent)}%`);
      }
    );
    downloadBlob(`pallavi-aditya-photos-${getDateStamp()}.zip`, zipBlob);
    setStatus(elements.adminUploadStatus, `${files.length} photo${files.length === 1 ? "" : "s"} downloaded as a ZIP.`);
  } finally {
    elements.downloadUploads.disabled = false;
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
elements.downloadRsvps.addEventListener("click", () => {
  downloadRsvpsAsWord().catch((error) => setStatus(elements.adminRsvpStatus, error.message, true));
});
elements.downloadUploads.addEventListener("click", () => {
  downloadUploadsAsZip().catch((error) => setStatus(elements.adminUploadStatus, error.message, true));
});
window.addEventListener("scroll", updateFlowerVisibility, { passive: true });
window.addEventListener("resize", updateFlowerVisibility);

updateCountdown();
setInterval(updateCountdown, 1000);
updateFlowerVisibility();
loadWeather();
initializeFirebase();
