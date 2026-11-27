export function isBillingRequired(env = process.env) {
  return env.NODE_ENV === "production";
}
