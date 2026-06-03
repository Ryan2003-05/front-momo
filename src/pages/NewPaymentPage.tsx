import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import MerchantLayout from "../components/MerchantLayout";
import Toast from "../components/Toast";
import api from "../api";
import { gatewayUrl } from "../config";

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentType = "qr" | "lien" | "ussd";
type PaymentFinalStatus = "PAYEE" | "FAILED" | "ANNULEE" | "EXPIREE";

type Article = {
  id: number;
  nom: string;
  qte: number;
  prix: number;
};

type CompteOperateur = {
  id: string;
  numero: string;
  actif: boolean;
  solde: string;
  operateur: { id: string; nom: string; actif: boolean };
};

type SessionResult = {
  session: { id: string };
  contenu: {
    type: string;
    payload: string;
    message: string;
    lien_gateway?: string;
    numero_client?: string;
  };
  expires_at: string;
};

type SessionDetailResponse = {
  session?: {
    id: string;
    montant?: string;
    statut?: string;
    compte_operateur?: {
      operateur?: {
        nom?: string;
      };
    };
    transaction?: {
      id: string;
      statut?: string;
      numero_client?: string;
      notification?: {
        message?: string;
      };
    } | null;
  };
};

type PushResponse = {
  push_url?: string;
};

// ─── Config ───────────────────────────────────────────────────────────────────

const paymentTypes: Array<{
  key: PaymentType;
  label: string;
  description: string;
  apiType: string;
  icon: ReactElement;
}> = [
    {
      key: "qr", label: "QR Code", description: "Client scanne sur place", apiType: "QR_CODE",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="3" height="3" />
        </svg>
      ),
    },
    {
      key: "lien", label: "Lien", description: "WhatsApp / SMS", apiType: "LIEN",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
          <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
        </svg>
      ),
    },
    {
      key: "ussd", label: "Push USSD", description: "Téléphone basique", apiType: "USSD",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12.5a10 10 0 0 1 14 0" />
          <path d="M8.5 16a5 5 0 0 1 7 0" />
          <path d="M12 20h.01" />
        </svg>
      ),
    },
  ];

const btnLabels: Record<PaymentType, string> = {
  qr: "Générer le QR code",
  lien: "Générer le lien",
  ussd: "Envoyer le Push USSD",
};

const typeNames: Record<PaymentType, string> = {
  qr: "QR Code",
  lien: "Lien de paiement",
  ussd: "Push USSD",
};

const finalStatusView: Record<PaymentFinalStatus, {
  box: string;
  icon: string;
  title: string;
  titleClass: string;
  message: string;
  messageClass: string;
}> = {
  PAYEE: {
    box: "border-green-200 bg-green-50",
    icon: "bg-green-500",
    title: "Paiement reçu !",
    titleClass: "text-green-700",
    message: "Mise à jour en cours...",
    messageClass: "text-green-600",
  },
  FAILED: {
    box: "border-red-200 bg-red-50",
    icon: "bg-red-500",
    title: "Paiement échoué",
    titleClass: "text-red-700",
    message: "La transaction a été enregistrée.",
    messageClass: "text-red-600",
  },
  ANNULEE: {
    box: "border-gray-200 bg-gray-50",
    icon: "bg-gray-500",
    title: "Paiement annulé",
    titleClass: "text-gray-700",
    message: "La transaction a été enregistrée.",
    messageClass: "text-gray-600",
  },
  EXPIREE: {
    box: "border-yellow-200 bg-yellow-50",
    icon: "bg-yellow-500",
    title: "Session expirée",
    titleClass: "text-yellow-700",
    message: "La transaction a été enregistrée.",
    messageClass: "text-yellow-600",
  },
};

const opColors: Record<string, string> = {
  MTN: "bg-amber-500",
  Moov: "bg-blue-600",
  Celtiis: "bg-purple-600",
};

