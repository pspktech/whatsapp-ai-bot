// features/weather.js
// Weather module — Open-Meteo (no API key)

const DEFAULT_CITY = process.env.WEATHER_CITY || "Hyderabad";

function weatherDesc(code) {
  const map = {
    0: "Clear sky ☀️", 1: "Mainly clear 🌤️", 2: "Partly cloudy ⛅", 3: "Overcast ☁️",
    45: "Foggy 🌫️", 48: "Rime fog 🌫️",
    51: "Light drizzle 🌦️", 53: "Drizzle 🌦️", 55: "Heavy drizzle 🌧️",
    61: "Slight rain 🌧️", 63: "Rain 🌧️", 65: "Heavy rain 🌧️",
    71: "Slight snow ❄️", 73: "Snow ❄️", 75: "Heavy snow ❄️",
    80: "Rain showers 🌦️", 81: "Rain showers 🌧️", 82: "Violent showers ⛈️",
    95: "Thunderstorm ⛈️", 96: "Thunderstorm + hail ⛈️", 99: "Thunderstorm + heavy hail ⛈️",
  };
  return map[code] || "Unknown";
}

async function getWeather(city) {
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
  );
  const geo = await geoRes.json();
  if (!geo.results || !geo.results.length) return null;

  const { latitude, longitude, name, country, admin1 } = geo.results[0];

  const wRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
    `&timezone=auto&forecast_days=3`
  );
  const w = await wRes.json();

  return {
    location: `${name}, ${admin1 || ""} ${country}`.replace(/\s+/g, " ").trim(),
    current: w.current,
    daily: w.daily,
  };
}

function formatWeather(data) {
  const c = data.current;
  const d = data.daily;
  let msg = `🌍 *Weather — ${data.location}*\n\n`;
  msg += `${weatherDesc(c.weather_code)}\n`;
  msg += `🌡️ Temp: *${c.temperature_2m}°C* (feels ${c.apparent_temperature}°C)\n`;
  msg += `💧 Humidity: ${c.relative_humidity_2m}%\n`;
  msg += `💨 Wind: ${c.wind_speed_10m} km/h\n\n`;
  msg += `*Next 3 days:*\n`;
  for (let i = 0; i < d.time.length; i++) {
    msg += `📅 ${d.time[i]}: ${d.temperature_2m_min[i]}°C – ${d.temperature_2m_max[i]}°C | 🌧️ ${d.precipitation_probability_max[i]}% | ${weatherDesc(d.weather_code[i])}\n`;
  }
  if (d.precipitation_probability_max[0] >= 70) {
    msg += `\n⚠️ *Alert:* Today heavy rain chance — umbrella teesukondi!`;
  }
  return msg;
}

// Main handler — command vaste idi call avutundi
async function handleWeatherCommand(body) {
  let city = DEFAULT_CITY;
  if (body.startsWith("/weather ")) {
    city = body.slice(9).trim();
  }
  const data = await getWeather(city);
  if (!data) {
    return `❌ City dorakaledu: ${city}\nTry: /weather Vijayawada`;
  }
  return formatWeather(data);
}

// Scheduled daily morning weather
let weatherTimer = null;
function startWeatherSchedule(sock, targetJid) {
  if (weatherTimer) clearInterval(weatherTimer);
  weatherTimer = setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 7 && now.getMinutes() < 1) {
      const data = await getWeather(DEFAULT_CITY);
      if (data && sock) {
        await sock.sendMessage(targetJid, { text: formatWeather(data) });
      }
    }
  }, 60 * 1000);
}

module.exports = {
  getWeather,
  formatWeather,
  handleWeatherCommand,
  startWeatherSchedule,
  DEFAULT_CITY,
};
