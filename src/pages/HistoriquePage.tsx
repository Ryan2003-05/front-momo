import { useCallback, useEffect, useMemo, useState } from "react";
import MerchantLayout from "../components/MerchantLayout";
import Toast from "../components/Toast";
import api from "../api";
import { formatMobileMoneyNumber, operatorBadgeClass as getOperatorBadgeClass } from "../utils/mobileMoney";

// ─── Types ────────────────────────────────────────────────────────────────────

type TxStatus    = "SUCCESS" | "FAILED" | "EN_ATTENTE";
type TxDisplayStatus = TxStatus | "ANNULEE";
type FilterStatus = "tous" | TxDisplayStatus;

interface SessionPaiement {
  montant: string;
  libelle: string;
  type_paiement: string;
  statut?: string;
  compte_operateur: { operateur: { nom: string } };
}

interface Recu {
  id: string;
  reference: string;
}

interface Transaction {
  id: string;
  reference_gateway: string;
  statut: TxStatus;
  numero_client: string;
  created_at: string;
  session_paiement: SessionPaiement;
  recu: Recu | null;
}

interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  current_page: number;
  last_page: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const statusBadgeClass: Record<TxDisplayStatus, string> = {
  SUCCESS:    "bg-green-100 text-green-700",
  FAILED:     "bg-red-100 text-red-700",
  EN_ATTENTE: "bg-yellow-100 text-yellow-700",
  ANNULEE:    "bg-gray-100 text-gray-700",
};

const statusLabel: Record<TxDisplayStatus, string> = {
  SUCCESS:    "Succès",
  FAILED:     "Échec",
  EN_ATTENTE: "En attente",
  ANNULEE:    "Annulée",
};

const iconClass: Record<TxDisplayStatus, string> = {
  SUCCESS:    "bg-green-100 text-green-700",
  FAILED:     "bg-red-100 text-red-700",
  EN_ATTENTE: "bg-yellow-100 text-yellow-700",
  ANNULEE:    "bg-gray-100 text-gray-700",
};

function getOpCode(nom: string): string {
  if (nom === "MTN")    return "MT";
  if (nom === "Moov")   return "MV";
  if (nom === "Celtiis") return "CL";
  return nom.slice(0, 2).toUpperCase();
}

function formatDate(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
}

const filterStatusOptions: FilterStatus[] = ["tous", "SUCCESS", "FAILED", "ANNULEE", "EN_ATTENTE"];
const filterStatusLabels: Record<FilterStatus, string> = {
  tous:       "Tous",
  SUCCESS:    "Réussis",
  FAILED:     "Échoués",
  ANNULEE:    "Annulées",
  EN_ATTENTE: "En attente",
};
const TRANSACTIONS_UPDATED_EVENT = "paypme:transactions-updated";
const TRANSACTIONS_UPDATED_KEY = "paypme:transactions-updated-at";

