console.log("API_URL =", import.meta.env.VITE_API_URL);
console.log("FRONT_URL =", import.meta.env.VITE_FRONT_URL);

export const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";
export const FRONT_URL = import.meta.env.VITE_FRONT_URL ?? window.location.origin;

export function gatewayUrl(sessionId: string) {
  return `${FRONT_URL.replace(/\/$/, "")}/gateway/${sessionId}`;
}
