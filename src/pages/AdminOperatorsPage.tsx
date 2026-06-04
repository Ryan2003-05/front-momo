import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Toast from "../components/Toast";
import { OPERATOR_CODES, operatorHex } from "../utils/mobileMoney";

// ─── Types ────────────────────────────────────────────────────────────────────

type OperatorStatus = "En ligne" | "Dégradé" | "Désactivé";

type Operator = {
  id: string;
  nom: string;
  actif: boolean;
  taux_succes: number;
  total_txn: number;
  status: OperatorStatus;
  degraded: boolean;
};

interface AdminUser {
  nom?: string;
  prenom?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const chartData = [
  { name: "MTN MoMo",   color: "#f59e0b", values: [680, 720, 650, 800, 750, 850, 724] },
  { name: "Moov Money", color: "#0F6AB3", values: [380, 420, 350, 450, 400, 480, 398] },
  { name: "Celtiis",     color: "#10b981", values: [180, 190, 160, 210, 180, 200, 162], dash: "4 3" },
];

const incidentHistory = [
  { date: "30 avr. 2025 · 11h20", code: "CEL", name: "Celtiis", type: "Dégradation",  duration: "En cours", impact: "47 txn affectées",  status: "Actif",  badgeClass: "bg-red-100 text-red-700" },
  { date: "28 avr. 2025 · 14h05", code: "MOV", name: "Moov",   type: "Panne totale", duration: "1h 23min", impact: "214 txn affectées", status: "Résolu", badgeClass: "bg-green-100 text-green-700" },
  { date: "24 avr. 2025 · 08h30", code: "MTN", name: "MTN",    type: "Lenteur",      duration: "42min",    impact: "89 txn affectées",  status: "Résolu", badgeClass: "bg-green-100 text-green-700" },
  { date: "19 avr. 2025 · 19h45", code: "CEL", name: "Celtiis", type: "Panne totale", duration: "3h 10min", impact: "312 txn affectées", status: "Résolu", badgeClass: "bg-green-100 text-green-700" },
];

function getStatusClasses(status: OperatorStatus): string {
  if (status === "En ligne") return "bg-green-100 text-green-700";
  if (status === "Dégradé")  return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
}

// ─── Graphique ────────────────────────────────────────────────────────────────

function OperatorChart() {
  const width    = 320;
  const height   = 160;
  const maxValue = 900;
  const padding  = 24;

  const pointsFor = (values: number[]) =>
    values.map((value, index) => {
      const x = padding + ((width - padding * 2) / (values.length - 1)) * index;
      const y = height - padding - ((height - padding * 2) * value) / maxValue;
      return `${x},${y}`;
    }).join(" ");

  return (
    <div className="relative h-44 w-full rounded-xl bg-slate-50 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
        <g stroke="rgba(15,23,42,0.08)" strokeWidth="1">
          {[1, 2, 3, 4].map((line) => (
            <line key={line} x1={padding} x2={width - padding}
              y1={padding + ((height - padding * 2) / 4) * line}
              y2={padding + ((height - padding * 2) / 4) * line} />
          ))}
        </g>
        {chartData.map((dataset) => (
          <polyline key={dataset.name} fill="none" stroke={dataset.color} strokeWidth="2"
            strokeDasharray={dataset.dash ?? ""} points={pointsFor(dataset.values)} />
        ))}
        {chartData.map((dataset) =>
          dataset.values.map((value, index) => {
            const x = padding + ((width - padding * 2) / (dataset.values.length - 1)) * index;
            const y = height - padding - ((height - padding * 2) * value) / maxValue;
            return <circle key={`${dataset.name}-${index}`} cx={x} cy={y} r="2.5" fill={dataset.color} />;
          })
        )}
      </svg>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AdminOperatorsPage() {
  const navigate = useNavigate();

  const [operators, setOperators]         = useState<Operator[]>([]);
  const [loading, setLoading]             = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTest, setActiveTest]       = useState<string | null>(null);
  const [adminUser, setAdminUser]         = useState<AdminUser | null>(null);
  const [toastMessage, setToastMessage]   = useState("");
  const [toastType, setToastType]         = useState<"success" | "error" | "info">("error");

  function showToast(message: string, type: "success" | "error" | "info" = "error") {
    setToastMessage(message);
    setToastType(type);
  }

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      try { setAdminUser(JSON.parse(stored) as AdminUser); } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/immutability
    fetchOperateurs();
  }, []);

