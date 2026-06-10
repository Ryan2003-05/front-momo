import { useEffect, useRef, useState } from "react";
import axios from "axios";
import Toast from "../components/Toast";
import { API_URL } from "../config";
import { formatMobileMoneyNumber } from "../utils/mobileMoney";

// ─── Types ────────────────────────────────────────────────────────────────────

type Etape = "attente" | "popup1" | "popup2" | "succes" | "refuse" | "expire";

interface PushData {
  id: string;
  session_id: string;
  montant: string;
  libelle: string;
  operateur: string;
  commerce: string;
  numero: string;
  expires_at: string;
  reference?: string;
  provider?: string;
  payload?: {
    delivery_status?: string;
    channel?: string;
    operateur_detecte?: string;
  };
}

const API = API_URL;
const TRANSACTIONS_UPDATED_EVENT = "paypme:transactions-updated";
const TRANSACTIONS_UPDATED_KEY = "paypme:transactions-updated-at";

function notifyTransactionsUpdated() {
  window.dispatchEvent(new Event(TRANSACTIONS_UPDATED_EVENT));
  localStorage.setItem(TRANSACTIONS_UPDATED_KEY, Date.now().toString());
}

const opConfig: Record<string, { bgClass: string; textClass: string; dotClass: string; code: string; label: string }> = {
  MTN:     { bgClass: "bg-[#FFCC00]", textClass: "text-black", dotClass: "bg-black", code: "MTN", label: "MTN MoMo" },
  Moov:    { bgClass: "bg-[#0F6AB3]", textClass: "text-white", dotClass: "bg-white", code: "MOV", label: "Moov Money" },
  Celtiis: { bgClass: "bg-linear-to-br from-[#95C21F] to-[#1E3C74]", textClass: "text-white", dotClass: "bg-white", code: "CEL", label: "Celtiis" },
};

