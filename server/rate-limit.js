import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = join(tmpdir(), "vekai-rate-limit");
const storePath = join(directory, "buckets.json");
const lockPath = join(directory, "buckets.lock");

function readStore() {
  try {
    const parsed = JSON.parse(readFileSync(storePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function withLock(fn) {
  mkdirSync(directory, { recursive: true });
  const deadline = Date.now() + 1500;
  let fd;
  for (;;) {
    try {
      fd = openSync(lockPath, "wx");
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() > deadline) {
        try { unlinkSync(lockPath); } catch { /* another process removed it */ }
        continue;
      }
      const until = Date.now() + 5;
      while (Date.now() < until) { /* wait for the other process */ }
    }
  }
  try {
    return fn();
  } finally {
    closeSync(fd);
    try { unlinkSync(lockPath); } catch { /* already released */ }
  }
}

export function rateLimit({ windowMs, max, name }) {
  return (request, response, next) => {
    const now = Date.now();
    const key = `${name}:${request.ip || "unknown"}`;
    const allowed = withLock(() => {
      const store = readStore();
      const recent = (Array.isArray(store[key]) ? store[key] : []).filter((timestamp) => now - timestamp < windowMs);
      if (recent.length >= max) {
        store[key] = recent;
        writeFileSync(storePath, JSON.stringify(store));
        return false;
      }
      recent.push(now);
      store[key] = recent;
      if (Object.keys(store).length > 10000) {
        for (const bucketKey of Object.keys(store)) {
          store[bucketKey] = store[bucketKey].filter((timestamp) => now - timestamp < windowMs);
          if (store[bucketKey].length === 0) delete store[bucketKey];
        }
      }
      writeFileSync(storePath, JSON.stringify(store));
      return true;
    });
    if (!allowed) {
      response.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
      response.status(429).json({ error: "請求過於頻繁，請稍後再試。" });
      return;
    }
    next();
  };
}
