// ====== CONFIG ======
const API_KEY = "3a3bab95996165bb2222255ed57e69b3";
const BASE_URL = "https://api.openweathermap.org/data/2.5";

const STORAGE_KEY = "weatherDashboardHistory";

// ====== DOM ELEMENTS ======
const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const currentWeatherBody = document.getElementById("current-weather-body");
const forecastGrid = document.getElementById("forecast-grid");
const historyList = document.getElementById("history-list");

// ====== EVENT LISTENERS ======
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const city = cityInput.value.trim();
  if (!city) return;
  getWeatherForCity(city);
});

// Click on recent search buttons
historyList.addEventListener("click", (event) => {
  if (event.target.matches("button[data-city]")) {
    const city = event.target.getAttribute("data-city");
    getWeatherForCity(city);
  }
});

// ====== MAIN FLOW ======

async function getWeatherForCity(city) {
  if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE") {
    alert("Please add your OpenWeather API key in script.js.");
    return;
  }

  // Basic loading state
  renderLoading(city);

  try {
    const [current, forecast] = await Promise.all([
      fetchCurrentWeather(city),
      fetchForecast(city),
    ]);

    renderCurrentWeather(current);
    renderForecast(forecast);
    addCityToHistory(current.name);
  } catch (error) {
    renderError(error.message);
  }
}

// ====== API HELPERS ======

async function fetchCurrentWeather(city) {
  const url = `${BASE_URL}/weather?q=${encodeURIComponent(
    city
  )}&appid=${API_KEY}&units=imperial`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("City not found. Try another name.");
  }
  return res.json();
}

async function fetchForecast(city) {
  const url = `${BASE_URL}/forecast?q=${encodeURIComponent(
    city
  )}&appid=${API_KEY}&units=imperial`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Could not fetch forecast. Try again later.");
  }
  return res.json();
}

// ====== RENDER FUNCTIONS ======

function renderLoading(city) {
  currentWeatherBody.innerHTML = `<p class="muted">Loading weather for <strong>${escapeHtml(
    city
  )}</strong>...</p>`;
  forecastGrid.innerHTML = "";
}

function renderError(message) {
  currentWeatherBody.innerHTML = `<p class="muted">${escapeHtml(
    message
  )}</p>`;
  forecastGrid.innerHTML = "";
}

function renderCurrentWeather(data) {
  const {
    name,
    sys: { country },
    main: { temp, feels_like, humidity },
    weather,
    wind: { speed: windSpeed },
  } = data;

  const description = weather[0]?.description ?? "";
  const icon = weather[0]?.icon ?? "01d";

  const now = new Date();
  const formattedDate = now.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const html = `
    <div class="current-main">
      <div>
        <div class="current-city">${escapeHtml(name)}, ${escapeHtml(
    country
  )}</div>
        <div class="muted">${formattedDate}</div>
      </div>
      <div>
        <div class="current-temp">${Math.round(temp)}°F</div>
        <div class="muted">Feels like ${Math.round(feels_like)}°F</div>
      </div>
      <div class="current-extra">
        <span>${escapeHtml(capitalize(description))}</span>
        <span>Humidity: ${humidity}%</span>
        <span>Wind: ${Math.round(windSpeed)} mph</span>
      </div>
      <div>
        <img
          src="https://openweathermap.org/img/wn/${icon}@2x.png"
          alt="${escapeHtml(description)} icon"
        />
      </div>
    </div>
  `;

  currentWeatherBody.innerHTML = html;
}

function renderForecast(data) {
  forecastGrid.innerHTML = "";

  // API returns data every 3 hours; pick around 12:00 for each day
  const byDay = {};

  data.list.forEach((entry) => {
    const [datePart, timePart] = entry.dt_txt.split(" ");
    if (!byDay[datePart]) {
      byDay[datePart] = [];
    }
    byDay[datePart].push(entry);
  });

  const days = Object.keys(byDay);

  // Pick up to 5 days, choose the entry closest to 12:00
  const forecastEntries = [];
  const targetHour = 12;

  for (const day of days) {
    const entries = byDay[day];

    let best = entries[0];
    let bestDiff = Math.abs(
      new Date(entries[0].dt_txt).getHours() - targetHour
    );

    for (const entry of entries) {
      const hour = new Date(entry.dt_txt).getHours();
      const diff = Math.abs(hour - targetHour);
      if (diff < bestDiff) {
        best = entry;
        bestDiff = diff;
      }
    }

    forecastEntries.push(best);
  }

  // Only keep the next 5 days
  const limited = forecastEntries.slice(0, 5);

  limited.forEach((entry) => {
    const date = new Date(entry.dt_txt);
    const dayLabel = date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    const temp = Math.round(entry.main.temp);
    const feelsLike = Math.round(entry.main.feels_like);
    const description = entry.weather[0]?.description ?? "";
    const icon = entry.weather[0]?.icon ?? "01d";

    const card = document.createElement("article");
    card.className = "forecast-card";
    card.innerHTML = `
      <h3>${dayLabel}</h3>
      <div class="forecast-temp">${temp}°F</div>
      <div class="forecast-extra">
        <div>${escapeHtml(capitalize(description))}</div>
        <div>Feels like ${feelsLike}°F</div>
        <div>Humidity: ${entry.main.humidity}%</div>
      </div>
      <img
        src="https://openweathermap.org/img/wn/${icon}.png"
        alt="${escapeHtml(description)} icon"
      />
    `;
    forecastGrid.appendChild(card);
  });
}

// ====== SEARCH HISTORY ======

function loadHistory() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(cities) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cities));
}

function addCityToHistory(city) {
  const history = loadHistory();

  // Avoid duplicates
  const exists = history.some(
    (c) => c.toLowerCase() === city.toLowerCase()
  );
  if (!exists) {
    history.unshift(city);
  }

  // Limit to 8 items
  const trimmed = history.slice(0, 8);
  saveHistory(trimmed);
  renderHistory(trimmed);
}

function renderHistory(cities = loadHistory()) {
  historyList.innerHTML = "";
  cities.forEach((city) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = city;
    button.setAttribute("data-city", city);
    li.appendChild(button);
    historyList.appendChild(li);
  });
}

// ====== UTILITIES ======

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ====== INIT ======

(function init() {
  const history = loadHistory();
  renderHistory(history);

  // Optionally auto-load the most recent city
  if (history.length > 0) {
    getWeatherForCity(history[0]);
  }
})();
