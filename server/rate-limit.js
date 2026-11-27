const buckets = new Map();

export function rateLimit({ windowMs, max, name }) {
  return (request, response, next) => {
    const now = Date.now();
    const key = `${name}:${request.ip || "unknown"}`;
    const recent = (buckets.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
    if (recent.length >= max) {
      response.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
      response.status(429).json({ error: "請求過於頻繁，請稍後再試。" });
      return;
    }
    recent.push(now);
    buckets.set(key, recent);
    if (buckets.size > 10000) {
      for (const [bucketKey, timestamps] of buckets) {
        if (timestamps.every((timestamp) => now - timestamp >= windowMs)) buckets.delete(bucketKey);
      }
    }
    next();
  };
}
