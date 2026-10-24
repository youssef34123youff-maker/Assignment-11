/* COSMOS - Space Dashboard */

const NASA_API_KEY = "DEMO_KEY"; // replace with your own key from https://api.nasa.gov (DEMO_KEY is rate-limited)
const APOD_URL = "https://api.nasa.gov/planetary/apod";
const LAUNCHES_URL =
  "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&mode=normal";

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

function todayISO() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
}

function formatDate(dateStr, opts) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    timeZone: "UTC",
    ...opts,
  });
}

const SHORT_DATE = { month: "short", day: "numeric", year: "numeric" };
const LONG_DATE = { month: "long", day: "numeric", year: "numeric" };

/* ------------------------------------------------------------------ */
/* Sidebar + section navigation                                        */
/* ------------------------------------------------------------------ */
const sidebar = $("sidebar");
const navLinks = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll(".app-section");

const overlay = document.createElement("div");
overlay.className = "sidebar-overlay hidden";
document.body.appendChild(overlay);

function openSidebar() {
  sidebar.classList.add("sidebar-open");
  overlay.classList.remove("hidden");
}

function closeSidebar() {
  sidebar.classList.remove("sidebar-open");
  overlay.classList.add("hidden");
}

$("sidebar-toggle").addEventListener("click", () => {
  sidebar.classList.contains("sidebar-open") ? closeSidebar() : openSidebar();
});
overlay.addEventListener("click", closeSidebar);

const ACTIVE = ["bg-blue-500/10", "text-blue-400"];
const INACTIVE = ["text-slate-300", "hover:bg-slate-800"];

const loaded = { launches: false };

function showSection(name) {
  sections.forEach((s) =>
    s.classList.toggle("hidden", s.dataset.section !== name),
  );
  navLinks.forEach((link) => {
    const active = link.dataset.section === name;
    link.classList.remove(...(active ? INACTIVE : ACTIVE));
    link.classList.add(...(active ? ACTIVE : INACTIVE));
  });
  window.scrollTo({ top: 0 });

  if (name === "launches" && !loaded.launches) {
    loaded.launches = true;
    loadLaunches();
  }
}

navLinks.forEach((link) =>
  link.addEventListener("click", (e) => {
    e.preventDefault();
    showSection(link.dataset.section);
    closeSidebar();
  }),
);

/* ------------------------------------------------------------------ */
/* Today in Space (NASA APOD)                                          */
/* ------------------------------------------------------------------ */
const apodDateInput = $("apod-date-input");
const apodImage = $("apod-image");
const apodContainer = $("apod-image-container");
const apodLoading = $("apod-loading");
let apodHdUrl = null;

function setApodDateLabel(dateStr) {
  const label = apodDateInput.parentElement.querySelector("span");
  if (label) label.textContent = formatDate(dateStr, SHORT_DATE);
}

function clearApodVideo() {
  const old = $("apod-video");
  if (old) old.remove();
}

async function loadApod(date = todayISO()) {
  apodLoading.classList.remove("hidden");
  apodImage.classList.add("hidden");
  clearApodVideo();

  try {
    const res = await fetch(
      `${APOD_URL}?api_key=${NASA_API_KEY}&date=${date}`,
    );
    if (!res.ok) throw new Error(`NASA API responded with ${res.status}`);
    const data = await res.json();

    $("apod-title").textContent = data.title;
    $("apod-explanation").textContent = data.explanation;
    $("apod-date").textContent =
      `Astronomy Picture of the Day - ${formatDate(data.date, LONG_DATE)}`;
    $("apod-date-detail").innerHTML =
      `<i class="far fa-calendar mr-2"></i>${escapeHtml(data.date)}`;
    $("apod-date-info").textContent = data.date;
    $("apod-media-type").textContent =
      data.media_type === "video" ? "Video" : "Image";
    $("apod-copyright").textContent = data.copyright
      ? `© ${data.copyright.replace(/\s+/g, " ").trim()}`
      : "Public domain";

    apodDateInput.value = data.date;
    setApodDateLabel(data.date);
    apodHdUrl = data.hdurl || data.url;

    if (data.media_type === "video") {
      const frame = document.createElement("iframe");
      frame.id = "apod-video";
      frame.src = data.url;
      frame.title = data.title;
      frame.className = "w-full h-full";
      frame.allowFullscreen = true;
      apodContainer.prepend(frame);
    } else {
      apodImage.src = data.url;
      apodImage.alt = data.title;
      apodImage.classList.remove("hidden");
    }
  } catch (err) {
    console.error(err);
    $("apod-title").textContent = "Couldn't load this picture";
    $("apod-explanation").textContent =
      "NASA's server didn't return data for this date. Pick another date or try again in a minute.";
    apodImage.classList.remove("hidden");
  } finally {
    apodLoading.classList.add("hidden");
  }
}

