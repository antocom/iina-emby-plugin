"use strict";

const { core, sidebar, event, http, console: log, preferences } = iina;

// ── Configurazione ────────────────────────────────────────────────────────────
function getConfig() {
  return {
    serverUrl: preferences.get("serverUrl") || "",
    apiKey:    preferences.get("apiKey")    || "",
    userId:    preferences.get("userId")    || "",
  };
}

// ── Helpers HTTP ──────────────────────────────────────────────────────────────
async function embyGet(path, params) {
  const cfg = getConfig();
  const base = cfg.serverUrl.replace(/\/$/, "");
  let url = base + path + "?api_key=" + encodeURIComponent(cfg.apiKey);
  if (params) {
    for (const k of Object.keys(params)) {
      url += "&" + encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    }
  }
  log.log("[Emby] GET " + url);
  const res = await http.get(url);
  if (res.statusCode !== 200) throw new Error("HTTP " + res.statusCode);
  return JSON.parse(res.text);
}

async function embyPost(path, body) {
  const cfg = getConfig();
  const base = cfg.serverUrl.replace(/\/$/, "");
  const url = base + path + "?api_key=" + encodeURIComponent(cfg.apiKey);
  try {
    await http.post(url, JSON.stringify(body), { "Content-Type": "application/json" });
  } catch (e) {
    log.log("[Emby] POST error: " + e.message);
  }
}

// ── API Emby ──────────────────────────────────────────────────────────────────
async function getLibraries() {
  const cfg = getConfig();
  const data = await embyGet("/Users/" + cfg.userId + "/Views");
  return data.Items || [];
}

async function getItems(parentId, itemType) {
  const cfg = getConfig();
  const params = {
    ParentId: parentId,
    Fields: "Overview,RunTimeTicks,ProductionYear",
    SortBy: "SortName",
    SortOrder: "Ascending",
  };
  if (itemType) params.IncludeItemTypes = itemType;
  const data = await embyGet("/Users/" + cfg.userId + "/Items", params);
  return data.Items || [];
}

async function getEpisodes(seriesId, seasonId) {
  const params = { SeriesId: seriesId, Fields: "Overview,RunTimeTicks" };
  if (seasonId) params.SeasonId = seasonId;
  const data = await embyGet("/Shows/" + seriesId + "/Episodes", params);
  return data.Items || [];
}

function buildStreamUrl(itemId) {
  const cfg = getConfig();
  const base = cfg.serverUrl.replace(/\/$/, "");
  return base + "/Videos/" + itemId + "/stream"
    + "?Static=true&MediaSourceId=" + itemId
    + "&api_key=" + encodeURIComponent(cfg.apiKey);
}

// ── Carica la sidebar ─────────────────────────────────────────────────────────
sidebar.loadFile("sidebar.html");

// ── Messaggi dalla sidebar ────────────────────────────────────────────────────
sidebar.onMessage("getLibraries", function() {
  getLibraries()
    .then(function(libs) { sidebar.postMessage("libraries", libs); })
    .catch(function(err) { sidebar.postMessage("error", { message: err.message }); });
});

sidebar.onMessage("getItems", function(data) {
  getItems(data.parentId, data.itemType)
    .then(function(items) { sidebar.postMessage("items", items); })
    .catch(function(err)  { sidebar.postMessage("error", { message: err.message }); });
});

sidebar.onMessage("getEpisodes", function(data) {
  getEpisodes(data.seriesId, data.seasonId)
    .then(function(eps) { sidebar.postMessage("episodes", eps); })
    .catch(function(err) { sidebar.postMessage("error", { message: err.message }); });
});

sidebar.onMessage("play", function(data) {
  const url = buildStreamUrl(data.itemId);
  log.log("[Emby] Apro: " + url);
  core.open(url);
  core.osd("▶ " + (data.title || "Emby"));
});

sidebar.onMessage("saveConfig", function(data) {
  preferences.set("serverUrl", data.serverUrl);
  preferences.set("apiKey",    data.apiKey);
  preferences.set("userId",    data.userId);
  log.log("[Emby] Config salvata: " + data.serverUrl);
  sidebar.postMessage("configSaved", {});
});

sidebar.onMessage("getConfig", function() {
  sidebar.postMessage("config", getConfig());
});

log.log("[Emby] Plugin avviato, sidebar caricata.");

// ── Ricevi URL da global.js e aprilo nel player corrente ──────────────────────
const { core: _core, global: _g } = iina;

_g.onMessage("emby-open", function(data) {
  _core.open(data.url);
});