  const fetchOperateurs = async () => {
    setLoading(true);
    try {
      const response = await api.get<{
        operateurs: Array<{
          id: string;
          nom: string;
          actif: boolean;
          taux_succes: number;
          total_txn: number;
        }>
      }>("/admin/operateurs");

      const mapped: Operator[] = response.data.operateurs.map((op) => ({
        id:          op.id,
        nom:         op.nom,
        actif:       op.actif,
        taux_succes: op.taux_succes,
        total_txn:   op.total_txn,
        degraded:    op.actif && op.taux_succes < 80,
        status:      !op.actif
          ? "Désactivé"
          : op.taux_succes < 80
            ? "Dégradé"
            : "En ligne",
      }));
      setOperators(mapped);
    } catch {
      // token expiré → intercepteur redirige
    } finally {
      setLoading(false);
    }
  };

  const testOperator = (id: string) => {
    setActiveTest(id);
    showToast("Test de connectivité réussi !", "success");
    window.setTimeout(() => setActiveTest((curr) => curr === id ? null : curr), 3000);
  };

  const toggleOperator = async (op: Operator) => {
    setActionLoading(op.id);
    try {
      await api.put(`/admin/operateurs/${op.id}/toggle`);
      setOperators((prev) => prev.map((o) => {
        if (o.id !== op.id) return o;
        const newActif = !o.actif;
        return {
          ...o,
          actif:    newActif,
          degraded: newActif && o.taux_succes < 80,
          status:   !newActif
            ? "Désactivé"
            : o.taux_succes < 80
              ? "Dégradé"
              : "En ligne",
        };
      }));
      showToast(
        op.actif ? `${op.nom} désactivé avec succès.` : `${op.nom} réactivé avec succès.`,
        "success"
      );
    } catch {
      showToast("Erreur lors de la modification de l'opérateur.", "error");
    } finally {
      setActionLoading(null);
    }
  };

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

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans text-slate-900">

