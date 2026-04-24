"use strict";

const { standaloneWindow, menu, console: log, preferences, http, global: g, utils } = iina;

function getConfig() {
  return {
    serverUrl: preferences.get("serverUrl") || "",
    apiKey:    preferences.get("apiKey")    || "",
    userId:    preferences.get("userId")    || "",
  };
}

function errMsg(e) {
  if (!e) return "Errore sconosciuto";
  if (typeof e === "string") return e;
  if (e.message) return e.message;
  try { return JSON.stringify(e); } catch(_) { return "Errore"; }
}

async function embyGet(path, params) {
  const cfg = getConfig();
  if (!cfg.serverUrl || !cfg.apiKey || !cfg.userId) {
    throw new Error("Configurazione incompleta — apri Preferenze → Plugin → Emby Browser");
  }
  const base = cfg.serverUrl.replace(/\/$/, "");
  let url = base + path + "?api_key=" + cfg.apiKey;
  if (params) {
    for (const k of Object.keys(params)) {
      if (params[k] !== null && params[k] !== undefined && params[k] !== "") {
        url += "&" + k + "=" + encodeURIComponent(params[k]);
      }
    }
  }
  log.log("[Emby] GET " + url);

  // Usiamo curl per aggirare ATS (che blocca HTTP in IINA/WebKit)
  let result;
  try {
    result = await utils.exec("/usr/bin/curl", [
      "-s", "-f", "-m", "15", "--insecure",
      "-w", "\n%{http_code}",
      url
    ]);
  } catch(e) {
    throw new Error("Connessione fallita: " + errMsg(e));
  }

  if (!result || !result.stdout) {
    throw new Error("Nessuna risposta dal server");
  }

  // L'output è: <body>\n<http_code>
  const lines = result.stdout.trim().split("\n");
  const statusCode = parseInt(lines[lines.length - 1], 10);
  const body = lines.slice(0, -1).join("\n");

  log.log("[Emby] Status: " + statusCode);
  if (statusCode === 401) throw new Error("API Key non valida (401)");
  if (statusCode === 404) throw new Error("URL non trovato (404)");
  if (statusCode < 200 || statusCode >= 300) throw new Error("HTTP " + statusCode);

  try { return JSON.parse(body); }
  catch(_) {
    log.log("[Emby] Risposta non JSON: " + body.substring(0, 200));
    throw new Error("Risposta non valida dal server");
  }
}

// ── Standalone Window ─────────────────────────────────────────────────────────
standaloneWindow.loadFile("window.html");
standaloneWindow.setProperty({ title: "Emby Browser", resizable: true });
standaloneWindow.setFrame(380, 600);

menu.addItem(menu.item("Apri Emby Browser", function() {
  preferences.sync();
  standaloneWindow.open();
  const cfg = getConfig();
  log.log("[Emby] Open — serverUrl=" + cfg.serverUrl + " userId=" + cfg.userId);
  standaloneWindow.postMessage("config", cfg);
}));

// ── Handler messaggi dalla window ─────────────────────────────────────────────
standaloneWindow.onMessage("getLibraries", function() {
  const cfg = getConfig();
  embyGet("/Users/" + cfg.userId + "/Views")
    .then(function(data) { standaloneWindow.postMessage("result", { id: "libraries", items: data.Items || [] }); })
    .catch(function(e)   { standaloneWindow.postMessage("error",  { message: errMsg(e) }); });
});

standaloneWindow.onMessage("getItems", function(data) {
  const cfg = getConfig();
  const params = {
    ParentId: data.parentId,
    Fields: "Overview,RunTimeTicks,ProductionYear",
    SortBy: "SortName", SortOrder: "Ascending"
  };
  if (data.itemType) params.IncludeItemTypes = data.itemType;
  embyGet("/Users/" + cfg.userId + "/Items", params)
    .then(function(res) { standaloneWindow.postMessage("result", { id: "items", items: res.Items || [] }); })
    .catch(function(e)  { standaloneWindow.postMessage("error",  { message: errMsg(e) }); });
});

standaloneWindow.onMessage("getEpisodes", function(data) {
  const params = { SeriesId: data.seriesId, Fields: "Overview,RunTimeTicks" };
  if (data.seasonId) params.SeasonId = data.seasonId;
  embyGet("/Shows/" + data.seriesId + "/Episodes", params)
    .then(function(res) { standaloneWindow.postMessage("result", { id: "items", items: res.Items || [] }); })
    .catch(function(e)  { standaloneWindow.postMessage("error",  { message: errMsg(e) }); });
});

standaloneWindow.onMessage("play", function(data) {
  const cfg = getConfig();
  const base = cfg.serverUrl.replace(/\/$/, "");

  function randomHex(n) {
    var s = "", hex = "0123456789abcdef";
    for (var i = 0; i < n; i++) s += hex[Math.floor(Math.random() * 16)];
    return s;
  }
  var playSessionId = randomHex(32);
  var deviceId = "iina-emby-plugin";

  // Prima chiama PlaybackInfo per ottenere il vero MediaSourceId e Container
  embyGet("/Items/" + data.itemId + "/PlaybackInfo", { UserId: cfg.userId })
    .then(function(info) {
      var ms = (info.MediaSources && info.MediaSources[0]) || {};
      var mediaSourceId = ms.Id || data.itemId;
      var container = ms.Container || "mkv";

      var streamUrl = base + "/Videos/" + data.itemId + "/stream"
        + "?api_key=" + cfg.apiKey
        + "&Static=true"
        + "&MediaSourceId=" + mediaSourceId
        + "&DeviceId=" + deviceId
        + "&UserId=" + cfg.userId
        + "&PlaySessionId=" + playSessionId
        + "&Container=" + container;

      log.log("[Emby] Stream URL: " + streamUrl);
      standaloneWindow.close();

      // Usa osascript per passare l'URL direttamente a IINA
      var script = 'tell application "IINA" to open location "' + streamUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
      return utils.exec("/usr/bin/osascript", ["-e", script])
        .catch(function(e) {
          log.log("[Emby] osascript fallito: " + errMsg(e));
        });
    })
    .catch(function(e) {
      log.log("[Emby] Errore play: " + errMsg(e));
      standaloneWindow.close();
    });
});

log.log("[Emby Global] Avviato.");