function formatMontant(v: string | number): string {
  return Number(v).toLocaleString("fr-FR") + " FCFA";
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function secondsUntil(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function PushClientPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const numeroClient = searchParams.get("numero") ?? "";
  const pushReference = searchParams.get("reference") ?? "";
  const [etape, setEtape]               = useState<Etape>("attente");
  const [push, setPush]                 = useState<PushData | null>(null);
  const [pin, setPin]                   = useState("");
  const [loading, setLoading]           = useState(false);
  const [errorMsg, setErrorMsg]         = useState("");
  const [timerSeconds, setTimerSeconds] = useState(180);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType]       = useState<"success" | "error" | "info">("success");
  const pollingRef = useRef<number | null>(null);
  const timerRef   = useRef<number | null>(null);
  const lastPushId = useRef<string | null>(null);

  function showToast(message: string, type: "success" | "error" | "info" = "success") {
    setToastMessage(message);
    setToastType(type);
  }

  // ── Polling permanent dès l'ouverture ─────────────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const params = new URLSearchParams();
        if (numeroClient) params.set("numero", numeroClient);
        if (pushReference) params.set("reference", pushReference);
        const query = params.toString() ? `?${params.toString()}` : "";
        const res  = await axios.get(`${API}/push-status${query}`);
        const data = res.data;
        if (data.push && data.push.id !== lastPushId.current) {
          lastPushId.current = data.push.id;
          setPush(data.push);
          setEtape("popup1");
          setPin("");
          setErrorMsg("");
          setTimerSeconds(secondsUntil(data.push.expires_at));
        }
      } catch { /* ignore */ }
    };

    poll();
    pollingRef.current = window.setInterval(poll, 2000);
    return () => { if (pollingRef.current) window.clearInterval(pollingRef.current); };
  }, [numeroClient, pushReference]);

  // ── Timer session ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (etape !== "popup1" && etape !== "popup2") return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      if (!push) return;
      const seconds = secondsUntil(push.expires_at);
      setTimerSeconds(seconds);
      if (seconds <= 0) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        setEtape("expire");
        setPush(null);
        notifyTransactionsUpdated();
      }
    }, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [etape, push]);

  function reset() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setPush(null);
    setEtape("attente");
    setPin("");
    setErrorMsg("");
    lastPushId.current = null;
  }

  async function handleConfirmer() {
    if (!push || pin.length < 4) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await axios.post(`${API}/gateway/${push.session_id}/push-confirmer`, {
        push_id: push.id,
        pin,
        action: "confirmer",
      });
      if (res.data.statut === "SUCCESS") {
        setEtape("succes");
        showToast(`✓ Paiement de ${formatMontant(push.montant)} validé !`, "success");
      } else {
        setEtape("refuse");
        showToast("✗ Paiement échoué. Solde insuffisant.", "error");
      }
      setPush(null);
      if (timerRef.current) window.clearInterval(timerRef.current);
      notifyTransactionsUpdated();
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      setErrorMsg(error.response?.data?.message || "Erreur lors de la validation.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefuser() {
    if (!push) return;
    setLoading(true);
    try {
      await axios.post(`${API}/gateway/${push.session_id}/push-confirmer`, {
        push_id: push.id,
        pin: "0000",
        action: "refuser",
      });
      setEtape("refuse");
      showToast("Paiement annulé.", "info");
      setPush(null);
      if (timerRef.current) window.clearInterval(timerRef.current);
      notifyTransactionsUpdated();
    } catch {
      setErrorMsg("Erreur lors de l'annulation.");
    } finally {
      setLoading(false);
    }
  }

  const op = push
    ? (opConfig[push.payload?.operateur_detecte ?? push.operateur] ?? { bgClass: "bg-green-600", textClass: "text-white", dotClass: "bg-white", code: "PAY", label: "Mobile Money" })
    : null;

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 font-sans">

      {/* Toast unifié */}
      {toastMessage && (
        <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage("")} />
      )}

      <div className="w-full max-w-xs">

        {/* Header */}
        <div className="text-center mb-5">
          <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Mobile Money</p>
          <h1 className="text-white text-base font-semibold">Téléphone Mobile Money</h1>
        </div>

        {/* Téléphone */}
        <div className="bg-gray-800 rounded-[2.5rem] p-2.5 shadow-2xl border border-gray-700">

          {/* Encoche */}
          <div className="flex justify-center mb-1">
            <div className="w-16 h-1 bg-gray-700 rounded-full" />
          </div>

          {/* Écran */}
          <div className="bg-black rounded-4xl overflow-hidden" style={{ minHeight: 520 }}>

            {/* Status bar */}
            <div className="flex items-center justify-between px-5 py-2">
              <span className="text-white text-[11px] font-medium">09:41</span>
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" d="M1.5 8.5a13 13 0 0 1 21 0M5 12a10 10 0 0 1 14 0M8.5 15.5a6 6 0 0 1 7 0M12 19h.01"/>
                </svg>
                <span className="text-white text-[11px]">🔋</span>
              </div>
            </div>

            <div className="px-5 pb-8">

              {/* ── EN ATTENTE ── */}
              {etape === "attente" && (
                <div className="flex flex-col items-center pt-10 gap-5">
                  <div className="w-20 h-20 rounded-full bg-linear-to-br from-green-500 to-green-700 flex items-center justify-center shadow-lg shadow-green-900">
                    <span className="text-white text-3xl font-bold">P</span>
                  </div>
                  <div className="text-center">
                    <p className="text-white text-base font-bold">Paycom Mobile</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {numeroClient ? `En attente pour ${numeroClient}` : "En attente d'un paiement..."}
                    </p>
                  </div>
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-green-900" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-green-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-xl">📱</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-gray-600 text-[10px]">Vérification toutes les 2 secondes</p>
                  </div>
                  <p className="text-gray-700 text-[10px] text-center px-4">
                    La demande de paiement apparaîtra automatiquement dès que le commerçant l'envoie
                  </p>
                </div>
              )}

              {/* ── POPUP 1 ── */}
              {etape === "popup1" && push && op && (
                <div className="pt-3">
                  <div className={`rounded-2xl overflow-hidden mb-4 ${op.bgClass}`}>
                    <div className="px-4 py-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center">
                          <span className={`text-[11px] font-extrabold ${op.textClass}`}>{op.code}</span>
                        </div>
                        <div>
                          <p className={`font-extrabold text-sm ${op.textClass}`}>{op.label}</p>
                          <p className={`text-[10px] opacity-75 ${op.textClass}`}>Demande de paiement</p>
                        </div>
                        <div className="ml-auto bg-white/20 px-2 py-0.5 rounded-full">
                          <span className={`text-[10px] font-bold ${op.textClass}`}>{formatTimer(timerSeconds)}</span>
                        </div>
                      </div>
                      <div className="bg-white/15 rounded-xl p-3 text-center">
                        <p className={`text-[10px] opacity-75 uppercase tracking-wide ${op.textClass}`}>
                          Vous allez effectuer un paiement de
                        </p>
                        <p className={`text-3xl font-extrabold mt-1 ${op.textClass}`}>
                          {formatMontant(push.montant)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900 rounded-2xl px-4 py-3 mb-4 space-y-2">
                    {[
                      { label: "Marchand", value: push.commerce },
                      { label: "Motif",    value: push.libelle },
                      { label: "Numéro",   value: formatMobileMoneyNumber(push.numero) },
                      ...(push.reference ? [{ label: "Référence", value: push.reference }] : []),
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center">
                        <span className="text-gray-500 text-[11px]">{label}</span>
                        <span className="text-gray-200 text-[11px] font-semibold text-right max-w-40 truncate">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleRefuser} disabled={loading}
                      className="py-3 rounded-2xl bg-gray-800 border border-gray-600 text-gray-300 text-sm font-bold hover:bg-gray-700 disabled:opacity-50">
                      Annuler
                    </button>
                    <button onClick={() => setEtape("popup2")}
                      className={`py-3 rounded-2xl text-sm font-bold shadow-lg ${op.bgClass} ${op.textClass}`}>
                      Continuer
                    </button>
                  </div>
                </div>
              )}

              {/* ── POPUP 2 ── */}
              {etape === "popup2" && push && op && (
                <div className="pt-3">
                  <div className={`rounded-2xl overflow-hidden mb-4 ${op.bgClass}`}>
                    <div className="px-4 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center">
                        <span className={`text-[10px] font-extrabold ${op.textClass}`}>{op.code}</span>
                      </div>
                      <p className={`font-bold text-sm ${op.textClass}`}>{op.label}</p>
                      <div className="ml-auto bg-white/20 px-2 py-0.5 rounded-full">
                        <span className={`text-[10px] font-bold ${op.textClass}`}>{formatTimer(timerSeconds)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900 rounded-2xl px-4 py-4 mb-4 text-center">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wide">Montant à payer</p>
                    <p className="text-white text-2xl font-extrabold mt-1">{formatMontant(push.montant)}</p>
                    <p className="text-gray-500 text-[11px] mt-1">{push.commerce}</p>
                  </div>

                  <div className="mb-4">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wide text-center mb-3">
                      Entrez votre code MoMo
                    </p>
                    <div className="flex gap-3 justify-center mb-3">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div key={i}
                          className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all ${
                            i < pin.length ? `border-transparent ${op.bgClass}` : "border-gray-700 bg-gray-900"
                          }`}>
                          {i < pin.length && <span className={`w-2.5 h-2.5 rounded-full ${op.dotClass}`} />}
                        </div>
                      ))}
                    </div>
                    <input type="password" value={pin} autoFocus
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Code MoMo"
                      className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 text-white text-sm text-center outline-none focus:border-green-500 placeholder-gray-600 tracking-widest" />
                  </div>

                  {errorMsg && (
                    <p className="text-red-400 text-xs text-center mb-3">{errorMsg}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { setEtape("popup1"); setPin(""); setErrorMsg(""); }}
                      className="py-3 rounded-2xl bg-gray-800 border border-gray-600 text-gray-300 text-sm font-bold hover:bg-gray-700">
                      Retour
                    </button>
                    <button onClick={handleConfirmer} disabled={pin.length < 4 || loading}
                      className={`py-3 rounded-2xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transition-all ${
                        pin.length >= 4 ? `${op.bgClass} ${op.textClass}` : "bg-gray-700 text-gray-400"
                      }`}>
                      {loading ? "..." : "Valider"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── SUCCÈS ── */}
              {etape === "succes" && (
                <div className="flex flex-col items-center pt-12 gap-5 text-center">
                  <div className="w-20 h-20 rounded-full bg-green-900/40 flex items-center justify-center border-2 border-green-500">
                    <svg viewBox="0 0 24 24" className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-lg font-extrabold">Paiement validé !</p>
                    <p className="text-green-400 text-xs mt-1">Transaction effectuée avec succès</p>
                  </div>
                  <button onClick={reset}
                    className="w-full bg-green-600 text-white text-sm font-bold py-3 rounded-2xl hover:bg-green-700">
                    Retour à l'accueil
                  </button>
                </div>
              )}

              {/* ── REFUS ── */}
              {etape === "refuse" && (
                <div className="flex flex-col items-center pt-12 gap-5 text-center">
                  <div className="w-20 h-20 rounded-full bg-red-900/40 flex items-center justify-center border-2 border-red-500">
                    <svg viewBox="0 0 24 24" className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-lg font-extrabold">Paiement annulé</p>
                    <p className="text-gray-400 text-xs mt-1">La transaction a été refusée</p>
                  </div>
                  <button onClick={reset}
                    className="w-full border border-gray-600 text-gray-300 text-sm font-bold py-3 rounded-2xl hover:bg-gray-800">
                    Retour à l'accueil
                  </button>
                </div>
              )}

              {/* ── EXPIRÉ ── */}
              {etape === "expire" && (
                <div className="flex flex-col items-center pt-12 gap-5 text-center">
                  <div className="w-20 h-20 rounded-full bg-yellow-900/40 flex items-center justify-center border-2 border-yellow-500">
                    <svg viewBox="0 0 24 24" className="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-lg font-extrabold">Demande expirée</p>
                    <p className="text-gray-400 text-xs mt-1">Le délai de paiement est écoulé</p>
                  </div>
                  <button onClick={reset}
                    className="w-full border border-gray-600 text-gray-300 text-sm font-bold py-3 rounded-2xl hover:bg-gray-800">
                    Retour à l'accueil
                  </button>
                </div>
              )}

            </div>
          </div>

          {/* Bouton home */}
          <div className="flex justify-center mt-2 mb-0.5">
            <div className="w-12 h-1 bg-gray-600 rounded-full" />
          </div>
        </div>

        <p className="text-gray-700 text-[10px] text-center mt-4">
          Paycom Mobile Money
        </p>
      </div>
    </div>
  );
}