const opCodes: Record<string, string> = {
  MTN: "MTN",
  Moov: "MOV",
  Celtiis: "CEL",
};

const TRANSACTIONS_UPDATED_EVENT = "paypme:transactions-updated";
const TRANSACTIONS_UPDATED_KEY = "paypme:transactions-updated-at";

function notifyTransactionsUpdated() {
  window.dispatchEvent(new Event(TRANSACTIONS_UPDATED_EVENT));
  localStorage.setItem(TRANSACTIONS_UPDATED_KEY, Date.now().toString());
}

function formatMoney(value: number) {
  return `${value.toLocaleString("fr-FR")} FCFA`;
}

function formatLineMoney(value: number) {
  return `${value.toLocaleString("fr-FR")} F`;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function NewPaymentPage() {
  const [currentType, setCurrentType] = useState<PaymentType>("qr");
  const [articles, setArticles] = useState<Article[]>([{ id: 1, nom: "", qte: 1, prix: 0 }]);
  const [nextId, setNextId] = useState(2);
  const [ussdNumber, setUssdNumber] = useState("");
  const [selectedCompte, setSelectedCompte] = useState<string>("");
  const [comptes, setComptes] = useState<CompteOperateur[]>([]);
  const [comptesLoading, setComptesLoading] = useState(true);
  const [comptesError, setComptesError] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(180);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string>("");
  const [lienGateway, setLienGateway] = useState<string>("");
  const [pushClientUrl, setPushClientUrl] = useState<string>("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">("error");
  const timerRef = useRef<number | null>(null);
  const [, setSessionId] = useState<string | null>(null);
  const [paiementStatut, setPaiementStatut] = useState<PaymentFinalStatus | null>(null);
  const pollSessionRef = useRef<number | null>(null);

  function showToast(message: string, type: "success" | "error" | "info" = "error") {
    setToastMessage(message);
    setToastType(type);
  }

  // Charger les comptes opérateurs actifs
  useEffect(() => {
    const fetchComptes = async () => {
      setComptesLoading(true);
      setComptesError("");
      try {
        const response = await api.get<{ comptes: CompteOperateur[] }>("/commercant/comptes-operateurs");
        const actifs = (response.data.comptes ?? []).filter((c) => c.actif && c.operateur?.actif);
        setComptes(actifs);
        if (actifs.length > 0) setSelectedCompte(actifs[0].id);
      } catch {
        const message = "Impossible de charger vos comptes opérateurs.";
        setComptesError(message);
        showToast(message, "error");
      } finally {
        setComptesLoading(false);
      }
    };
    fetchComptes();
  }, []);

  // Nettoyage timer
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }

      if (pollSessionRef.current) {
        window.clearInterval(pollSessionRef.current);
      }
    };
  }, []);
  const total = useMemo(
    () => articles.reduce((sum, a) => sum + a.qte * a.prix, 0),
    [articles],
  );

  const libelle = useMemo(
    () => articles.filter((a) => a.nom.trim()).map((a) => `${a.nom}${a.qte > 1 ? ` x${a.qte}` : ""}`).join(", "),
    [articles],
  );

  const timerDisplay = useMemo(() => {
    const m = Math.floor(timerSeconds / 60).toString().padStart(2, "0");
    const s = (timerSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [timerSeconds]);

  function startTimer() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setTimerSeconds(180);
    timerRef.current = window.setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) { if (timerRef.current) window.clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function startPollingSession(id: string) {
    if (pollSessionRef.current) {
      window.clearInterval(pollSessionRef.current);
    }

    pollSessionRef.current = window.setInterval(async () => {
      try {
        const res = await api.get<SessionDetailResponse>(`/paiement/session/${id}`);

        const session = res.data.session;
        const statut = session?.statut;
        const transaction = session?.transaction;

        const sessionTerminee =
          transaction ||
          statut === "PAYEE" ||
          statut === "ANNULEE" ||
          statut === "EXPIREE";

        if (sessionTerminee) {
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }

          if (pollSessionRef.current) {
            window.clearInterval(pollSessionRef.current);
            pollSessionRef.current = null;
          }

          setPaiementStatut(
            statut === "PAYEE"
              ? "PAYEE"
              : statut === "ANNULEE"
                ? "ANNULEE"
                : statut === "EXPIREE"
                  ? "EXPIREE"
                  : "FAILED"
          );

          const montant = session?.montant ?? "0";

          const operateur =
            session?.compte_operateur?.operateur?.nom ??
            "Mobile Money";

          const notificationMessage =
            transaction?.notification?.message ??
            `Vous venez de recevoir un paiement de ${Number(montant).toLocaleString(
              "fr-FR"
            )} FCFA. Numero: ${transaction?.numero_client ?? "N/A"}. Operateur: ${operateur}.`;

          showToast(
            notificationMessage,
            statut === "PAYEE" ? "success" : "info"
          );

          notifyTransactionsUpdated();

          window.setTimeout(() => {
            setResult(null);
            setQrImageUrl("");
            setLienGateway("");
            setPushClientUrl("");
            setSessionId(null);
            setPaiementStatut(null);
            setTimerSeconds(180);
            setArticles([
              {
                id: 1,
                nom: "",
                qte: 1,
                prix: 0,
              },
            ]);
            setNextId(2);
            setUssdNumber("");
          }, 4000);
        }
      } catch {
        // ignore
      }
    }, 3000);
  }

  function addArticle() {
    setArticles((prev) => [...prev, { id: nextId, nom: "", qte: 1, prix: 0 }]);
    setNextId((prev) => prev + 1);
  }

  function removeArticle(id: number) {
    setArticles((prev) => prev.length === 1 ? prev : prev.filter((a) => a.id !== id));
  }

  function updateArticle(id: number, field: keyof Omit<Article, "id">, value: string) {
    setArticles((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      if (field === "nom") return { ...a, nom: value };
      if (field === "qte") return { ...a, qte: Math.max(1, parseInt(value || "1", 10) || 1) };
      return { ...a, prix: Math.max(0, parseInt(value || "0", 10) || 0) };
    }));
  }

  async function handleGenerate() {
    if (!selectedCompte) {
      showToast("Veuillez sélectionner un compte opérateur.", "error");
      return;
    }
    if (total === 0) {
      showToast("Ajoutez au moins un article avec un montant.", "error");
      return;
    }
    if (currentType === "ussd" && !ussdNumber.trim()) {
      showToast("Veuillez saisir le numéro du client.", "error");
      return;
    }

    setLoading(true);
    setResult(null);
    setQrImageUrl("");
    setLienGateway("");
    setPushClientUrl("");

    try {
      const apiType = paymentTypes.find((t) => t.key === currentType)?.apiType ?? "QR_CODE";
      const produits = articles
        .filter((a) => a.nom.trim() && a.prix > 0)
        .map((a) => ({ nom: a.nom, quantite: a.qte, prix_unitaire: a.prix }));

      const body: Record<string, unknown> = {
        compte_operateur_id: selectedCompte,
        montant: total,
        libelle: libelle || "Paiement",
        type_paiement: apiType,
        produits: produits.length > 0 ? produits : undefined,
      };

      if (currentType === "ussd") body.numero_client = ussdNumber;

      const response = await api.post<SessionResult>("/paiement/session", body);
      setResult(response.data);
      startTimer();
      setSessionId(response.data.session.id);
      startPollingSession(response.data.session.id);

      // QR Code
      if (currentType === "qr") {
        const sessionId = response.data.session.id;
        try {
          const qrResponse = await api.get(`/gateway/${sessionId}/qrcode`, { responseType: "blob" });
          const url = window.URL.createObjectURL(new Blob([qrResponse.data], { type: "image/svg+xml" }));
          setQrImageUrl(url);
        } catch {
          showToast("Impossible de générer le QR code.", "error");
        }
      }

      // Lien
      if (currentType === "lien") {
        const sessionId = response.data.session.id;
        setLienGateway(gatewayUrl(sessionId));
      }

      // USSD — envoyer le push
      if (currentType === "ussd") {
        const sessionId = response.data.session.id;
        const pushResponse = await api.post<PushResponse>(`/gateway/${sessionId}/push`, { numero_client: ussdNumber });
        setPushClientUrl(pushResponse.data.push_url ?? "");
        showToast(`✓ Push USSD envoyé au ${ussdNumber}`, "success");
      }

    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      showToast(error.response?.data?.message || "Une erreur est survenue.", "error");
    } finally {
      setLoading(false);
    }
  }

  function handleCopyLien() {
    navigator.clipboard.writeText(lienGateway)
      .then(() => showToast("Lien copié dans le presse-papiers !", "success"))
      .catch(() => showToast("Impossible de copier le lien.", "error"));
  }

  const compteSelectionne = comptes.find((c) => c.id === selectedCompte);

  const messagePartage = lienGateway
    ? `Bonjour ! Veuillez effectuer votre paiement de ${Number(total).toLocaleString("fr-FR")} FCFA via ${compteSelectionne?.operateur?.nom ?? ""} MoMo.\n\n${lienGateway}\n\nExpire dans 3 minutes.`
    : "";

  const encoded = encodeURIComponent(messagePartage);

  return (
    <MerchantLayout>
      <div className="flex gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">

          {/* Type de paiement */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-3.5 text-[13px] font-medium text-gray-900">Type de paiement</p>
            <div className="grid grid-cols-3 gap-2">
              {paymentTypes.map((type) => {
                const active = currentType === type.key;
                return (
                  <button key={type.key} type="button"
                    onClick={() => { setCurrentType(type.key); setResult(null); setQrImageUrl(""); setLienGateway(""); setPushClientUrl(""); }}
                    className={`rounded-md border px-2 py-2.5 text-center transition ${active ? "border-green-600 bg-green-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                    <span className={`mb-1 flex justify-center ${active ? "text-green-700" : "text-gray-600"}`}>{type.icon}</span>
                    <span className={`block text-xs font-medium ${active ? "text-green-700" : "text-gray-600"}`}>{type.label}</span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-gray-400">{type.description}</span>
                  </button>
                );
              })}
            </div>

            {currentType === "ussd" && (
              <label className="mt-2.5 block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">Numéro du client</span>
                <input type="tel" value={ussdNumber} onChange={(e) => setUssdNumber(e.target.value)}
                  placeholder="01 97 00 00 00"
                  className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-[13px] text-gray-900 outline-none focus:border-green-600" />
              </label>
            )}
          </section>

          {/* Compte de réception */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-3 text-[13px] font-medium text-gray-900">Compte de réception</p>
            {comptesLoading ? (
              <p className="text-xs text-gray-400">Chargement des comptes...</p>
            ) : comptesError ? (
              <p className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                {comptesError}
              </p>
            ) : comptes.length === 0 ? (
              <p className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Aucun compte opérateur actif trouvé. Vérifiez votre profil ou contactez l'administrateur.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {comptes.map((c) => (
                  <button key={c.id} type="button" onClick={() => setSelectedCompte(c.id)}
                    className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-left transition ${selectedCompte === c.id ? "border-green-600 bg-green-50" : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}>
                    <span className={`flex h-5 w-8 shrink-0 items-center justify-center rounded text-[9px] font-medium text-white ${opColors[c.operateur.nom] ?? "bg-gray-400"}`}>
                      {opCodes[c.operateur.nom] ?? c.operateur.nom.slice(0, 3)}
                    </span>
                    <span className="text-[13px] text-gray-900">{c.operateur.nom} MoMo</span>
                    <span className="ml-auto text-[11px] text-gray-400">{c.numero}</span>
                    {selectedCompte === c.id && <span className="h-2 w-2 rounded-full bg-green-600" />}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Articles */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-gray-900">Articles</p>
              <span className="text-[11px] text-gray-400">Le libellé et le total sont générés automatiquement</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-96 border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                    <th className="w-[40%] px-1 pb-2 text-left font-medium">Article</th>
                    <th className="w-[15%] px-1 pb-2 text-center font-medium">Qté</th>
                    <th className="w-[25%] px-1 pb-2 text-right font-medium">Prix unit.</th>
                    <th className="w-[15%] px-1 pb-2 text-right font-medium">Total</th>
                    <th className="w-[5%] px-1 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {articles.map((a) => (
                    <tr key={a.id}>
                      <td className="p-1">
                        <input value={a.nom} onChange={(e) => updateArticle(a.id, "nom", e.target.value)}
                          placeholder="Nom article"
                          className="h-8 w-full rounded-md border border-gray-200 px-2 text-xs text-gray-900 outline-none focus:border-green-600" />
                      </td>
                      <td className="p-1">
                        <input type="number" min={1} value={a.qte} onChange={(e) => updateArticle(a.id, "qte", e.target.value)}
                          className="h-8 w-full rounded-md border border-gray-200 px-2 text-center text-xs text-gray-900 outline-none focus:border-green-600" />
                      </td>
                      <td className="p-1">
                        <input type="number" min={0} value={a.prix || ""} onChange={(e) => updateArticle(a.id, "prix", e.target.value)}
                          placeholder="0"
                          className="h-8 w-full rounded-md border border-gray-200 px-2 text-right text-xs text-gray-900 outline-none focus:border-green-600" />
                      </td>
                      <td className="p-1 text-right text-xs font-medium whitespace-nowrap text-gray-900">
                        {formatLineMoney(a.qte * a.prix)}
                      </td>
                      <td className="p-1">
                        <button type="button" onClick={() => removeArticle(a.id)}
                          className="flex p-1 text-gray-400 hover:text-red-600" aria-label="Supprimer">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addArticle}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 bg-white px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Ajouter un article
            </button>
            <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
              <span className="text-xs text-gray-600">Total à payer</span>
              <span className="text-lg font-medium text-gray-900">{formatMoney(total)}</span>
            </div>
          </section>

          {/* Bouton générer */}
          <button type="button" onClick={handleGenerate} disabled={loading}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-green-600 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            {loading ? "Génération en cours..." : btnLabels[currentType]}
          </button>
        </div>

        {/* Aside */}
        <aside className="w-56 shrink-0">
          <section className="mb-2 rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-2.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">Aperçu</p>
            <div className="my-2 text-center text-2xl font-medium text-gray-900">{formatMoney(total)}</div>
            <div className={`text-center text-[11px] leading-relaxed ${libelle ? "text-gray-600" : "italic text-gray-400"}`}>
              {libelle || "Aucun article ajouté"}
            </div>

            {/* Paiement validé */}
            {paiementStatut ? (() => {
              const statusView = finalStatusView[paiementStatut];
              return (
              <div className={`mt-3 rounded-xl border p-4 text-center ${statusView.box}`}>
                <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full ${statusView.icon}`}>
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                  >
                    {paiementStatut === "PAYEE" ? (
                      <polyline points="20 6 9 17 4 12" />
                    ) : paiementStatut === "EXPIREE" ? (
                      <>
                        <circle cx="12" cy="12" r="9" />
                        <polyline points="12 7 12 12 15 14" />
                      </>
                    ) : (
                      <>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </>
                    )}
                  </svg>
                </div>

                <p className={`text-sm font-bold ${statusView.titleClass}`}>
                  {statusView.title}
                </p>

                <p className={`mt-1 text-[11px] ${statusView.messageClass}`}>
                  {statusView.message}
                </p>
              </div>
              );
            })() : (
              <>
                {/* QR Code */}
                {currentType === "qr" && (
                  <div className="mt-3">
                    {qrImageUrl ? (
                      <img
                        src={qrImageUrl}
                        alt="QR Code de paiement"
                        className="mx-auto h-28 w-28 rounded-md border border-gray-200"
                      />
                    ) : (
                      <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-md border border-gray-200 bg-gray-50">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-10 w-10 text-gray-300"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                        >
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                          <rect x="11" y="11" width="3" height="3" />
                        </svg>
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-gray-600">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>

                      Expire dans{" "}
                      <span
                        className={`text-xs font-medium ${timerSeconds <= 30
                            ? "text-red-600"
                            : "text-red-700"
                          }`}
                      >
                        {timerDisplay}
                      </span>
                    </div>
                  </div>
                )}

                {/* Lien */}
                {currentType === "lien" && lienGateway && (
                  <div className="mt-3">
                    <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 p-2">
                      <p className="mb-1 text-[10px] text-gray-400">
                        Lien de paiement
                      </p>

                      <a
                        href={lienGateway}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-[10px] text-green-600 underline hover:text-green-700"
                      >
                        {lienGateway}
                      </a>
                    </div>

                    <div className="flex flex-col gap-2">
                      {/* WhatsApp */}
                      <a
                        href={`https://api.whatsapp.com/send?text=${encoded}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold text-white"
                        style={{ backgroundColor: "#25D366" }}
                      >
                        Partager par WhatsApp
                      </a>

                      {/* SMS */}
                      <a
                        href={`sms:?&body=${encoded}`}
                        className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-500 py-2 text-xs font-semibold text-white hover:bg-blue-600"
                      >
                        Partager par SMS
                      </a>

                      {/* Copier */}
                      <button
                        type="button"
                        onClick={handleCopyLien}
                        className="flex w-full items-center justify-center gap-2 rounded-md bg-gray-100 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200"
                      >
                        Copier le lien
                      </button>
                    </div>

                    <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-gray-500">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>

                      Expire dans{" "}
                      <span className="font-medium text-red-600">
                        {timerDisplay}
                      </span>
                    </div>
                  </div>
                )}

                {/* USSD */}
                {currentType === "ussd" && result && (
                  <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-[11px] text-green-700">
                    ✓ Push USSD envoyé au {ussdNumber}

                    {pushClientUrl && (
                      <a
                        href={pushClientUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block break-all rounded-md bg-white px-2 py-1 text-green-700 underline"
                      >
                        Ouvrir le simulateur client
                      </a>
                    )}

                    <div className="mt-1 flex items-center gap-1 text-gray-500">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>

                      Expire dans{" "}
                      <span className="font-medium text-red-600">
                        {timerDisplay}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Récapitulatif */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-2.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">Récapitulatif</p>
            <div className="mb-1.5 flex flex-col gap-0.5">
              {articles.filter((a) => a.nom.trim()).map((a) => (
                <div key={a.id} className="flex justify-between gap-2 py-0.5 text-[11px] text-gray-600">
                  <span className="min-w-0 flex-1 truncate">{a.nom}{a.qte > 1 ? ` x${a.qte}` : ""}</span>
                  <span className="font-medium text-gray-900">{formatLineMoney(a.qte * a.prix)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 pt-1.5 text-[11px]">
              <InfoRow label="Type" value={typeNames[currentType]} />
              <InfoRow label="Opérateur" value={compteSelectionne ? `${compteSelectionne.operateur.nom} · ${compteSelectionne.numero}` : "—"} />
              <InfoRow label="Total" value={formatMoney(total)} />
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-600">Expiration</span>
                <span className="rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] text-yellow-800">3 min</span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Toast unifié */}
      {toastMessage && (
        <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage("")} />
      )}
    </MerchantLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 py-1">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900 text-right max-w-32 truncate">{value}</span>
    </div>
  );
}

