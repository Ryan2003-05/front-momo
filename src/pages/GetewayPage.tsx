import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, Lock, Phone, RefreshCw, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Toast from "../components/Toast";
import { API_URL } from "../config";
import {
  MOBILE_MONEY_PLACEHOLDER,
  OPERATOR_LABELS,
  detectMobileMoneyOperator,
  formatMobileMoneyNumber,
  normalizeMobileMoneyDigits,
  operatorBadgeClass,
  operatorLogoClass,
} from "../utils/mobileMoney";

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentStatus = "EN_ATTENTE" | "PAYEE" | "FAILED" | "EXPIREE" | "ANNULEE";

type OperateurAccepte = {
  nom: string;
  numero?: string;
};

type SessionData = {
  session_id: string;
  montant: string;
  libelle: string;
  nom_commerce: string;
  type_paiement: string;
  expires_at: string;
  secondes_restantes: number;
  operateurs_acceptes: string[];
};

// ─── Config ───────────────────────────────────────────────────────────────────

const TRANSACTIONS_UPDATED_EVENT = "paypme:transactions-updated";
const TRANSACTIONS_UPDATED_KEY = "paypme:transactions-updated-at";

function notifyTransactionsUpdated() {
  window.dispatchEvent(new Event(TRANSACTIONS_UPDATED_EVENT));
  localStorage.setItem(TRANSACTIONS_UPDATED_KEY, Date.now().toString());
}

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function GatewayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [session, setSession]               = useState<SessionData | null>(null);
  const [status, setStatus]                 = useState<PaymentStatus>("EN_ATTENTE");
  const [phone, setPhone]                   = useState("");
  const [pin, setPin]                       = useState("");
  const [isProcessing, setIsProcessing]     = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(180);
  const [resultData, setResultData]         = useState<{ reference?: string; montant?: string; operateur?: string } | null>(null);
  const [toastMessage, setToastMessage]     = useState("");
  const [toastType, setToastType]           = useState<"success" | "error" | "info">("error");
  const timerRef = useRef<number | null>(null);
  const finalStatusNotifiedRef = useRef(false);

  function showToast(message: string, type: "success" | "error" | "info" = "error") {
    setToastMessage(message);
    setToastType(type);
  }

  // Charger les infos de la session
  useEffect(() => {
    if (!sessionId) return;
    const fetchSession = async () => {
      try {
        const response = await axios.get(`${API_URL}/gateway/${sessionId}`);
        const data: SessionData = response.data;
        setSession(data);
        setRemainingSeconds(Math.max(0, Math.floor(data.secondes_restantes)));
        if (data.secondes_restantes <= 0) setStatus("EXPIREE");
      } catch (err) {
        const error = err as { response?: { data?: { statut?: string } } };
        const statut = error.response?.data?.statut;
        if (statut === "EXPIREE")       setStatus("EXPIREE");
        else if (statut === "PAYEE")    setStatus("PAYEE");
        else if (statut === "FAILED")   setStatus("FAILED");
        else if (statut === "ANNULEE")  setStatus("ANNULEE");
        else                            setStatus("EXPIREE");
      }
    };
    fetchSession();
  }, [sessionId]);

  useEffect(() => {
    if (status === "EN_ATTENTE" || finalStatusNotifiedRef.current) return;

    finalStatusNotifiedRef.current = true;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    notifyTransactionsUpdated();
  }, [status]);

  // Timer
  useEffect(() => {
    if (status !== "EN_ATTENTE" || !session) return;
    timerRef.current = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          setStatus("EXPIREE");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [status, session]);

  const detectedOperator = useMemo(() => detectMobileMoneyOperator(phone), [phone]);
  const timerDisplay     = useMemo(() => formatTimer(remainingSeconds), [remainingSeconds]);
  const cleanPhone       = normalizeMobileMoneyDigits(phone);
  const canConfirm       = cleanPhone.length >= 8 && pin.length >= 4 && detectedOperator !== null
    && session?.operateurs_acceptes.includes(detectedOperator);

  async function handleConfirm() {
    if (!canConfirm || !sessionId) return;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsProcessing(true);
    try {
      const response = await axios.post(`${API_URL}/gateway/${sessionId}/payer`, {
        numero_client: phone,
        code_momo:     pin,
        forcer_echec:  false,
      });
      const data = response.data;
      if (data.statut === "SUCCESS") {
        setResultData({ reference: data.reference, montant: data.montant, operateur: data.operateur });
        setStatus("PAYEE");
        showToast("Paiement confirmé avec succès !", "success");
      } else {
        setStatus("FAILED");
        showToast("Paiement échoué. Solde insuffisant ou erreur réseau.", "error");
      }
    } catch (err) {
      const error = err as { response?: { data?: { message?: string; statut?: string } } };
      const statut = error.response?.data?.statut;
      if (statut === "EXPIREE") {
        setStatus("EXPIREE");
      } else {
        showToast(error.response?.data?.message || "Erreur lors du paiement.", "error");
        setIsProcessing(false);
      }
    }
  }

  async function handleCancel() {
    if (!sessionId) return;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      await axios.post(`${API_URL}/gateway/${sessionId}/annuler`);
    } catch { /* session peut déjà être expirée */ }
    setStatus("ANNULEE");
  }

  const operateursAcceptes: OperateurAccepte[] = (session?.operateurs_acceptes ?? []).map((nom) => ({ nom }));

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-6 font-sans text-gray-900">
      <section className="grid w-full max-w-5xl items-start gap-4 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">

        {/* Carte principale */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="bg-blue-950 px-6 pt-7 pb-8 text-white">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-sm font-semibold">P</div>
                <span className="text-sm font-semibold">Paycom</span>
              </div>
              <span className="rounded-full border border-green-400/30 bg-green-500/15 px-3 py-1 text-[11px] font-semibold text-green-200">
                Session sécurisée
              </span>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-200">Montant à payer</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">
              {session ? Number(session.montant).toLocaleString("fr-FR") : "..."}
              <span className="text-2xl font-medium text-blue-200"> FCFA</span>
            </p>
          </div>

          <div className="px-6 py-6">

            {/* Formulaire */}
            {status === "EN_ATTENTE" && !isProcessing && (
              <>
                <div className="mb-5 flex items-center gap-3 border-b border-gray-100 pb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
                    {session?.nom_commerce.slice(0, 2).toUpperCase() ?? "??"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{session?.nom_commerce ?? "Chargement..."}</p>
                    <p className="text-xs text-gray-500">{session?.libelle ?? ""}</p>
                  </div>
                </div>

                <div className="mb-5 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <Clock3 className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-medium text-amber-800">
                    Expire dans <span className="font-semibold tabular-nums">{timerDisplay}</span>
                  </p>
                </div>

                {/* Opérateurs acceptés */}
                <div className="mb-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Opérateurs acceptés</p>
                  <div className="flex gap-2 flex-wrap">
                    {(session?.operateurs_acceptes ?? []).map((nom) => (
                      <span key={nom} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${operatorBadgeClass(nom)}`}>
                        <span className={`h-2 w-2 rounded-full ${operatorLogoClass(nom)}`} />
                        {OPERATOR_LABELS[nom] ?? nom}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Numéro */}
                <label className="mb-4 block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Votre numéro MoMo
                  </span>
                  <div className="relative">
                    <Smartphone className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input type="tel" value={phone}
                      onChange={(e) => setPhone(formatMobileMoneyNumber(e.target.value))}
                      placeholder={MOBILE_MONEY_PLACEHOLDER}
                      autoComplete="off"
                      className="h-11 w-full rounded-md border border-gray-200 bg-white pr-4 pl-10 text-sm font-medium text-gray-900 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100" />
                  </div>
                </label>

                {/* Détection opérateur */}
                <div className="mb-5 min-h-9">
                  {detectedOperator ? (
                    session?.operateurs_acceptes.includes(detectedOperator) ? (
                      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${operatorBadgeClass(detectedOperator)}`}>
                        <span className={`h-2 w-2 rounded-full ${operatorLogoClass(detectedOperator)}`} />
                        Opérateur détecté : {OPERATOR_LABELS[detectedOperator]}
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
                        ✕ {OPERATOR_LABELS[detectedOperator] ?? detectedOperator} non accepté par ce commerçant
                      </div>
                    )
                  ) : (
                    <p className="text-xs text-gray-400">Entrez votre numéro pour détecter l'opérateur.</p>
                  )}
                </div>

                {/* Code MoMo */}
                <label className="mb-6 block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Code MoMo
                  </span>
                  <div className="relative">
                    <Lock className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input type="password" value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="_ _ _ _ _ _" maxLength={6}
                      className="h-11 w-full rounded-md border border-gray-200 bg-white pr-4 pl-10 text-center text-lg font-semibold tracking-widest text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-100" />
                  </div>
                </label>

                <button type="button" onClick={handleConfirm} disabled={!canConfirm}
                  className="mb-3 flex h-11 w-full items-center justify-center rounded-md bg-green-600 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300">
                  Confirmer le paiement
                </button>
                <button type="button" onClick={handleCancel}
                  className="flex h-11 w-full items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-600 transition hover:bg-gray-100">
                  Annuler
                </button>
              </>
            )}

            {/* Traitement */}
            {status === "EN_ATTENTE" && isProcessing && (
              <StatePanel
                icon={<RefreshCw className="h-9 w-9 animate-spin text-blue-700" />}
                title="Traitement en cours..."
                description="Validez la demande reçue sur votre téléphone, puis patientez quelques secondes."
              />
            )}

            {/* Succès */}
            {status === "PAYEE" && (
              <StatePanel
                icon={<CheckCircle2 className="h-10 w-10 text-green-600" />}
                title="Paiement réussi !"
                description={`${resultData?.operateur ?? "MoMo"} a confirmé le débit de ${Number(resultData?.montant ?? session?.montant ?? 0).toLocaleString("fr-FR")} FCFA.`}
                extra={resultData?.reference ? (
                  <p className="mt-1 font-mono text-xs text-gray-400">{resultData.reference}</p>
                ) : undefined}
              />
            )}

            {/* Échec / Annulé / Expiré */}
            {(status === "FAILED" || status === "ANNULEE" || status === "EXPIREE") && (
              <StatePanel
                icon={<XCircle className="h-10 w-10 text-red-600" />}
                title={
                  status === "EXPIREE"
                    ? "Session expirée"
                    : status === "FAILED"
                      ? "Paiement échoué"
                      : "Paiement annulé"
                }
                description={
                  status === "EXPIREE"
                    ? "Le délai de paiement est terminé. Demandez un nouveau lien au commerçant."
                    : status === "FAILED"
                      ? "La transaction n'a pas pu être finalisée."
                      : "Cette transaction n'a pas été finalisée."
                }
              />
            )}
          </div>
        </div>

        {/* Aside */}
        <aside className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Détails du paiement</p>
              <p className="mt-1 text-xs text-gray-500">QR code, lien ou push USSD émis par le commerçant.</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-green-600" />
          </div>

          <div className="mb-5 rounded-lg border border-green-100 bg-green-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
                {session?.nom_commerce.slice(0, 2).toUpperCase() ?? "??"}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{session?.nom_commerce ?? "..."}</p>
                <p className="text-xs text-gray-500">{session?.libelle ?? ""}</p>
              </div>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <InfoBox label="Montant"    value={session ? `${Number(session.montant).toLocaleString("fr-FR")} FCFA` : "..."} />
            <InfoBox label="Référence"  value={sessionId?.slice(0, 8).toUpperCase() ?? "..."} />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Opérateurs acceptés</p>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                {operateursAcceptes.length} actif{operateursAcceptes.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-2">
              {operateursAcceptes.map((op) => (
                <div key={op.nom} className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2.5">
                  <span className={`flex h-7 w-10 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white ${operatorLogoClass(op.nom)}`}>
                    {op.nom.slice(0, 3).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-900">{OPERATOR_LABELS[op.nom] ?? op.nom}</p>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-green-600" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-md border border-blue-100 bg-blue-50 p-3">
            <div className="flex gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-blue-800" />
              <p className="text-xs leading-5 text-blue-900">
                Vous recevrez une demande de validation sur votre téléphone. Ne partagez jamais votre code MoMo.
              </p>
            </div>
          </div>
        </aside>
      </section>

      {/* Toast unifié */}
      {toastMessage && (
        <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage("")} />
      )}
    </main>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function StatePanel({ icon, title, description, extra }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">{icon}</div>
      <p className="text-lg font-semibold text-gray-900">{title}</p>
      <p className="mt-2 max-w-xs text-sm leading-6 text-gray-500">{description}</p>
      {extra}
    </div>
  );
}

