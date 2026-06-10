import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MerchantLayout from "../components/MerchantLayout";
import Toast from "../components/Toast";
import api from "../api";
import { formatMobileMoneyNumber, operatorHex } from "../utils/mobileMoney";

// ─── Types ────────────────────────────────────────────────────────────────────

type TxStatus = "SUCCESS" | "FAILED" | "EN_ATTENTE";
type Periode  = "jour" | "semaine" | "mois";

const TRANSACTIONS_UPDATED_EVENT = "paypme:transactions-updated";
const TRANSACTIONS_UPDATED_KEY = "paypme:transactions-updated-at";

interface Transaction {
  id: string;
  reference_gateway: string;
  statut: TxStatus;
  numero_client: string;
  created_at: string;
  operateur: { nom: string };
  session_paiement: {
    montant: string;
    libelle: string;
    type_paiement: string;
    statut?: string;
  };
}

interface DayStats {
  jour: string;
  reussies: number;
  echouees: number;
}

interface OperateurStats {
  count: number;
  volume: number;
}

interface DashboardData {
  periode: string;
  solde_total: string;
  stats: {
    total: number;
    reussies: number;
    echouees: number;
    en_attente: number;
    taux_succes: number;
    volume: number;
  };
  par_operateur: Record<string, OperateurStats>;
  stats_7_jours: DayStats[];
  recentes: Transaction[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusClasses(status: TxStatus) {
  if (status === "SUCCESS") return { badge: "bg-green-100 text-green-700", icon: "bg-green-100 text-green-700", label: "Succès" };
  if (status === "FAILED")  return { badge: "bg-red-100 text-red-700",    icon: "bg-red-100 text-red-700",    label: "Échec" };
  return { badge: "bg-yellow-100 text-yellow-700", icon: "bg-yellow-100 text-yellow-700", label: "EN_ATTENTE" };
}

function getOperateurCode(nom: string): string {
  if (nom === "MTN")    return "MT";
  if (nom === "Moov")   return "MV";
  if (nom === "Celtiis") return "CL";
  return nom.slice(0, 2).toUpperCase();
}

function formatMontant(montant: string | number): string {
  return Number(montant).toLocaleString("fr-FR") + " F";
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return "à l'instant";
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();

  const [showBalance, setShowBalance]   = useState(false);
  const [periode, setPeriode]           = useState<Periode>("jour");
  const [data, setData]                 = useState<DashboardData | null>(null);
  const [loading, setLoading]           = useState(true);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType]       = useState<"success" | "error" | "info">("error");

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "error") => {
    setToastMessage(message);
    setToastType(type);
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await api.get(`/dashboard?periode=${periode}`);
      setData(response.data);
    } catch (error) {
      console.error("Dashboard Error:", error);
      showToast("Impossible de charger le tableau de bord.", "error");
    } finally {
      setLoading(false);
    }
  }, [periode, showToast]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchDashboard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchDashboard]);

  useEffect(() => {
    const refresh = () => fetchDashboard();
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
  }, [fetchDashboard]);

  const maxY = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.stats_7_jours.map((d) => Math.max(d.reussies, d.echouees)), 1);
  }, [data]);

  const operateurEntries = data ? Object.entries(data.par_operateur) : [];
  const totalOp = operateurEntries.reduce((s, [, v]) => s + v.count, 0);

  let cumul = 0;
  const donutSegments = operateurEntries.map(([nom, val]) => {
    const pct   = totalOp > 0 ? (val.count / totalOp) * 100 : 0;
    const start = cumul;
    cumul += pct;
    return { nom, pct: Math.round(pct), start, color: operatorHex(nom) };
  });

  const donutGradient = donutSegments.length > 0
    ? donutSegments.map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(",")
    : "#e5e7eb 0% 100%";

  if (loading) {
    return (
      <MerchantLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-sm text-gray-400">Chargement du tableau de bord...</div>
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout>
      <div className="space-y-3">

        {/* Filtre période */}
        <div className="flex gap-2">
          {(["jour", "semaine", "mois"] as Periode[]).map((p) => (
            <button key={p} onClick={() => setPeriode(p)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                periode === p ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}>
              {p === "jour" ? "Aujourd'hui" : p === "semaine" ? "Cette semaine" : "Ce mois"}
            </button>
          ))}
        </div>

        {/* Alerte transactions en attente */}
        {data && data.stats.en_attente > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Alerte rapide</p>
                <p className="mt-2 text-sm text-gray-600">
                  {data.stats.en_attente} transaction{data.stats.en_attente > 1 ? "s" : ""} au statut EN_ATTENTE depuis plus de 10 min
                </p>
              </div>
              <button onClick={() => navigate("/historique")}
                className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-100">
                Voir
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <section className="grid grid-cols-4 gap-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">Solde total</p>
            <p className="text-xl font-semibold text-gray-900">
              {showBalance ? formatMontant(data?.solde_total ?? 0) : "••••••"}
            </p>
            <button onClick={() => setShowBalance((s) => !s)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700">
              {showBalance ? "Masquer" : "Afficher"}
            </button>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">Transactions</p>
            <p className="text-xl font-semibold">{data?.stats.total ?? 0}</p>
            <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
              {periode === "jour" ? "aujourd'hui" : periode === "semaine" ? "cette semaine" : "ce mois"}
            </span>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">Réussies</p>
            <p className="text-xl font-semibold text-green-700">{data?.stats.reussies ?? 0}</p>
            <span className="mt-1 inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
              {data?.stats.taux_succes ?? 0}%
            </span>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">Échouées</p>
            <p className="text-xl font-semibold text-red-700">{data?.stats.echouees ?? 0}</p>
            <span className="mt-1 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
              {data && data.stats.total > 0 ? Math.round((data.stats.echouees / data.stats.total) * 100) : 0}%
            </span>
          </div>
        </section>

        {/* Graphiques */}
        <section className="grid grid-cols-3 gap-2">
          <div className="col-span-2 rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold">Transactions des 7 derniers jours</h3>
            <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-gray-600">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-green-600" /> Réussies</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-red-500" /> Échouées</span>
            </div>
            <div className="grid h-40 grid-cols-7 items-end gap-2">
              {(data?.stats_7_jours ?? []).map((item) => {
                const successHeight = (item.reussies / maxY) * 100;
                const failedHeight  = (item.echouees / maxY) * 100;
                return (
                  <div key={item.jour} className="flex flex-col items-center gap-1">
                    <div className="flex h-28 items-end gap-1">
                      <div className="w-3 rounded-t bg-green-600" style={{ height: `${successHeight}%` }} />
                      <div className="w-3 rounded-t bg-red-500"   style={{ height: `${failedHeight}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500">{item.jour}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold">Par opérateur</h3>
            <div className="mx-auto mb-3 h-28 w-28 rounded-full p-4"
              style={{ background: `conic-gradient(${donutGradient})` }}>
              <div className="h-full w-full rounded-full bg-white" />
            </div>
            <div className="space-y-1 text-[11px] text-gray-600">
              {donutSegments.length > 0 ? donutSegments.map((s) => (
                <p key={s.nom} className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
                  {s.nom} {s.pct}%
                </p>
              )) : <p className="text-gray-400">Aucune donnée</p>}
            </div>
          </div>
        </section>

        {/* Transactions récentes */}
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Transactions récentes</h3>
            <button onClick={() => navigate("/historique")}
              className="text-xs font-semibold text-green-600 hover:underline">
              Voir tout
            </button>
          </div>
          <div className="space-y-1.5">
            {(data?.recentes ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Aucune transaction pour le moment</p>
            ) : (data?.recentes ?? []).map((tx) => {
              const statusClass = getStatusClasses(tx.statut);
              return (
                <div key={tx.id} className="flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold ${statusClass.icon}`}>
                    {getOperateurCode(tx.operateur.nom)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">Paiement {tx.operateur.nom}</p>
                    <p className="truncate text-[11px] text-gray-500">
                      {formatMobileMoneyNumber(tx.numero_client)} · {timeAgo(tx.created_at)} · {tx.session_paiement.type_paiement}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold">+{formatMontant(tx.session_paiement.montant)}</p>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass.badge}`}>
                      {statusClass.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>

      {/* Toast unifié */}
      {toastMessage && (
        <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage("")} />
      )}
    </MerchantLayout>
  );
}