apodDateInput.max = todayISO();
setApodDateLabel(todayISO());

$("load-date-btn").addEventListener("click", () => {
  if (apodDateInput.value) loadApod(apodDateInput.value);
});
$("today-apod-btn").addEventListener("click", () => loadApod(todayISO()));
apodDateInput.addEventListener("change", () =>
  setApodDateLabel(apodDateInput.value),
);

apodContainer.querySelector("button")?.addEventListener("click", () => {
  if (apodHdUrl) window.open(apodHdUrl, "_blank", "noopener");
});

/* ------------------------------------------------------------------ */
/* Launches (The Space Devs)                                           */
/* ------------------------------------------------------------------ */
const STATUS_COLORS = {
  Go: "#22c55e",
  Success: "#22c55e",
  TBC: "#eab308",
  TBD: "#3b82f6",
  Hold: "#f97316",
  Failure: "#ef4444",
};

function statusBadge(launch, extraClasses) {
  const abbrev = launch.status?.abbrev || "TBD";
  const color = STATUS_COLORS[abbrev] || "#64748b";
  return `<span class="${extraClasses}" style="background-color:${color}; color:#fff">${escapeHtml(abbrev)}</span>`;
}

function launchInfo(launch) {
  const net = new Date(launch.net);
  return {
    name: launch.name,
    provider: launch.launch_service_provider?.name || "Unknown",
    rocket: launch.rocket?.configuration?.name || "Unknown",
    location: launch.pad?.location?.name || "Unknown",
    country: launch.pad?.location?.country_code || "N/A",
    date: formatDate(launch.net, SHORT_DATE),
    longDate: formatDate(launch.net, LONG_DATE),
    time: net.toISOString().slice(11, 16) + " UTC",
    days: Math.max(0, Math.ceil((net - Date.now()) / 86400000)),
    description: launch.mission?.description || "No mission description yet.",
    image: launch.image,
    url:
      launch.info_urls?.[0]?.url || launch.vid_urls?.[0]?.url || "",
  };
}