function getDisplayStatus(tx: Transaction): TxDisplayStatus {
  return tx.session_paiement.statut === "ANNULEE" ? "ANNULEE" : tx.statut;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function HistoriquePage() {
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [loading, setLoading]             = useState(true);
  const [searchTerm, setSearchTerm]       = useState("");
  const [filterOp, setFilterOp]           = useState("");
  const [filterType, setFilterType]       = useState("");
  const [filterPeriode, setFilterPeriode] = useState("");
  const [filterStatus, setFilterStatus]   = useState<FilterStatus>("tous");
  const [selectedTx, setSelectedTx]       = useState<Transaction | null>(null);
  const [downloading, setDownloading]     = useState(false);
  const [toastMessage, setToastMessage]   = useState("");
  const [toastType, setToastType]         = useState<"success" | "error" | "info">("error");

  function showToast(message: string, type: "success" | "error" | "info" = "error") {
    setToastMessage(message);
    setToastType(type);
  }

  const fetchTransactions = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPeriode) params.append("periode", filterPeriode);
      if (filterStatus !== "tous") params.append("statut", filterStatus);
      if (filterOp) params.append("operateur", filterOp);

      const response = await api.get<{ transactions: PaginatedTransactions }>(
        `/transactions?${params.toString()}`
      );
      setTransactions(response.data.transactions.data);
    } catch {
      showToast("Impossible de charger les transactions.", "error");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [filterPeriode, filterStatus, filterOp]);

  // Charger les transactions
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchTransactions();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchTransactions]);

  useEffect(() => {
    const refresh = () => fetchTransactions(false);
    const onStorage = (event: StorageEvent) => {
      if (event.key === TRANSACTIONS_UPDATED_KEY) refresh();
    };

    window.addEventListener(TRANSACTIONS_UPDATED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener(TRANSACTIONS_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, [fetchTransactions]);

  // Filtre local
  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return transactions.filter((tx) => {
      const nomOp = tx.session_paiement.compte_operateur.operateur.nom;
      const matchSearch = !q
        || tx.reference_gateway.toLowerCase().includes(q)
        || tx.numero_client.includes(q)
        || tx.session_paiement.libelle.toLowerCase().includes(q);
      const matchType = !filterType || tx.session_paiement.type_paiement === filterType;
      const matchOp   = !filterOp   || nomOp === filterOp;
      const matchStatus = filterStatus === "tous" || getDisplayStatus(tx) === filterStatus;
      return matchSearch && matchType && matchOp && matchStatus;
    });
  }, [transactions, searchTerm, filterType, filterOp, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const succes = transactions.filter((t) => t.statut === "SUCCESS");
    const echecs = transactions.filter((t) => t.statut === "FAILED");
    const annulees = transactions.filter((t) => getDisplayStatus(t) === "ANNULEE");
    const volume = succes.reduce((s, t) => s + Number(t.session_paiement.montant), 0);
    const taux   = transactions.length > 0 ? Math.round((succes.length / transactions.length) * 100) : 0;
    const tauxE  = transactions.length > 0 ? Math.round((echecs.length / transactions.length) * 100) : 0;
    return { total: transactions.length, volume, succes: succes.length, echec: echecs.length, annulees: annulees.length, taux, tauxE };
  }, [transactions]);

  // Télécharger le reçu PDF
  const handleDownloadPDF = async (tx: Transaction) => {
    if (!tx.recu || tx.statut !== "SUCCESS") return;
    setDownloading(true);
    try {
      const response = await api.get(`/transactions/${tx.id}/recu`, { responseType: "blob" });
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href  = url;
      link.setAttribute("download", `recu-${tx.recu.reference}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast("Reçu téléchargé avec succès !", "success");
    } catch {
      showToast("Erreur lors du téléchargement du reçu.", "error");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <MerchantLayout>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-500">Total transactions</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
          <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600">depuis le début</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-500">Volume encaissé</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.volume.toLocaleString("fr-FR")} F</p>
          <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] text-emerald-700">total</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-500">Réussies</p>
          <p className="text-2xl font-semibold text-emerald-700">{stats.succes}</p>
          <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] text-emerald-700">{stats.taux}%</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-500">Échouées</p>
          <p className="text-2xl font-semibold text-rose-700">{stats.echec}</p>
          <span className="mt-2 inline-flex rounded-full bg-rose-100 px-2 py-1 text-[10px] text-rose-700">{stats.tauxE}%</span>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">

        {/* Filtres */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
            <div className="relative min-w-52">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Référence, numéro client..."
                className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-700 outline-none focus:border-green-500" />
            </div>
            <select value={filterOp} onChange={(e) => setFilterOp(e.target.value)}
              className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none">
              <option value="">Tous les opérateurs</option>
              <option>MTN</option><option>Moov</option><option>Celtiis</option>
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none">
              <option value="">Tous les types</option>
              <option value="QR_CODE">QR Code</option>
              <option value="LIEN">Lien</option>
              <option value="USSD">USSD</option>
            </select>
            <select value={filterPeriode} onChange={(e) => setFilterPeriode(e.target.value)}
              className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none">
              <option value="">Toutes les dates</option>
              <option value="jour">Aujourd'hui</option>
              <option value="semaine">Cette semaine</option>
              <option value="mois">Ce mois</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterStatusOptions.map((s) => (
              <button key={s} type="button" onClick={() => setFilterStatus(s)}
                className={`h-9 rounded-md px-3 text-sm font-medium transition-colors ${
                  s === filterStatus
                    ? "border border-green-600 bg-emerald-50 text-green-700"
                    : "border border-gray-200 bg-white text-gray-600 hover:border-green-500 hover:text-green-700"
                }`}>
                {filterStatusLabels[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Tableau */}
        {loading ? (
          <div className="py-10 text-center text-sm text-gray-400">Chargement...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Opérateur</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Date & heure</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Reçu</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                      Aucune transaction trouvée
                    </td>
                  </tr>
                ) : filtered.map((tx) => {
                  const nomOp = tx.session_paiement.compte_operateur.operateur.nom;
                  const { date, time } = formatDate(tx.created_at);
                  const displayStatus = getDisplayStatus(tx);
                  return (
                    <tr key={tx.id} className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                      onClick={() => setSelectedTx(tx)}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-semibold shrink-0 ${iconClass[displayStatus]}`}>
                            {getOpCode(nomOp)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-gray-900 max-w-40">{tx.session_paiement.libelle}</div>
                            <div className="mt-0.5 font-mono text-xs text-gray-400">{tx.reference_gateway}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${getOperatorBadgeClass(nomOp)}`}>
                          {nomOp}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{tx.session_paiement.type_paiement}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{formatMobileMoneyNumber(tx.numero_client)}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{date}<br />{time}</td>
                      <td className="px-4 py-4 text-right font-semibold text-gray-900">
                        +{Number(tx.session_paiement.montant).toLocaleString("fr-FR")} F
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${statusBadgeClass[displayStatus]}`}>
                          {statusLabel[displayStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        {tx.statut === "SUCCESS" && tx.recu ? (
                          <button type="button" onClick={() => handleDownloadPDF(tx)} disabled={downloading}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                            ↓ PDF
                          </button>
                        ) : (
                          <button type="button" disabled
                            className="inline-flex items-center rounded-md border border-gray-100 bg-gray-50 px-3 py-1 text-[10px] font-semibold text-gray-300">
                            —
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Panneau détail */}
      {selectedTx && (() => {
        const displayStatus = getDisplayStatus(selectedTx);
        const nomOp = selectedTx.session_paiement.compte_operateur.operateur.nom;
        const { date, time } = formatDate(selectedTx.created_at);
        return (
          <div className="fixed right-0 top-0 z-50 h-full w-72 border-l border-gray-200 bg-white p-5 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-900">Détail transaction</p>
              <button type="button" onClick={() => setSelectedTx(null)}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50">
                ✕
              </button>
            </div>
            <div className={`rounded-xl p-4 text-center text-2xl font-semibold mb-2 ${
              displayStatus === "SUCCESS" ? "bg-green-50 text-green-700"
              : displayStatus === "FAILED" ? "bg-red-50 text-red-700"
              : displayStatus === "ANNULEE" ? "bg-gray-50 text-gray-700"
              : "bg-yellow-50 text-yellow-700"
            }`}>
              +{Number(selectedTx.session_paiement.montant).toLocaleString("fr-FR")} F
            </div>
            <div className="text-center mb-4">
              <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-semibold ${statusBadgeClass[displayStatus]}`}>
                {statusLabel[displayStatus]}
              </span>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { label: "Libellé",    value: selectedTx.session_paiement.libelle },
                { label: "Référence",  value: selectedTx.reference_gateway, mono: true },
                { label: "Opérateur", value: nomOp },
                { label: "Type",      value: selectedTx.session_paiement.type_paiement },
                { label: "Client",    value: formatMobileMoneyNumber(selectedTx.numero_client) },
                { label: "Date",      value: `${date} · ${time}` },
              ].map((row) => (
                <div key={row.label} className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-400">{row.label}</span>
                  <span className={`font-medium text-gray-900 text-right max-w-40 ${row.mono ? "font-mono text-xs" : ""}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            <button type="button"
              disabled={selectedTx.statut !== "SUCCESS" || !selectedTx.recu || downloading}
              onClick={() => handleDownloadPDF(selectedTx)}
              className={`mt-6 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                selectedTx.statut === "SUCCESS" && selectedTx.recu
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "cursor-not-allowed bg-gray-100 text-gray-400"
              }`}>
              {selectedTx.statut === "SUCCESS" && selectedTx.recu
                ? (downloading ? "Téléchargement..." : "↓ Télécharger le reçu PDF")
                : "Reçu non disponible"}
            </button>
          </div>
        );
      })()}

      {/* Toast unifié */}
      {toastMessage && (
        <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage("")} />
      )}

    </MerchantLayout>
  );
}