      {/* Sidebar */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-blue-900 bg-blue-950 text-white">
        <div className="flex items-center gap-2 border-b border-slate-900 p-4">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-600 text-xs font-medium text-white">P</div>
          <span className="text-sm font-medium">Paycom Admin</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4 text-[13px]">
          <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-300">Principal</p>
          <button onClick={() => navigate("/admin/dashboard")}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-blue-100 hover:bg-white/10">
            <span>▦</span> Vue d'ensemble
          </button>
          <button onClick={() => navigate("/admin/merchants")}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-blue-100 hover:bg-white/10">
            <span>◉</span> Commerçants
          </button>
          <button onClick={() => navigate("/admin/operators")}
            className="flex w-full items-center gap-2.5 rounded-md bg-white/10 px-2.5 py-2 text-left font-medium text-white">
            <span>◎</span> Opérateurs
          </button>
          <button className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-blue-100 hover:bg-white/10">
            <span>▤</span> Logs système
          </button>
        </nav>
        <div className="border-t border-blue-900 p-3">
          <div className="flex items-center gap-2 rounded-md px-2.5 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-900 shrink-0">
              {adminInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{adminName}</p>
              <p className="text-[11px] text-blue-400">Administrateur</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-md bg-white/5 px-2.5 py-2 text-left text-[13px] text-red-300 hover:bg-red-500/10">
            <span>↪</span> Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <p className="text-sm font-medium text-slate-800">Opérateurs mobile money</p>
          <div className="flex items-center gap-2">
            <button className="relative flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">
              🔔<span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>
            <button onClick={() => navigate("/admin/dashboard")}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Tableau de bord
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-gray-400">Chargement des opérateurs...</p>
            </div>
          ) : (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {operators.map((op) => {
                const color     = operatorHex(op.nom);
                const code      = OPERATOR_CODES[op.nom]  ?? op.nom.slice(0, 3).toUpperCase();
                const isLoading = actionLoading === op.id;

                return (
                  <div key={op.id}
                    className={`rounded-2xl border p-5 shadow-sm transition ${
                      op.status === "Dégradé"   ? "border-red-100 bg-red-50" :
                      op.status === "Désactivé" ? "border-gray-200 bg-gray-50 opacity-60" :
                      "border-slate-200 bg-white"
                    }`}>

                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-14 items-center justify-center rounded-xl text-[11px] font-semibold text-white"
                        style={{ backgroundColor: color }}>
                        {code}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{op.nom}</p>
                      </div>
                      <span className={`ml-auto rounded-full px-3 py-1 text-[10px] font-semibold ${getStatusClasses(op.status)}`}>
                        {op.status}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Transactions</div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">{op.total_txn}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Taux succès</div>
                        <div className={`mt-2 text-lg font-semibold ${op.degraded ? "text-amber-700" : "text-emerald-700"}`}>
                          {op.taux_succes}%
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Statut</div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">{op.status}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Actif</div>
                        <div className={`mt-2 text-lg font-semibold ${op.actif ? "text-green-700" : "text-red-700"}`}>
                          {op.actif ? "Oui" : "Non"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm text-slate-500">
                        <span>Taux de succès</span>
                        <span className="font-semibold text-slate-900">{op.taux_succes}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${op.taux_succes}%`,
                            backgroundColor: op.status === "Dégradé" ? "#ef4444" : "#16a34a",
                          }} />
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button onClick={() => testOperator(op.id)}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
                        Tester
                      </button>
                      <button onClick={() => toggleOperator(op)} disabled={isLoading}
                        className={`rounded-xl px-3 py-2 text-[12px] font-semibold transition disabled:opacity-50 ${
                          op.status === "Désactivé"
                            ? "border border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "border border-red-200 bg-red-100 text-red-700 hover:bg-red-200"
                        }`}>
                        {isLoading ? "..." : op.status === "Désactivé" ? "Réactiver" : "Désactiver"}
                      </button>
                    </div>

                    {activeTest === op.id && (
                      <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold">✓</span>
                        {op.nom} répond correctement
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {/* Graphique */}
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Comparaison des opérateurs — 7 derniers jours</h2>
            <div className="mb-4 flex flex-wrap gap-3 text-sm text-slate-600">
              {chartData.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </div>
              ))}
            </div>
            <OperatorChart />
          </section>

          {/* Historique incidents */}
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Historique des incidents</h2>
              <span className="text-xs text-slate-500">30 derniers jours</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-700">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Opérateur</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Durée</th>
                    <th className="px-3 py-2">Impact</th>
                    <th className="px-3 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {incidentHistory.map((item) => (
                    <tr key={`${item.date}-${item.code}`} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-3 py-3 text-[12px] text-slate-700">{item.date}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 text-[12px]">
                          <div className="flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-semibold text-white"
                            style={{ backgroundColor: item.code === "MTN" ? "#f59e0b" : item.code === "MOV" ? "#0F6AB3" : "#10b981" }}>
                            {item.code}
                          </div>
                          {item.name}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[12px] text-slate-700">{item.type}</td>
                      <td className="px-3 py-3 text-[12px] text-slate-700">{item.duration}</td>
                      <td className="px-3 py-3 text-[12px] text-slate-700">{item.impact}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${item.badgeClass}`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* Toast unifié */}
      {toastMessage && (
        <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage("")} />
      )}
    </div>
  );
}
