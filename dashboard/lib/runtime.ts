const LOCAL_API = "http://localhost:8000";
const REMOTE_API = "https://evolvex-api.pacslate.com";
const WS_SUFFIX = "/ws/evolution";

function trimSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isLocalHostname(hostname?: string) {
  if (!hostname) return true;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".local") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  );
}

export function resolveApiBase(hostname?: string, envApiBase?: string) {
  if (envApiBase) return trimSlash(envApiBase);
  if (isLocalHostname(hostname)) {
    if (!hostname || hostname === "localhost") return LOCAL_API;
    return `http://${hostname}:8000`;
  }
  return REMOTE_API;
}

export function resolveWsUrl({
  hostname,
  apiBase,
  envApiBase,
  envWsUrl,
}: {
  hostname?: string;
  apiBase?: string;
  envApiBase?: string;
  envWsUrl?: string;
} = {}) {
  if (envWsUrl) return envWsUrl;

  const base = trimSlash(apiBase ?? resolveApiBase(hostname, envApiBase));
  if (base.startsWith("https://")) return `${base.replace("https://", "wss://")}${WS_SUFFIX}`;
  if (base.startsWith("http://")) return `${base.replace("http://", "ws://")}${WS_SUFFIX}`;
  return `${base}${WS_SUFFIX}`;
}

export function getRuntimeConfig() {
  const envApiBase = process.env.NEXT_PUBLIC_EVOLVEX_API_URL;
  const envWsUrl = process.env.NEXT_PUBLIC_EVOLVEX_WS_URL;
  const hostname =
    typeof window !== "undefined"
      ? window.location.hostname
      : process.env.NODE_ENV === "development"
        ? "localhost"
        : "evolvex.pacslate.com";
  const apiBase = resolveApiBase(hostname, envApiBase);

  return {
    apiBase,
    wsUrl: resolveWsUrl({ hostname, apiBase, envApiBase, envWsUrl }),
  };
}
