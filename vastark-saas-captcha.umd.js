(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VastarkSaaSCaptcha = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

function toJSON(resp) {
  if (!resp || typeof resp !== "object") return {};
  return resp;
}

function normalizeFingerprintHash(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v || v.length < 16 || v.length > 128) return "";
  if (!/^[a-z0-9_-]+$/.test(v)) return "";
  return v;
}

async function stableHash(input) {
  const text = String(input || "");
  if (typeof crypto !== "undefined" && crypto.subtle && typeof TextEncoder !== "undefined") {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    const bytes = new Uint8Array(digest);
    let out = "";
    for (let i = 0; i < bytes.length; i += 1) out += bytes[i].toString(16).padStart(2, "0");
    return out;
  }
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function safeString(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function collectBrowserFingerprintSignals() {
  if (typeof window === "undefined") return [];
  const nav = window.navigator || {};
  const scr = window.screen || {};
  const tz = (typeof Intl !== "undefined" && Intl.DateTimeFormat) ? (Intl.DateTimeFormat().resolvedOptions().timeZone || "") : "";
  const uaData = nav.userAgentData || {};
  const brands = Array.isArray(uaData.brands) ? uaData.brands.map((b) => `${safeString(b.brand)}@${safeString(b.version)}`).join(",") : "";
  const highEntropy = [
    safeString(nav.userAgent),
    safeString(nav.appVersion),
    safeString(nav.vendor),
    safeString(nav.language),
    Array.isArray(nav.languages) ? nav.languages.map((x) => safeString(x)).join(",") : "",
    safeString(nav.platform),
    safeString(uaData.platform),
    safeString(uaData.mobile),
    brands,
    safeString(nav.hardwareConcurrency),
    safeString(nav.deviceMemory),
    safeString(nav.maxTouchPoints),
    safeString(nav.cookieEnabled),
    safeString(nav.doNotTrack),
    safeString(nav.webdriver),
    safeString(window.devicePixelRatio),
    `${safeString(scr.width)}x${safeString(scr.height)}`,
    `${safeString(scr.availWidth)}x${safeString(scr.availHeight)}`,
    safeString(scr.colorDepth),
    safeString(scr.pixelDepth),
    tz,
  ];
  return highEntropy;
}

const DEFAULT_STYLE_ID = "saas-sdk-default-styles";
const CUSTOM_STYLE_ID = "saas-sdk-custom-styles";
const PLATFORM_CLICK_PATH = "/saas/sdk/v1/recaptcha/secure/click";
const SDK_ERROR_ENUM = Object.freeze({
  CORS_BLOCKED: "E_CORS_BLOCKED",
  NETWORK: "E_NETWORK",
  BANNED: "E_BANNED",
  VERIFY_TICKET_INVALID: "E_VERIFY_TICKET_INVALID",
  UNKNOWN: "E_UNKNOWN",
});
const DEFAULT_CAPTCHA_CSS =
  ".saassdk-secure-captcha{width:100%;box-sizing:border-box;padding:0 0}.saassdk-secure-captcha-content{width:100%;max-width:var(--recaptcha-max-width,320px);margin:0 auto}.saassdk-secure-captcha-hint{margin-bottom:10px;font-size:14px;color:inherit}.saassdk-secure-captcha-selected{margin:8px 0 12px;font-size:14px;color:inherit;word-break:break-word}.saassdk-secure-captcha-image-container{position:relative;display:block;width:100%;margin:0 auto 12px;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;font-size:0;line-height:0}.saassdk-secure-captcha-image{display:block;width:100%;height:auto;border:none;border-radius:0;margin:0;padding:0;cursor:crosshair}.saassdk-secure-captcha-controls{display:grid;grid-template-columns:1fr;gap:12px}.saassdk-secure-captcha-verify-btn,.saassdk-secure-captcha-refresh-btn{display:inline-block;width:100%}.saassdk-secure-click-marker{position:absolute;width:24px;height:24px;background:#16a34a;color:#fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;z-index:1000;pointer-events:none}.saassdk-secure-click-marker>span{transform:rotate(45deg)}";

function ensureDefaultStyles(enable = true) {
  if (enable === false) return;
  if (typeof document === "undefined") return;
  if (document.getElementById(DEFAULT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = DEFAULT_STYLE_ID;
  style.textContent = DEFAULT_CAPTCHA_CSS;
  document.head.appendChild(style);
}

function ensureCustomStyles(styleText) {
  if (typeof document === "undefined") return;
  const css = String(styleText || "").trim();
  const old = document.getElementById(CUSTOM_STYLE_ID);
  if (!css) {
    if (old) old.remove();
    return;
  }
  if (old) {
    old.textContent = css;
    return;
  }
  const style = document.createElement("style");
  style.id = CUSTOM_STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

function normalizeStyleText(styleText) {
  return String(styleText || "").trim();
}

function getEventClientPoint(event) {
  if (!event) return null;
  if (typeof event.clientX === "number" && typeof event.clientY === "number") {
    return { clientX: event.clientX, clientY: event.clientY };
  }
  const touch = (event.changedTouches && event.changedTouches[0]) || (event.touches && event.touches[0]);
  if (touch && typeof touch.clientX === "number" && typeof touch.clientY === "number") {
    return { clientX: touch.clientX, clientY: touch.clientY };
  }
  return null;
}

function getEventDisplayPoint(event, imageElement, rect) {
  if (!event || !imageElement || !rect) return null;
  if (
    event.target === imageElement &&
    typeof event.offsetX === "number" &&
    typeof event.offsetY === "number" &&
    Number.isFinite(event.offsetX) &&
    Number.isFinite(event.offsetY)
  ) {
    return {
      x: Math.max(0, Math.min(event.offsetX, imageElement.clientWidth)),
      y: Math.max(0, Math.min(event.offsetY, imageElement.clientHeight)),
    };
  }
  const point = getEventClientPoint(event);
  if (!point) return null;
  return {
    x: Math.max(0, Math.min(point.clientX - rect.left, rect.width)),
    y: Math.max(0, Math.min(point.clientY - rect.top, rect.height)),
  };
}

function pickCaptchaID(data) {
  if (!data || typeof data !== "object") return "";
  if (data.captcha_id) return String(data.captcha_id);
  if (data.data && typeof data.data === "object" && data.data.captcha_id) return String(data.data.captcha_id);
  return "";
}

function pickCaptchaImageData(data) {
  if (!data || typeof data !== "object") return {};
  const detail = data.data && typeof data.data === "object" ? data.data : {};
  return {
    hint: detail.hint || "",
    imageData: detail.image_data || "",
    imageWidth: Number(detail.image_width || 320),
    imageHeight: Number(detail.image_height || 180),
  };
}

function normalizeResponse(obj) {
  const data = toJSON(obj);
  const code = typeof data.code === "number" ? data.code : Number(data.code || 0);
  const success = typeof data.success === "boolean" ? data.success : code === 0;
  return {
    ok: code === 0 && success,
    code,
    message: data.message || "",
    data,
  };
}

function isAbsoluteHttpUrl(url) {
  return /^https?:\/\/[^/\s?#]+/i.test(String(url || ""));
}

function validateClientConfig(cfg) {
  if (!cfg.fetchImpl) throw new Error("fetch is not available");
  if (!cfg.platformBaseUrl) throw new Error("platformBaseUrl is required");
  if (!cfg.backendGenerateUrl) throw new Error("backendGenerateUrl is required");
  if (!cfg.backendVerifyUrl) throw new Error("backendVerifyUrl is required");
  if (!isAbsoluteHttpUrl(cfg.backendGenerateUrl)) {
    throw new Error("backendGenerateUrl must be a full http(s) URL");
  }
  if (!isAbsoluteHttpUrl(cfg.backendVerifyUrl)) {
    throw new Error("backendVerifyUrl must be a full http(s) URL");
  }
}

function createCaptchaClient(options) {
  const cfg = Object.assign(
    {
      platformBaseUrl: "",
      backendGenerateUrl: "",
      backendVerifyUrl: "",
      failureMode: "fail-close",
      onServiceDown: null,
      onLoaded: null,
      onError: null,
      onVerifySuccess: null,
      onVerifyFail: null,
      onCoordinateSelected: null,
      useDefaultStyles: true,
      styleText: "",
      deviceFingerprint: "",
      fetchImpl: typeof fetch === "function" ? fetch.bind(window) : null,
      logIdFactory: () => "sdk-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10),
    },
    options || {}
  );

  validateClientConfig(cfg);
  ensureDefaultStyles(cfg.useDefaultStyles !== false);
  ensureCustomStyles(cfg.styleText);

  const state = {
    captchaId: "",
    verifyTicket: "",
    selectedChars: [],
    selectedAreas: [],
    clicks: [],
    container: null,
    imageElement: null,
    imageNaturalWidth: 0,
    imageNaturalHeight: 0,
    captchaBypassed: false,
    deviceFingerprint: normalizeFingerprintHash(cfg.deviceFingerprint || ""),
  };

  async function requestJSON(url, body, extraHeaders) {
    const headers = Object.assign(
      {
        "Content-Type": "application/json",
        "X-Log-Id": cfg.logIdFactory(),
      },
      extraHeaders || {}
    );
    const resp = await cfg.fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body || {}),
      credentials: "omit",
    });
    return toJSON(await resp.json());
  }

  function callError(msg) {
    if (typeof cfg.onError === "function") cfg.onError(msg);
  }

  function getRequestedImageFormat() {
    try {
      if (typeof window === "undefined" || !window.location) return "";
      const params = new URLSearchParams(window.location.search || "");
      const value = String(params.get("captchaImageFormat") || "").trim().toLowerCase();
      if (value === "jpeg_q85") return "jpeg_q85";
      if (value === "png") return "png";
    } catch (_) {}
    return "";
  }

  function handleServiceDown(err) {
    const msg = err && err.message ? err.message : String(err || "service unavailable");
    callError(msg);
    if (typeof cfg.onServiceDown === "function") cfg.onServiceDown(err);
    if (cfg.failureMode === "fail-open") return { degraded: true, reason: "service_unavailable" };
    throw err;
  }

  function currentOrigin() {
    if (typeof window !== "undefined" && window.location && window.location.origin) {
      return window.location.origin;
    }
    return "";
  }

  function isClickCORSBizError(res) {
    const code = Number(res && res.code);
    const msg = String((res && res.message) || "").toLowerCase();
    return (code === 40301 && msg.includes("origin")) || msg.includes("origin not allowed") || msg.includes("cors");
  }

  function toBizErrorEnum(code) {
    const n = Number(code || 0);
    if (!Number.isFinite(n) || n <= 0) return SDK_ERROR_ENUM.UNKNOWN;
    return `E_BIZ_${n}`;
  }

  function isBannedBizError(res) {
    const data = toJSON(res).data || {};
    const msg = String((res && res.message) || "").toLowerCase();
    const code = Number(res && res.code);
    return (
      Number(data.ban_blocked) === 1 ||
      data.ban_blocked === true ||
      String((res && res.error_enum) || "") === SDK_ERROR_ENUM.BANNED ||
      code === 1002 ||
      msg.includes("请求过于频繁") ||
      msg.includes("rate limit") ||
      msg.includes("rate_limited") ||
      msg.includes("banned")
    );
  }

  function isVerifyTicketInvalidError(res) {
    const obj = toJSON(res);
    const data = toJSON(obj.data);
    const errEnum = String(obj.error_enum || data.error_enum || "");
    const msg = String(obj.message || "").toLowerCase();
    if (errEnum === SDK_ERROR_ENUM.VERIFY_TICKET_INVALID) return true;
    if (data.ticket_invalid === true) return true;
    return (
      msg.includes("verify ticket") ||
      msg.includes("票据") ||
      msg.includes("ticket format") ||
      msg.includes("ticket signature") ||
      msg.includes("ticket expired")
    );
  }

  function withRefreshAction(resp, autoRefreshed) {
    const data = Object.assign({}, toJSON(resp).data || {});
    data.action_required = "refresh_captcha";
    data.auto_refreshed = autoRefreshed === true;
    data.ticket_invalid = true;
    if (!data.error_enum) data.error_enum = SDK_ERROR_ENUM.VERIFY_TICKET_INVALID;
    return Object.assign({}, toJSON(resp), {
      error_enum: SDK_ERROR_ENUM.VERIFY_TICKET_INVALID,
      data,
    });
  }

  function isServiceUnavailableDegradedResult(res) {
    const obj = toJSON(res);
    const data = toJSON(obj.data);
    const reason = String(obj.reason || data.reason || "").trim().toLowerCase();
    if (isBannedBizError(obj)) return false;
    if (obj.degraded === true || data.degraded === true) {
      return (
        reason === "" ||
        reason === "service_unavailable" ||
        reason === "timeout" ||
        reason === "upstream_5xx" ||
        reason === "network_error"
      );
    }
    return false;
  }

  function isLikelyCORSError(err) {
    const msg = String((err && err.message) || "").toLowerCase();
    return (
      msg.includes("failed to fetch") ||
      msg.includes("load failed") ||
      msg.includes("networkerror") ||
      msg.includes("origin not allowed") ||
      msg.includes("access-control-allow-origin") ||
      msg.includes("cross-origin") ||
      msg.includes("cors")
    );
  }

  function buildClickCORSHint() {
    const origin = currentOrigin();
    if (origin) {
      return `Click 跨域未配置或来源不匹配（当前 Origin：${origin}），请在开放平台行为验证码里补充跨域来源。`;
    }
    return "Click 跨域未配置或来源不匹配，请在开放平台行为验证码里补充跨域来源。";
  }

  function buildNetworkHint() {
    return "网络异常，请稍后重试。";
  }

  async function resolveDeviceFingerprint(overrideValue) {
    const fromOverride = normalizeFingerprintHash(overrideValue);
    if (fromOverride) {
      state.deviceFingerprint = fromOverride;
      return fromOverride;
    }
    if (state.deviceFingerprint) return state.deviceFingerprint;
    const fromConfig = normalizeFingerprintHash(cfg.deviceFingerprint);
    if (fromConfig) {
      state.deviceFingerprint = fromConfig;
      return fromConfig;
    }
    const raw = collectBrowserFingerprintSignals().join("|");
    const hashed = normalizeFingerprintHash(await stableHash(raw));
    state.deviceFingerprint = hashed;
    return hashed;
  }

  function withErrorEnum(resp, errorEnum) {
    const data = Object.assign({}, toJSON(resp).data || {});
    if (!data.error_enum) data.error_enum = errorEnum || SDK_ERROR_ENUM.UNKNOWN;
    return Object.assign({}, toJSON(resp), {
      error_enum: errorEnum || data.error_enum,
      data,
    });
  }

  function isGenerateBypass(data) {
    const d = data && typeof data === "object" ? data : {};
    return d.bypass_captcha === true || d.captcha_required === false;
  }

  function updateSelectedDisplay() {
    const selectedElement = state.container ? state.container.querySelector(".saassdk-secure-captcha-selected") : null;
    if (selectedElement) selectedElement.textContent = `已选择: ${state.selectedChars.join(" → ")}`;
  }

  function clearMarkers() {
    if (!state.container) return;
    state.container.querySelectorAll(".saassdk-secure-click-marker").forEach((m) => m.remove());
  }

  function createSelectionMarker(x, y, order) {
    const imageContainer = state.container ? state.container.querySelector(".saassdk-secure-captcha-image-container") : null;
    if (!imageContainer || !state.imageElement) return;
    const marker = document.createElement("div");
    marker.className = "saassdk-secure-click-marker";
    const scaleX = state.imageElement.clientWidth / (state.imageNaturalWidth || state.imageElement.naturalWidth || 1);
    const scaleY = state.imageElement.clientHeight / (state.imageNaturalHeight || state.imageElement.naturalHeight || 1);
    const containerRect = imageContainer.getBoundingClientRect();
    const imageRect = state.imageElement.getBoundingClientRect();
    const imageOffsetX = imageRect.left - containerRect.left;
    const imageOffsetY = imageRect.top - containerRect.top;
    marker.style.left = `${imageOffsetX + x * scaleX - 12}px`;
    marker.style.top = `${imageOffsetY + y * scaleY - 10}px`;
    marker.innerHTML = `<span>${order}</span>`;
    imageContainer.appendChild(marker);
  }

  function recreateAllMarkers() {
    clearMarkers();
    state.clicks.forEach((coord, idx) => createSelectionMarker(coord.x, coord.y, idx + 1));
  }

  function triggerCoordinateSelected() {
    if (typeof cfg.onCoordinateSelected === "function") {
      cfg.onCoordinateSelected({ captchaId: state.captchaId, clickCoordinates: state.clicks.slice() });
    }
  }

  function resetSelections() {
    state.selectedChars = [];
    state.selectedAreas = [];
    state.clicks = [];
    updateSelectedDisplay();
    clearMarkers();
  }

  function setupContainer() {
    if (!state.container) return;
    state.container.style.position = "relative";
    state.container.style.display = "block";
    if (!state.container.classList.contains("saassdk-secure-captcha")) state.container.classList.add("saassdk-secure-captcha");
    state.container.innerHTML = `
      <div class="saassdk-secure-captcha-content">
        <div class="saassdk-secure-captcha-hint"></div>
        <div class="saassdk-secure-captcha-image-container"></div>
        <div class="saassdk-secure-captcha-selected">已选择: </div>
        <div class="saassdk-secure-captcha-controls">
          <button class="saassdk-secure-captcha-verify-btn" type="button">验证</button>
          <button class="saassdk-secure-captcha-refresh-btn" type="button">刷新</button>
        </div>
      </div>
    `;
    state.container.querySelector(".saassdk-secure-captcha-verify-btn")?.addEventListener("click", async () => {
      try {
        await api.verify();
      } catch (err) {
        callError(err.message || "verify failed");
      }
    });
    state.container.querySelector(".saassdk-secure-captcha-refresh-btn")?.addEventListener("click", async () => {
      try {
        await api.refresh();
      } catch (err) {
        callError(err.message || "refresh failed");
      }
    });
  }

  async function loadCaptcha(payload) {
    if (!state.container) throw new Error("captcha container not initialized");
    resetSelections();
    const hintElement = state.container.querySelector(".saassdk-secure-captcha-hint");
    const imageContainer = state.container.querySelector(".saassdk-secure-captcha-image-container");
    if (!hintElement || !imageContainer) throw new Error("captcha container invalid");
    hintElement.textContent = "正在加载验证码...";
    imageContainer.innerHTML = "";

    const reqPayload = Object.assign(
      {
        type: "text",
        width: Math.min(Math.max((state.container.clientWidth || 320) - 2, 200), 320),
      },
      payload || {}
    );
    if (!reqPayload.image_format) {
      const requestedImageFormat = getRequestedImageFormat();
      if (requestedImageFormat) reqPayload.image_format = requestedImageFormat;
    }
    const res = await api.generate(reqPayload);
    const normalized = normalizeResponse(res);
    if (!normalized.ok) throw new Error(normalized.message || "generate failed");
    if (state.captchaBypassed) {
      hintElement.textContent = (res && res.data && res.data.user_hint) || "故障降级：无需图形验证码，可继续后续流程";
      imageContainer.innerHTML = "";
      if (typeof cfg.onLoaded === "function") cfg.onLoaded(res);
      return res;
    }
    const resultData = res.data || {};
    const detail = pickCaptchaImageData(resultData);
    if (!detail.imageData) throw new Error("missing captcha image data");
    state.imageNaturalWidth = detail.imageWidth;
    state.imageNaturalHeight = detail.imageHeight;
    hintElement.textContent = detail.hint || "请按顺序点击图片中的文字";

    const img = new Image();
    img.className = "saassdk-secure-captcha-image";
    img.src = detail.imageData;
    img.addEventListener("click", async (event) => {
      try {
        await api.handleImageClick(event);
      } catch (err) {
        callError(err.message || "click failed");
      }
    });
    imageContainer.appendChild(img);
    state.imageElement = img;
    if (typeof cfg.onLoaded === "function") cfg.onLoaded(res);
    return res;
  }

  function parseHitArea(res, x, y) {
    const d = toJSON(res).data || {};
    const dataMap = d && typeof d === "object" ? d : {};
    const hit = dataMap.hit === true;
    if (!hit) {
      if (cfg.failureMode === "fail-open" && dataMap.degraded === true) {
        return {
          hitArea: { x, y },
          char: "",
          degraded: true,
        };
      }
      return null;
    }
    return {
      hitArea: dataMap.hit_area || { x, y },
      char: typeof dataMap.char === "string" ? dataMap.char : "",
      degraded: false,
    };
  }

  const api = {
    ensureDefaultStyles() {
      ensureDefaultStyles(true);
    },
    setStyleText(styleText) {
      const css = normalizeStyleText(styleText);
      cfg.styleText = css;
      ensureCustomStyles(css);
      return css;
    },
    clearStyleText() {
      cfg.styleText = "";
      ensureCustomStyles("");
    },
    init(containerSelector, initOptions = {}) {
      Object.assign(cfg, initOptions || {});
      validateClientConfig(cfg);
      ensureDefaultStyles(cfg.useDefaultStyles !== false);
      ensureCustomStyles(normalizeStyleText(cfg.styleText));
      if (typeof containerSelector === "string") {
        state.container = document.querySelector(containerSelector);
      } else {
        state.container = containerSelector;
      }
      if (!state.container) throw new Error("container not found");
      setupContainer();
      return this.loadCaptcha();
    },
    mount(containerSelector, initOptions = {}) {
      return this.init(containerSelector, initOptions);
    },
    setupContainer() {
      setupContainer();
    },
    async loadCaptcha(payload) {
      return loadCaptcha(payload);
    },
    async generate(payload) {
      try {
        const req = Object.assign({}, payload || {});
        req.device_fingerprint = await resolveDeviceFingerprint(req.device_fingerprint);
        const res = await requestJSON(cfg.backendGenerateUrl, req);
        if (Number(res.code) !== 0) throw new Error(res.message || "generate failed");
        const data = res.data || {};
        state.captchaBypassed = isGenerateBypass(data);
        state.captchaId = pickCaptchaID(data);
        state.verifyTicket = String(data.verify_ticket || "");
        resetSelections();
        if (!state.captchaBypassed && (!state.captchaId || !state.verifyTicket)) throw new Error("missing captcha_id or verify_ticket");
        return { code: 0, message: res.message || "ok", data, captcha_id: state.captchaId, verify_ticket: state.verifyTicket, is_threshold_reached: Boolean((res.data || {}).is_threshold_reached) };
      } catch (err) {
        return handleServiceDown(err);
      }
    },
    async click(x, y) {
      if (state.captchaBypassed) {
        return { code: 0, message: "故障降级：无需点击验证码", data: { degraded: true, bypass_click: true } };
      }
      if (!state.captchaId || !state.verifyTicket) throw new Error("captcha not initialized");
      const clickURL = cfg.platformBaseUrl.replace(/\/$/, "") + PLATFORM_CLICK_PATH;
      let res;
      try {
        res = await requestJSON(clickURL, {
          captcha_id: state.captchaId,
          verify_ticket: state.verifyTicket,
          x: Number(x),
          y: Number(y),
          device_fingerprint: await resolveDeviceFingerprint(),
        });
      } catch (err) {
        if (isLikelyCORSError(err)) {
          const hint = buildClickCORSHint();
          callError(hint);
          return {
            code: 40301,
            message: hint,
            error_enum: SDK_ERROR_ENUM.CORS_BLOCKED,
            data: {
              cors_blocked: true,
              current_origin: currentOrigin(),
              error_enum: SDK_ERROR_ENUM.CORS_BLOCKED,
            },
          };
        }
        const hint = buildNetworkHint();
        callError(hint);
        return {
          code: 52000,
          message: hint,
          error_enum: SDK_ERROR_ENUM.NETWORK,
          data: {
            network_error: true,
            raw_message: String((err && err.message) || err || ""),
            error_enum: SDK_ERROR_ENUM.NETWORK,
          },
        };
      }
      if (Number(res.code) === 0) {
        const hitResult = parseHitArea(res, Number(x), Number(y));
        if (hitResult) {
          const alreadySelected = state.selectedAreas.some((area) => area.x === hitResult.hitArea.x && area.y === hitResult.hitArea.y);
          if (!alreadySelected) {
            if (state.selectedChars.length >= 3) {
              state.selectedChars.shift();
              state.selectedAreas.shift();
              state.clicks.shift();
            }
            const fallbackChar = `点${state.selectedChars.length + 1}`;
            state.selectedChars.push(hitResult.char || fallbackChar);
            state.selectedAreas.push(hitResult.hitArea);
            state.clicks.push({ x: Number(x), y: Number(y) });
            updateSelectedDisplay();
            recreateAllMarkers();
            triggerCoordinateSelected();
          }
        }
      } else if (isClickCORSBizError(res)) {
        const hint = buildClickCORSHint();
        const patched = Object.assign({}, res, {
          message: hint,
          error_enum: SDK_ERROR_ENUM.CORS_BLOCKED,
          data: Object.assign({}, toJSON(res).data || {}, {
            cors_blocked: true,
            current_origin: currentOrigin(),
            error_enum: SDK_ERROR_ENUM.CORS_BLOCKED,
          }),
        });
        callError(hint);
        return patched;
      } else {
        if (isVerifyTicketInvalidError(res)) {
          let refreshed = false;
          try {
            await this.refresh();
            refreshed = true;
          } catch (_) {}
          const patched = withRefreshAction(res, refreshed);
          callError(patched.message || "验证码票据无效，已尝试刷新验证码");
          return patched;
        }
        if (isBannedBizError(res)) {
          const patched = withErrorEnum(
            Object.assign({}, res, {
              data: Object.assign({}, toJSON(res).data || {}, {
                ban_blocked: true,
                ban_reason: "rate_limited",
              }),
            }),
            SDK_ERROR_ENUM.BANNED
          );
          callError(patched.message || "请求过于频繁，请稍后再试");
          return patched;
        }
        const bizErrorEnum = toBizErrorEnum(res.code);
        const patched = withErrorEnum(res, bizErrorEnum);
        callError(patched.message || "click failed");
        return patched;
      }
      return res;
    },
    async handleImageClick(event) {
      if (state.captchaBypassed) {
        return { code: 0, message: "故障降级：无需点击验证码", data: { degraded: true, bypass_click: true } };
      }
      if (!state.imageElement || !state.captchaId) throw new Error("captcha not initialized");
      const rect = state.imageElement.getBoundingClientRect();
      const displayPoint = getEventDisplayPoint(event, state.imageElement, rect);
      if (!displayPoint) throw new Error("click point unavailable");
      const scaleX = (state.imageNaturalWidth || state.imageElement.naturalWidth || 1) / (state.imageElement.clientWidth || 1);
      const scaleY = (state.imageNaturalHeight || state.imageElement.naturalHeight || 1) / (state.imageElement.clientHeight || 1);
      const x = Math.round(displayPoint.x * scaleX);
      const y = Math.round(displayPoint.y * scaleY);
      return this.click(x, y);
    },
    buildVerifyPayload(extra) {
      const merged = Object.assign({ captcha_id: state.captchaId, verify_ticket: state.verifyTicket, clicks: state.clicks.slice() }, extra || {});
      if (!merged.device_fingerprint && state.deviceFingerprint) {
        merged.device_fingerprint = state.deviceFingerprint;
      }
      return merged;
    },
    async submitVerifyToBackend(extra) {
      if (!cfg.backendVerifyUrl) throw new Error("backendVerifyUrl is required");
      try {
        const res = await requestJSON(cfg.backendVerifyUrl, this.buildVerifyPayload(extra));
        if (Number(res.code) !== 0 && isBannedBizError(res)) {
          const patched = withErrorEnum(
            Object.assign({}, res, {
              data: Object.assign({}, toJSON(res).data || {}, {
                ban_blocked: true,
                ban_reason: "rate_limited",
              }),
            }),
            SDK_ERROR_ENUM.BANNED
          );
          if (typeof cfg.onVerifyFail === "function") cfg.onVerifyFail(patched);
          return patched;
        }
        if (Number(res.code) === 0) {
          if (typeof cfg.onVerifySuccess === "function") cfg.onVerifySuccess(res);
        } else if (typeof cfg.onVerifyFail === "function") {
          cfg.onVerifyFail(res);
        }
        return res;
      } catch (err) {
        return handleServiceDown(err);
      }
    },
    async verify(extra) {
      if (cfg.failureMode === "fail-open" && state.captchaBypassed) {
        const bypassRes = {
          code: 0,
          message: "故障降级：无需图形验证码，默认验证通过",
          data: { degraded: true, bypass_verify: true, verify_passed: true },
        };
        this.reset();
        if (typeof cfg.onVerifySuccess === "function") cfg.onVerifySuccess(bypassRes);
        return bypassRes;
      }
      let res;
      try {
        res = await this.submitVerifyToBackend(extra);
      } catch (err) {
        try {
          await this.refresh();
        } catch (_) {}
        throw err;
      }
      if (cfg.failureMode === "fail-open" && isServiceUnavailableDegradedResult(res)) {
        res = {
          code: 0,
          message: "故障降级：验证链路异常，默认验证通过",
          data: {
            degraded: true,
            bypass_verify: true,
            verify_passed: true,
            bypass_reason: "service_unavailable",
            origin_result: res,
          },
        };
      }
      if (Number(res && res.code) === 0) {
        this.reset();
        if (typeof cfg.onVerifySuccess === "function") cfg.onVerifySuccess(res);
      } else if (res && typeof res === "object" && typeof res.code !== "undefined") {
        let refreshed = false;
        try {
          await this.refresh();
          refreshed = true;
        } catch (_) {}
        if (isVerifyTicketInvalidError(res)) {
          res = withRefreshAction(res, refreshed);
        }
      }
      return res;
    },
    async refresh(payload) {
      return this.loadCaptcha(payload);
    },
    reset() {
      resetSelections();
      state.captchaId = "";
      state.verifyTicket = "";
      state.captchaBypassed = false;
    },
    getSelectedChars() {
      return state.selectedChars.slice();
    },
    getClickCoordinates() {
      return state.clicks.slice();
    },
    destroy() {
      if (state.container) state.container.innerHTML = "";
      state.container = null;
      state.imageElement = null;
      this.reset();
    },
  };

  return api;
}


  return { createCaptchaClient: createCaptchaClient, ensureDefaultStyles: ensureDefaultStyles };
});
