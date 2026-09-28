/* ================================================================== *
 *  Data connectors
 *  A tiny extensible layer: each connector resolves data into `Data`
 *  and calls Data._emit(). Scenes and the info overlay read Data
 *  directly. Add future APIs by appending to startConnectors().
 * ================================================================== */
const Data = {
  loc: null,
  wx: null,
  status: 'starting',   // starting | ok | no-location | offline
  imperial: (navigator.language || '').toUpperCase().endsWith('-US'),
  _subs: [],
  on(f) { this._subs.push(f); },
  _emit() { this._subs.forEach(f => { try { f(this); } catch (e) { } }); }
};

const WMO = {
  0: 'CLEAR SKY', 1: 'MOSTLY CLEAR', 2: 'PARTLY CLOUDY', 3: 'OVERCAST',
  45: 'FOG', 48: 'RIME FOG',
  51: 'LIGHT DRIZZLE', 53: 'DRIZZLE', 55: 'HEAVY DRIZZLE',
  56: 'FREEZING DRIZZLE', 57: 'FREEZING DRIZZLE',
  61: 'LIGHT RAIN', 63: 'RAIN', 65: 'HEAVY RAIN',
  66: 'FREEZING RAIN', 67: 'FREEZING RAIN',
  71: 'LIGHT SNOW', 73: 'SNOW', 75: 'HEAVY SNOW', 77: 'SNOW GRAINS',
  80: 'LIGHT SHOWERS', 81: 'SHOWERS', 82: 'HEAVY SHOWERS',
  85: 'SNOW SHOWERS', 86: 'SNOW SHOWERS',
  95: 'THUNDERSTORM', 96: 'THUNDERSTORM', 99: 'THUNDERSTORM'
};

function windLetters(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

function tryGeo() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: p.coords.latitude, lon: p.coords.longitude, src: 'gps' }),
      rej, { timeout: 9000, maximumAge: 600000 });
  });
}
async function tryIp() {
  const r = await fetch('https://ipwho.is/');
  const j = await r.json();
  if (!j.success) throw new Error('ip lookup failed');
  return { lat: j.latitude, lon: j.longitude, name: (j.city || '').toUpperCase(), src: 'ip' };
}
async function revGeo(l) {
  try {
    const r = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude='
      + l.lat + '&longitude=' + l.lon + '&localityLanguage=en');
    const j = await r.json();
    l.name = (j.city || j.locality || j.principalSubdivision || '').toUpperCase() || null;
  } catch (e) { }
}

function parseWx(j) {
  const c = j.current, d = j.daily || {};
  return {
    temp: c.temperature_2m, feels: c.apparent_temperature,
    rh: c.relative_humidity_2m,
    isDay: c.is_day === 1,
    precip: c.precipitation || 0,
    code: c.weather_code,
    text: WMO[c.weather_code] || ('CODE ' + c.weather_code),
    cloud: c.cloud_cover,
    wind: c.wind_speed_10m, windDir: windLetters(c.wind_direction_10m || 0),
    sunrise: d.sunrise ? d.sunrise[0].slice(11, 16) : null,
    sunset: d.sunset ? d.sunset[0].slice(11, 16) : null,
    tUnit: Data.imperial ? '°F' : '°C',
    wUnit: Data.imperial ? 'MPH' : 'KM/H',
    pUnit: Data.imperial ? 'IN' : 'MM',
    at: performance.now()
  };
}

async function pollWx() {
  if (!Data.loc) return;
  try {
    const units = Data.imperial
      ? '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch' : '';
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + Data.loc.lat
      + '&longitude=' + Data.loc.lon
      + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,'
      + 'precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m'
      + '&daily=sunrise,sunset&timezone=auto&forecast_days=1' + units;
    const r = await fetch(url);
    const j = await r.json();
    const prev = Data.wx;
    Data.wx = parseWx(j);
    Data.status = 'ok';

    const note = window.__vigilNotify || (() => { });
    const wasWet = prev && prev.precip > 0.04;
    const isWet = Data.wx.precip > 0.04;
    const snow = Data.wx.code >= 71 && Data.wx.code <= 86;
    if (!prev) {
      note((Data.loc.name ? Data.loc.name + ' · ' : '')
        + Math.round(Data.wx.temp) + Data.wx.tUnit + ' · ' + Data.wx.text);
    } else if (isWet && !wasWet) {
      note(snow ? 'snow beginning' : 'rain beginning · ' + Math.round(Data.wx.temp) + Data.wx.tUnit);
    } else if (!isWet && wasWet) {
      note(snow ? 'snow ending' : 'rain ending');
    }
    Data._emit();
  } catch (e) {
    if (!Data.wx) Data.status = 'offline';
    Data._emit();
  }
}

function startConnectors() {
  (async () => {
    try { Data.loc = await tryGeo(); await revGeo(Data.loc); }
    catch (e) {
      try { Data.loc = await tryIp(); }
      catch (e2) { Data.status = 'no-location'; Data._emit(); return; }
    }
    Data._emit();
    pollWx();
    setInterval(pollWx, 15 * 60 * 1000);
  })();
}

/* Scene-side helper: normalized weather params, or null when not linked. */
function wxParams() {
  const w = Data.wx;
  if (!w) return null;
  const precipMm = Data.imperial ? w.precip * 25.4 : w.precip;
  return {
    cloud: clamp((w.cloud || 0) / 100, 0, 1),
    rain: clamp(precipMm / 2.2, 0, 1),
    windMul: clamp(0.5 + (Data.imperial ? w.wind * 1.61 : w.wind) / 24, 0.5, 2.3),
    day: w.isDay ? 1 : 0,
    snow: w.code >= 71 && w.code <= 86 ? 1 : 0
  };
}
