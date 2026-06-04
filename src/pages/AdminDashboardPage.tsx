import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { OPERATOR_CODES, operatorLogoClass } from "../utils/mobileMoney";

// ─── Types ────────────────────────────────────────────────────────────────────

type TxStatus = "SUCCESS" | "FAILED" | "EN_ATTENTE";

interface DayStats {
  jour: string;
  reussies: number;
  echouees: number;
}

interface OperateurStats {
  id: string;
  nom: string;
  actif: boolean;
  taux_succes: number;
  total_txn: number;
}

interface Commercant {
  id: string;
  nom: string;
  prenom: string;
  nom_entreprise: string;
  type_commerce: string;
  ville: string;
  telephone: string;
}

interface Transaction {
  id: string;
  reference_gateway: string;
  statut: TxStatus;
  created_at: string;
  session_paiement: {
    montant: string;
    type_paiement: string;
    commercant: { nom_entreprise: string };
  };
  operateur: { nom: string };
}

interface AdminDashboardData {
  stats: {
    total_commercants: number;
    total_transactions: number;
    transactions_succes: number;
    transactions_echec: number;
    volume_total: number;
    taux_succes: number;
  };
  stats_7_jours: DayStats[];
  operateurs: OperateurStats[];
  recentes: Transaction[];
  en_attente: Commercant[];
}

interface AdminUser {
  nom?: string;
  prenom?: string;
  email?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTxStatusClass(status: TxStatus) {
  if (status === "SUCCESS")    return { icon: "bg-green-100 text-green-700",  badge: "bg-green-100 text-green-700",  label: "Succès" };
  if (status === "FAILED")     return { icon: "bg-red-100 text-red-700",      badge: "bg-red-100 text-red-700",      label: "Échec" };
  return                              { icon: "bg-yellow-100 text-yellow-700", badge: "bg-yellow-100 text-yellow-700", label: "En attente" };
}

function getOpCode(nom: string): string {
  return OPERATOR_CODES[nom] ?? nom.slice(0, 3).toUpperCase();
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return "à l'instant";
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M FCFA`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k FCFA`;
  return `${v} FCFA`;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const navigate  = useNavigate();
  const [data, setData]       = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      try { setAdminUser(JSON.parse(stored) as AdminUser); } catch { /* ignore */ }
    }

    const fetchDashboard = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        console.log("ADMIN TOKEN =", localStorage.getItem("token"));

        const response = await api.get<AdminDashboardData>("/admin/dashboard");

        console.log("ADMIN DASHBOARD RESPONSE =", response.data);

