const crypto = require("crypto");

const PLAN_CATALOG = {
  "single-site": {
    id: "single-site",
    title: "AutoSheets Pro - Single Site",
    amount: 2499,
    currency: "INR",
    sites: "1 site",
  },
  "five-sites": {
    id: "five-sites",
    title: "AutoSheets Pro - 5 Sites",
    amount: 4999,
    currency: "INR",
    sites: "5 sites",
  },
  unlimited: {
    id: "unlimited",
    title: "AutoSheets Pro - Unlimited",
    amount: 9999,
    currency: "INR",
    sites: "Unlimited sites",
  },
};

function getPayuEnv() {
  return (process.env.PAYU_ENV || "production").toLowerCase() === "test" ? "test" : "production";
}

function getPaymentsUrl() {
  return getPayuEnv() === "test" ? "https://apitest.payu.in/v2/payments" : "https://api.payu.in/v2/payments";
}

function getVerifyUrl() {
  return getPayuEnv() === "test" ? "https://test.payu.in/v3/transaction" : "https://info.payu.in/v3/transaction";
}

function getBaseUrl(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || "https";
  const forwardedHost = req.headers["x-forwarded-host"];
  const hostHeader = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host;
  return process.env.PAYU_SITE_URL || `${proto}://${hostHeader}`;
}

function getDateHeader() {
  return new Date().toUTCString();
}

function buildAuthHeader(body, date, secret, key) {
  const signature = crypto.createHash("sha512").update(`${body}|${date}|${secret}`).digest("hex");
  return `hmac username="${key}", algorithm="sha512", headers="date", signature="${signature}"`;
}

function makeTxnId(planId) {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `AS-${planId.replace(/[^A-Z0-9]/gi, "").toUpperCase()}-${stamp}-${random}`.slice(0, 48);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function looksLikeRealName(value) {
  return typeof value === "string" && value.trim().length >= 2 && value.trim().length <= 80 && /^[\p{L}\s.'’-]+$/u.test(value.trim());
}

function looksLikeRealMessage(value) {
  if (!value) return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.length < 8 || trimmed.length > 500) return false;
  return /^[\p{L}\p{N}\s.,'’"!?():/&+@#%-]*$/u.test(trimmed);
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendResendEmail({ from, to, replyTo, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { skipped: true };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      reply_to: replyTo ? [replyTo] : undefined,
      subject,
      html,
      text,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "Failed to send email via Resend");
  }

  return data;
}

module.exports = {
  PLAN_CATALOG,
  buildAuthHeader,
  escapeHtml,
  getBaseUrl,
  getDateHeader,
  getPaymentsUrl,
  getVerifyUrl,
  getPayuEnv,
  isValidEmail,
  looksLikeRealMessage,
  looksLikeRealName,
  makeTxnId,
  readJsonBody,
  redirect,
  sendResendEmail,
  sendJson,
};