function renderFeatured(launch) {
  const l = launchInfo(launch);
  const infoBox = (icon, label, value) => `
    <div class="bg-slate-900/50 rounded-xl p-4">
      <p class="text-xs text-slate-400 mb-1 flex items-center gap-2">
        <i class="fas ${icon}"></i>${label}
      </p>
      <p class="font-semibold text-sm">${escapeHtml(value)}</p>
    </div>`;

  $("featured-launch").innerHTML = `
    <div class="relative bg-slate-800/30 border border-slate-700 rounded-3xl overflow-hidden group hover:border-blue-500/50 transition-all">
      <div class="relative grid grid-cols-1 lg:grid-cols-2 gap-6 p-8">
        <div class="flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-3 mb-4">
              <span class="px-4 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-sm font-semibold flex items-center gap-2">
                <i class="fas fa-star"></i>Featured Launch
              </span>
              ${statusBadge(launch, "px-4 py-1.5 rounded-full text-sm font-semibold")}
            </div>
            <h3 class="text-3xl font-bold mb-3 leading-tight">${escapeHtml(l.name)}</h3>
            <div class="flex flex-col xl:flex-row xl:items-center gap-4 mb-6 text-slate-400">
              <div class="flex items-center gap-2"><i class="fas fa-building"></i><span>${escapeHtml(l.provider)}</span></div>
              <div class="flex items-center gap-2"><i class="fas fa-rocket"></i><span>${escapeHtml(l.rocket)}</span></div>
            </div>
            <div class="inline-flex items-center gap-3 px-6 py-3 bg-linear-to-r from-blue-500/20 to-purple-500/20 rounded-xl mb-6">
              <i class="fas fa-clock text-2xl text-blue-400"></i>
              <div>
                <p class="text-2xl font-bold text-blue-400">${l.days}</p>
                <p class="text-xs text-slate-400">Days Until Launch</p>
              </div>
            </div>
            <div class="grid xl:grid-cols-2 gap-4 mb-6">
              ${infoBox("fa-calendar", "Launch Date", l.longDate)}
              ${infoBox("fa-clock", "Launch Time", l.time)}
              ${infoBox("fa-map-marker-alt", "Location", l.location)}
              ${infoBox("fa-globe", "Country", l.country)}
            </div>
            <p class="text-slate-300 leading-relaxed mb-6">${escapeHtml(l.description)}</p>
          </div>
          <div class="flex flex-col md:flex-row gap-3">
            <button data-url="${escapeHtml(l.url)}" class="launch-details flex-1 self-start md:self-center px-6 py-3 bg-blue-500 rounded-xl hover:bg-blue-600 transition-colors font-semibold flex items-center justify-center gap-2">
              <i class="fas fa-info-circle"></i>View Full Details
            </button>
            <div class="icons self-end md:self-center">
              <button class="fav-btn px-4 py-3 bg-slate-700 rounded-xl hover:bg-slate-600 transition-colors"><i class="far fa-heart"></i></button>
              <button class="fav-btn px-4 py-3 bg-slate-700 rounded-xl hover:bg-slate-600 transition-colors"><i class="fas fa-bell"></i></button>
            </div>
          </div>
        </div>
        <div class="relative">
          <div class="relative h-full min-h-[400px] rounded-2xl overflow-hidden bg-slate-900/50">
            <div class="flex items-center justify-center h-full min-h-[400px] bg-slate-800">
              <i class="fas fa-rocket text-6xl text-slate-700"></i>
            </div>
            ${l.image ? `<img class="absolute inset-0 w-full h-full object-cover" src="${escapeHtml(l.image)}" alt="${escapeHtml(l.name)}" />` : ""}
            <div class="absolute inset-0 bg-linear-to-t from-slate-900 via-transparent to-transparent"></div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderLaunchCard(launch) {
  const l = launchInfo(launch);
  const row = (icon, value, clamp = "") => `
    <div class="flex items-center gap-2 text-sm">
      <i class="fas ${icon} text-slate-500 w-4"></i>
      <span class="text-slate-300 ${clamp}">${escapeHtml(value)}</span>
    </div>`;

  return `
    <div class="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all group cursor-pointer">
      <div class="relative h-48 bg-slate-900/50 flex items-center justify-center">
        <i class="fas fa-rocket text-5xl text-slate-700"></i>
        ${l.image ? `<img class="absolute inset-0 w-full h-full object-cover" src="${escapeHtml(l.image)}" alt="${escapeHtml(l.name)}" loading="lazy" />` : ""}
        <div class="absolute top-3 right-3">
          ${statusBadge(launch, "px-3 py-1 rounded-full text-xs font-semibold")}
        </div>
      </div>
      <div class="p-5">
        <div class="mb-3">
          <h4 class="font-bold text-lg mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">${escapeHtml(l.name)}</h4>
          <p class="text-sm text-slate-400 flex items-center gap-2"><i class="fas fa-building text-xs"></i>${escapeHtml(l.provider)}</p>
        </div>
        <div class="space-y-2 mb-4">
          ${row("fa-calendar", l.date)}
          ${row("fa-clock", l.time)}
          ${row("fa-rocket", l.rocket)}
          ${row("fa-map-marker-alt", l.location, "line-clamp-1")}
        </div>
        <div class="flex items-center gap-2 pt-4 border-t border-slate-700">
          <button data-url="${escapeHtml(l.url)}" class="launch-details flex-1 px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors text-sm font-semibold">Details</button>
          <button class="fav-btn px-3 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"><i class="far fa-heart"></i></button>
        </div>
      </div>
    </div>`;
}

async function loadLaunches() {
  const grid = $("launches-grid");
  try {
    const res = await fetch(LAUNCHES_URL);
    if (!res.ok) throw new Error(`Launch API responded with ${res.status}`);
    const { results } = await res.json();
    if (!results?.length) return;

    renderFeatured(results[0]);
    grid.innerHTML = results.slice(1).map(renderLaunchCard).join("");

    // Hide images that fail to load so the icon placeholder shows through
    document
      .querySelectorAll("#launches img")
      .forEach((img) => img.addEventListener("error", () => img.remove()));

    $("launches-count").textContent = `${results.length} Launches`;
    $("launches-count-mobile").textContent = results.length;
  } catch (err) {
    console.error(err);
    // Static placeholder cards stay in place; add a small notice
    if (!$("launches-error")) {
      const note = document.createElement("p");
      note.id = "launches-error";
      note.className = "text-sm text-slate-400 mb-4";
      note.textContent =
        "Live launch data is unavailable right now (the API may be rate-limited). Showing sample launches.";
      grid.before(note);
    }
  }
}
document.addEventListener("click", (e) => {
  const details = e.target.closest(".launch-details");
  if (details) {
    const url = details.dataset.url;
    if (url) window.open(url, "_blank", "noopener");
    return;
  }
  const fav = e.target.closest(".fav-btn");
  if (fav) fav.classList.toggle("text-red-400");
});

const PLANETS = {
  mercury: {
    name: "Mercury",
    description:
      "Mercury is the smallest planet in the Solar System and the closest to the Sun. It has almost no atmosphere, so its surface swings from scorching days to freezing nights and is covered in craters.",
    distance: "57.9M km", radius: "2,440 km", mass: "3.30 × 10²³ kg", density: "5.43 g/cm³",
    orbit: "88 days", rotation: "58.6 days", moons: "0", gravity: "3.7 m/s²",
    discoverer: "Known since antiquity", discovered: "Ancient", type: "Planet", volume: "6.08 × 10¹⁰ km³",
    perihelion: "46.0M km", aphelion: "69.8M km", eccentricity: "0.2056", inclination: "7.00°",
    tilt: "0.03°", temp: "167°C", escape: "4.3 km/s",
    facts: [
      "Shortest year of any planet: 88 Earth days",
      "A day-night cycle lasts about 176 Earth days",
      "Temperatures range from -180°C to 430°C",
      "Has water ice in permanently shadowed craters",
    ],
  },
  venus: {
    name: "Venus",
    description:
      "Venus is the second planet from the Sun and the hottest in the Solar System. A thick carbon dioxide atmosphere traps heat, and clouds of sulfuric acid hide its volcanic surface.",
    distance: "108.2M km", radius: "6,052 km", mass: "4.87 × 10²⁴ kg", density: "5.24 g/cm³",
    orbit: "224.7 days", rotation: "243 days (retrograde)", moons: "0", gravity: "8.87 m/s²",
    discoverer: "Known since antiquity", discovered: "Ancient", type: "Planet", volume: "9.28 × 10¹¹ km³",
    perihelion: "107.5M km", aphelion: "108.9M km", eccentricity: "0.0068", inclination: "3.39°",
    tilt: "177.4°", temp: "464°C", escape: "10.4 km/s",
    facts: [
      "Spins backwards compared to most planets",
      "A day on Venus is longer than its year",
      "Surface pressure is about 92 times Earth's",
      "Hotter than Mercury despite being farther from the Sun",
    ],
  },
  earth: {
    name: "Earth",
    description:
      "Earth is the third planet from the Sun and the only astronomical object known to harbor life. About 29% of Earth's surface is land, and the remaining 71% is covered with water, mostly oceans, seas and gulfs, but also lakes and rivers that make up the hydrosphere.",
    distance: "149.6M km", radius: "6,371 km", mass: "5.97 × 10²⁴ kg", density: "5.51 g/cm³",
    orbit: "365.25 days", rotation: "24 hours", moons: "1", gravity: "9.8 m/s²",
    discoverer: "N/A", discovered: "N/A", type: "Planet", volume: "1.08 × 10¹² km³",
    perihelion: "147.1M km", aphelion: "152.1M km", eccentricity: "0.0167", inclination: "0.00°",
    tilt: "23.44°", temp: "15°C", escape: "11.2 km/s",
    facts: [
      "Only known planet with liquid water on its surface",
      "Atmosphere contains 78% nitrogen",
      "Magnetic field protects from solar wind",
      "Formed 4.54 billion years ago",
    ],
  },
  mars: {
    name: "Mars",
    description:
      "Mars is the fourth planet from the Sun, a cold desert world with a thin carbon dioxide atmosphere. Its red color comes from iron oxide, and it hosts the tallest volcano and the longest canyon in the Solar System.",
    distance: "227.9M km", radius: "3,390 km", mass: "6.42 × 10²³ kg", density: "3.93 g/cm³",
    orbit: "687 days", rotation: "24.6 hours", moons: "2", gravity: "3.71 m/s²",
    discoverer: "Known since antiquity", discovered: "Ancient", type: "Planet", volume: "1.63 × 10¹¹ km³",
    perihelion: "206.7M km", aphelion: "249.3M km", eccentricity: "0.0934", inclination: "1.85°",
    tilt: "25.19°", temp: "-65°C", escape: "5.0 km/s",
    facts: [
      "Olympus Mons is about 22 km high",
      "Has two small moons: Phobos and Deimos",
      "Evidence shows liquid water flowed here long ago",
      "A day is only about 40 minutes longer than Earth's",
    ],
  },
  jupiter: {
    name: "Jupiter",
    description:
      "Jupiter is the largest planet in the Solar System, a gas giant made mostly of hydrogen and helium. Its Great Red Spot is a storm larger than Earth that has raged for centuries.",
    distance: "778.5M km", radius: "69,911 km", mass: "1.898 × 10²⁷ kg", density: "1.33 g/cm³",
    orbit: "11.9 years", rotation: "9.9 hours", moons: "79", gravity: "24.79 m/s²",
    discoverer: "Known since antiquity", discovered: "Ancient", type: "Gas Giant", volume: "1.43 × 10¹⁵ km³",
    perihelion: "740.6M km", aphelion: "816.4M km", eccentricity: "0.0489", inclination: "1.30°",
    tilt: "3.13°", temp: "-110°C", escape: "59.5 km/s",
    facts: [
      "More massive than all other planets combined",
      "Shortest day of any planet: under 10 hours",
      "Galileo discovered its four largest moons in 1610",
      "Has a faint ring system",
    ],
  },
  saturn: {
    name: "Saturn",
    description:
      "Saturn is the second-largest planet, famous for its spectacular ring system made of ice and rock. It is a gas giant so light that it would float in a big enough bathtub.",
    distance: "1,432M km", radius: "58,232 km", mass: "5.68 × 10²⁶ kg", density: "0.69 g/cm³",
    orbit: "29.5 years", rotation: "10.7 hours", moons: "82", gravity: "10.44 m/s²",
    discoverer: "Known since antiquity", discovered: "Ancient", type: "Gas Giant", volume: "8.27 × 10¹⁴ km³",
    perihelion: "1,357.6M km", aphelion: "1,506.5M km", eccentricity: "0.0565", inclination: "2.49°",
    tilt: "26.73°", temp: "-140°C", escape: "35.5 km/s",
    facts: [
      "Least dense planet in the Solar System",
      "Rings span up to 282,000 km but are often only about 10 m thick",
      "Titan, its largest moon, has a thick atmosphere",
      "Winds can reach 1,800 km/h",
    ],
  },
  uranus: {
    name: "Uranus",
    description:
      "Uranus is an ice giant that rotates on its side, with an axial tilt of nearly 98 degrees. Methane in its atmosphere gives it a pale blue-green color.",
    distance: "2,867M km", radius: "25,362 km", mass: "8.68 × 10²⁵ kg", density: "1.27 g/cm³",
    orbit: "84.0 years", rotation: "17.2 hours (retrograde)", moons: "27", gravity: "8.87 m/s²",
    discoverer: "William Herschel", discovered: "1781", type: "Ice Giant", volume: "6.83 × 10¹³ km³",
    perihelion: "2,741.3M km", aphelion: "3,003.6M km", eccentricity: "0.0457", inclination: "0.77°",
    tilt: "97.77°", temp: "-195°C", escape: "21.3 km/s",
    facts: [
      "First planet discovered with a telescope",
      "Rolls around the Sun on its side",
      "Coldest planetary atmosphere: about -224°C",
      "Has 13 known rings",
    ],
  },
  neptune: {
    name: "Neptune",
    description:
      "Neptune is the farthest known planet from the Sun, a dark, cold ice giant lashed by supersonic winds. It was found through mathematical predictions before it was ever seen.",
    distance: "4,515M km", radius: "24,622 km", mass: "1.02 × 10²⁶ kg", density: "1.64 g/cm³",
    orbit: "164.8 years", rotation: "16.1 hours", moons: "14", gravity: "11.15 m/s²",
    discoverer: "Le Verrier & Galle", discovered: "1846", type: "Ice Giant", volume: "6.25 × 10¹³ km³",
    perihelion: "4,444.5M km", aphelion: "4,545.7M km", eccentricity: "0.0113", inclination: "1.77°",
    tilt: "28.32°", temp: "-200°C", escape: "23.5 km/s",
    facts: [
      "Winds reach over 2,000 km/h, the fastest in the Solar System",
      "Completed its first observed orbit since discovery in 2011",
      "Its largest moon, Triton, orbits backwards",
      "Only visited once, by Voyager 2 in 1989",
    ],
  },
};

function showPlanet(id) {
  const p = PLANETS[id];
  if (!p) return;

  const img = $("planet-detail-image");
  img.src = `./assets/images/${id}.png`;
  img.alt = `${p.name} planet`;

  const text = {
    "planet-detail-name": p.name,
    "planet-detail-description": p.description,
    "planet-distance": p.distance,
    "planet-radius": p.radius,
    "planet-mass": p.mass,
    "planet-density": p.density,
    "planet-orbital-period": p.orbit,
    "planet-rotation": p.rotation,
    "planet-moons": p.moons,
    "planet-gravity": p.gravity,
    "planet-discoverer": p.discoverer,
    "planet-discovery-date": p.discovered,
    "planet-body-type": p.type,
    "planet-volume": p.volume,
    "planet-perihelion": p.perihelion,
    "planet-aphelion": p.aphelion,
    "planet-eccentricity": p.eccentricity,
    "planet-inclination": p.inclination,
    "planet-axial-tilt": p.tilt,
    "planet-temp": p.temp,
    "planet-escape": p.escape,
  };
  Object.entries(text).forEach(([elId, value]) => {
    $(elId).textContent = value;
  });

  $("planet-facts").innerHTML = p.facts
    .map(
      (fact) => `
      <li class="flex items-start">
        <i class="fas fa-check text-green-400 mt-1 mr-2"></i>
        <span class="text-slate-300">${escapeHtml(fact)}</span>
      </li>`,
    )
    .join("");
}

$("planets-grid").addEventListener("click", (e) => {
  const card = e.target.closest(".planet-card");
  if (!card) return;
  showPlanet(card.dataset.planetId);
  $("planet-detail-name").scrollIntoView({ behavior: "smooth", block: "center" });
});

showSection("today-in-space");
showPlanet("earth");
loadApod();