        setData(response.data);
      } catch (error) {
        console.error("ADMIN DASHBOARD ERROR =", error);
        setErrorMessage("Impossible de charger le tableau de bord admin.");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const maxY = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.stats_7_jours.map((d) => Math.max(d.reussies, d.echouees)), 1);
  }, [data]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    navigate("/login");
  };

  const adminInitials = adminUser
    ? `${(adminUser.prenom ?? "A").charAt(0)}${(adminUser.nom ?? "D").charAt(0)}`.toUpperCase()
    : "AD";
  const adminName = adminUser
    ? `${adminUser.prenom ?? ""} ${adminUser.nom ?? ""}`.trim()
    : "Administrateur";

  const pendingCount = data?.en_attente.length ?? 0;

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans">

      {/* Sidebar */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-blue-900 bg-blue-950">
        <div className="flex items-center gap-2 border-b border-blue-900 p-4">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-600 text-xs font-medium text-white">P</div>
          <span className="text-sm font-medium text-white">Paycom Admin</span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4 text-[13px]">
          <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-300">Principal</p>
          <button onClick={() => navigate("/admin/dashboard")}
            className="flex items-center gap-2.5 rounded-md bg-green-500/20 px-2.5 py-2 font-medium text-green-300 text-left">
            <span>▦</span> Vue d'ensemble
          </button>
          <button onClick={() => navigate("/admin/merchants")}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-blue-100 hover:bg-white/10 text-left">
            <span>◉</span> Commerçants
            {pendingCount > 0 && (
              <span className="ml-auto rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-red-700">
                {pendingCount}
              </span>
            )}
          </button>
          <button className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-blue-100 hover:bg-white/10 text-left">
            <span>∿</span> Transactions
          </button>
          <p className="mt-2 px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-300">Système</p>
          <button onClick={() => navigate("/admin/operators")}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-blue-100 hover:bg-white/10 text-left">
            <span>◎</span> Opérateurs
          </button>
          <button className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-blue-100 hover:bg-white/10 text-left">
            <span>▤</span> Logs système
          </button>
        </nav>

        <div className="border-t border-blue-900 p-3">
          <div className="flex items-center gap-2 rounded-md px-2.5 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-900 shrink-0">
              {adminInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white">{adminName}</p>
              <p className="text-[11px] text-blue-200">Administrateur</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-red-400 hover:bg-red-500/10">
            <span>↪</span> Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
          <p className="text-sm font-medium text-gray-800">
            Vue d'ensemble — {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          <div className="flex items-center gap-2">
            <button className="relative flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
              🔔
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>
            <button onClick={() => navigate("/")}
              className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 hover:bg-gray-50">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[9px] font-semibold text-blue-900">
                {adminInitials}
              </div>
              <span className="text-xs font-medium text-gray-800">{adminName}</span>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-900">Admin</span>
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-gray-400">Chargement du tableau de bord...</p>
          </div>
        ) : errorMessage ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto p-4">

            {/* Stats */}
            <section className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white p-3.5">
                <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">Commerçants</p>
                <p className="text-2xl font-semibold text-gray-900">{data?.stats.total_commercants ?? 0}</p>
                <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                  +{pendingCount} en attente
                </span>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3.5">
                <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">Transactions total</p>
                <p className="text-2xl font-semibold text-gray-900">{data?.stats.total_transactions ?? 0}</p>
                <span className="mt-1 inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                  {data?.stats.transactions_succes ?? 0} réussies
                </span>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3.5">
                <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">Volume total</p>
                <p className="text-xl font-semibold text-gray-900">{formatVolume(data?.stats.volume_total ?? 0)}</p>
                <span className="mt-1 inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                  encaissé
                </span>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3.5">
                <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">Taux de succès</p>
                <p className="text-2xl font-semibold text-green-700">{data?.stats.taux_succes ?? 0}%</p>
                <span className="mt-1 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                  {data?.stats.transactions_echec ?? 0} échecs
                </span>
              </div>
            </section>

            {/* Graphiques */}
            <section className="grid grid-cols-1 gap-2 xl:grid-cols-2">

              {/* Graphique 7 jours */}
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h2 className="mb-3 text-[13px] font-medium text-gray-800">Transactions — 7 derniers jours</h2>
                <div className="mb-2 flex gap-3 text-[11px] text-gray-600">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-600" /> Réussies</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500" /> Échouées</span>
                </div>
                <div className="grid h-36 grid-cols-7 items-end gap-2">
                  {(data?.stats_7_jours ?? []).map((item) => {
                    const sh = (item.reussies / maxY) * 100;
                    const fh = (item.echouees / maxY) * 100;
                    return (
                      <div key={item.jour} className="flex flex-col items-center gap-1">
                        <div className="flex h-28 items-end gap-1">
                          <div className="w-3 rounded-t-sm bg-green-600" style={{ height: `${sh}%` }} />
                          <div className="w-3 rounded-t-sm bg-red-500"   style={{ height: `${fh}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-500">{item.jour}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Statut opérateurs */}
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[13px] font-medium text-gray-800">Statut des opérateurs</h2>
                </div>
                <div className="space-y-1.5">
                  {(data?.operateurs ?? []).map((op) => (
                    <div key={op.id} className="flex items-center gap-2.5 rounded-md bg-gray-50 px-2.5 py-2">
                      <div className={`flex h-5 w-9 items-center justify-center rounded text-[9px] font-semibold text-white ${operatorLogoClass(op.nom)}`}>
                        {getOpCode(op.nom)}
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-gray-800">{op.nom}</p>
                        <p className="text-[11px] text-gray-500">{op.total_txn} transactions</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${op.actif ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {op.actif ? "En ligne" : "Hors ligne"}
                      </span>
                      <span className={`min-w-10 text-right text-xs font-semibold ${op.taux_succes < 80 ? "text-red-700" : "text-gray-800"}`}>
                        {op.taux_succes}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Commerçants en attente + Transactions récentes */}
            <section className="grid grid-cols-1 gap-2 xl:grid-cols-2">

              {/* Commerçants en attente */}
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[13px] font-medium text-gray-800">Commerçants récemment inscrits</h2>
                  <button onClick={() => navigate("/admin/merchants")}
                    className="text-[11px] text-blue-700 hover:underline">Voir tous</button>
                </div>
                <div className="space-y-1.5">
                  {(data?.en_attente ?? []).length === 0 ? (
                    <p className="text-xs text-gray-400 py-4 text-center">Aucun commerçant en attente</p>
                  ) : (data?.en_attente ?? []).map((c) => {
                    const initials = `${c.prenom.charAt(0)}${c.nom.charAt(0)}`.toUpperCase();
                    return (
                      <div key={c.id} className="flex items-center gap-2.5 rounded-md bg-gray-50 px-2.5 py-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-800 shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-gray-800">{c.prenom} {c.nom}</p>
                          <p className="truncate text-[11px] text-gray-500">{c.type_commerce} · {c.ville}</p>
                        </div>
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-700">
                          En attente
                        </span>
                        <div className="flex gap-1">
                          <button onClick={() => navigate("/admin/merchants")}
                            className="rounded-md border border-green-300 bg-green-50 px-2 py-1 text-[10px] text-green-700 hover:bg-green-100">
                            Voir
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Transactions récentes */}
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[13px] font-medium text-gray-800">Transactions récentes</h2>
                </div>
                <div className="space-y-1.5">
                  {(data?.recentes ?? []).length === 0 ? (
                    <p className="text-xs text-gray-400 py-4 text-center">Aucune transaction</p>
                  ) : (data?.recentes ?? []).map((tx) => {
                    const classes = getTxStatusClass(tx.statut);
                    const nomCommerce = tx.session_paiement?.commercant?.nom_entreprise ?? "—";
                    return (
                      <div key={tx.id} className="flex items-center gap-2.5 rounded-md bg-gray-50 px-2.5 py-2">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold shrink-0 ${classes.icon}`}>
                          {getOpCode(tx.operateur?.nom ?? "?")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-gray-800">{nomCommerce}</p>
                          <p className="truncate text-[11px] text-gray-500">
                            {tx.operateur?.nom} · {tx.session_paiement?.type_paiement} · {timeAgo(tx.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-gray-800">
                            +{Number(tx.session_paiement?.montant ?? 0).toLocaleString("fr-FR")} F
                          </p>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${classes.badge}`}>{classes.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

          </div>
        )}
      </main>
    </div>
  );
}
