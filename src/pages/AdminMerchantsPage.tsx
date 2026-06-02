import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Toast from "../components/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type MerchantStatusType = "actif" | "attente" | "suspendu";

interface CompteOperateur {
  id: string;
  numero: string;
  actif: boolean;
  operateur: { nom: string };
}

interface Merchant {
  id: string;
  nom: string;
  prenom: string;
  nom_entreprise: string;
  type_commerce: string;
  ville: string;
  telephone: string;
  ifu: string | null;
  created_at: string;
  status: MerchantStatusType;
  compte_operateurs: CompteOperateur[];
  utilisateur?: { email: string };
  total_transactions?: number;
  taux_succes?: number;
}

interface AdminUser {
  nom?: string;
  prenom?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const villesList = ["Cotonou", "Porto-Novo", "Parakou", "Abomey-Calavi"];
const opsList    = ["MTN", "Moov", "Celtiis"];

const statusLabel: Record<MerchantStatusType, string> = {
  actif:    "Actif",
  attente:  "En attente",
  suspendu: "Suspendu",
};

const statusClasses: Record<MerchantStatusType, string> = {
  actif:    "bg-green-100 text-green-700",
  attente:  "bg-yellow-100 text-yellow-700",
  suspendu: "bg-red-100 text-red-700",
};

const opColorClasses: Record<string, string> = {
  MTN:    "bg-yellow-100 text-yellow-800",
  Moov:   "bg-blue-100 text-blue-800",
  Celtiis: "bg-purple-100 text-purple-800",
};

const avatarColors = [
  { bg: "#dcfce7", text: "#15803d" },
  { bg: "#fef3c7", text: "#92400e" },
  { bg: "#ede9fe", text: "#5b21b6" },
  { bg: "#dbeafe", text: "#1e40af" },
  { bg: "#fce7f3", text: "#9d174d" },
  { bg: "#fee2e2", text: "#b91c1c" },
];

function getInitials(prenom: string, nom: string): string {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

function getAvatarColor(index: number) {
  return avatarColors[index % avatarColors.length];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function AdminMerchantsPage() {
  const navigate = useNavigate();

  const [merchants, setMerchants]               = useState<Merchant[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [actionLoading, setActionLoading]       = useState<string | null>(null);
  const [searchTerm, setSearchTerm]             = useState("");
  const [filterVille, setFilterVille]           = useState("");
  const [filterOp, setFilterOp]                 = useState("");
  const [filterStatus, setFilterStatus]         = useState<MerchantStatusType | "tous">("tous");
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [adminUser, setAdminUser]               = useState<AdminUser | null>(null);
  const [toastMessage, setToastMessage]         = useState("");
  const [toastType, setToastType]               = useState<"success" | "error" | "info">("error");

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
    fetchMerchants();
  }, []);

  const fetchMerchants = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ commercants: { data: Merchant[] } }>("/admin/commercants");
      const data = response.data.commercants.data ?? [];
      const mapped = data.map((c) => ({ ...c, status: "actif" as MerchantStatusType }));
      setMerchants(mapped);
    } catch {
      // token expiré → intercepteur redirige
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendre = async (id: string) => {
    setActionLoading(id);
    try {
      await api.put(`/admin/commercants/${id}/suspendre`);
      setMerchants((prev) => prev.map((m) => m.id === id ? { ...m, status: "suspendu" } : m));
      if (selectedMerchant?.id === id) setSelectedMerchant((prev) => prev ? { ...prev, status: "suspendu" } : null);
      showToast("Compte suspendu avec succès.", "success");
    } catch {
      showToast("Erreur lors de la suspension.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactiver = async (id: string) => {
    setActionLoading(id);
    try {
      await api.put(`/admin/commercants/${id}/reactiver`);
      setMerchants((prev) => prev.map((m) => m.id === id ? { ...m, status: "actif" } : m));
      if (selectedMerchant?.id === id) setSelectedMerchant((prev) => prev ? { ...prev, status: "actif" } : null);
      showToast("Compte réactivé avec succès.", "success");
    } catch {
      showToast("Erreur lors de la réactivation.", "error");
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

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return merchants.filter((m) => {
      const ops = m.compte_operateurs.map((c) => c.operateur.nom);
      const matchQ = !q
        || m.nom.toLowerCase().includes(q)
        || m.prenom.toLowerCase().includes(q)
        || m.nom_entreprise.toLowerCase().includes(q)
        || m.ville.toLowerCase().includes(q);
      const matchV = !filterVille || m.ville === filterVille;
      const matchO = !filterOp   || ops.includes(filterOp);
      const matchS = filterStatus === "tous" || m.status === filterStatus;
      return matchQ && matchV && matchO && matchS;
    });
  }, [merchants, searchTerm, filterVille, filterOp, filterStatus]);

  const stats = {
    total:     merchants.length,
    actifs:    merchants.filter((m) => m.status === "actif").length,
    attente:   merchants.filter((m) => m.status === "attente").length,
    suspendus: merchants.filter((m) => m.status === "suspendu").length,
  };

  const adminInitials = adminUser
    ? `${(adminUser.prenom ?? "A").charAt(0)}${(adminUser.nom ?? "D").charAt(0)}`.toUpperCase()
    : "AD";
  const adminName = adminUser
    ? `${adminUser.prenom ?? ""} ${adminUser.nom ?? ""}`.trim()
    : "Administrateur";

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
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-blue-100 hover:bg-white/10">
            <span>▦</span> Vue d'ensemble
          </button>
          <button onClick={() => navigate("/admin/merchants")}
            className="flex w-full items-center gap-2.5 rounded-md bg-white/10 px-2.5 py-2 text-left font-medium text-white">
            <span>◉</span> Commerçants
            {stats.attente > 0 && (
              <span className="ml-auto rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-red-700">
                {stats.attente}
              </span>
            )}
          </button>
          <button className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-blue-100 hover:bg-white/10">
            <span>∿</span> Transactions
          </button>
          <p className="mt-2 px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-300">Système</p>
          <button onClick={() => navigate("/admin/operators")}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-blue-100 hover:bg-white/10">
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
              <p className="truncate text-xs font-medium text-white">{adminName}</p>
              <p className="text-[11px] text-blue-400">Administrateur</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-red-400 hover:bg-red-500/10">
            <span>↪</span> Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
          <p className="text-sm font-medium text-gray-800">Gestion des commerçants</p>
          <div className="flex items-center gap-2">
            <button className="relative flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
              🔔<span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>
            <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[9px] font-semibold text-blue-900">
                {adminInitials}
              </div>
              <span className="text-xs font-medium text-gray-800">{adminName}</span>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-900">Admin</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">

          {/* Stats */}
          <section className="mb-4 grid grid-cols-4 gap-2">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">Total commerçants</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
              <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">inscrits</span>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">Actifs</p>
              <p className="text-2xl font-semibold text-green-700">{stats.actifs}</p>
              <span className="mt-1 inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                {stats.total > 0 ? ((stats.actifs / stats.total) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">En attente</p>
              <p className="text-2xl font-semibold text-yellow-700">{stats.attente}</p>
              <span className="mt-1 inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-700">à valider</span>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">Suspendus</p>
              <p className="text-2xl font-semibold text-red-700">{stats.suspendus}</p>
              <span className="mt-1 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">suspendus</span>
            </div>
          </section>

          <div className="rounded-lg border border-gray-200 bg-white p-4">

            {/* Filtres */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-44">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <input type="text" placeholder="Rechercher par nom, commerce, ville..."
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border border-gray-200 bg-white px-3 py-2 pl-8 text-sm rounded-md outline-none focus:border-blue-900" />
              </div>
              <select value={filterVille} onChange={(e) => setFilterVille(e.target.value)}
                className="border border-gray-200 bg-white px-3 py-2 text-sm rounded-md outline-none text-gray-700 focus:border-blue-900">
                <option value="">Toutes les villes</option>
                {villesList.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={filterOp} onChange={(e) => setFilterOp(e.target.value)}
                className="border border-gray-200 bg-white px-3 py-2 text-sm rounded-md outline-none text-gray-700 focus:border-blue-900">
                <option value="">Tous les opérateurs</option>
                {opsList.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <div className="flex gap-1">
                {(["tous", "actif", "attente", "suspendu"] as const).map((s) => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`rounded-md px-3 py-2 text-xs font-medium transition border ${
                      filterStatus === s ? "bg-blue-100 text-blue-900 border-blue-300" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}>
                    {s === "tous" ? "Tous" : s === "actif" ? "Actifs" : s === "attente" ? "En attente" : "Suspendus"}
                  </button>
                ))}
              </div>
            </div>

            {/* Tableau */}
            {loading ? (
              <div className="py-10 text-center text-sm text-gray-400">Chargement...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-700">
                  <thead>
                    <tr className="border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500">
                      <th className="px-3 py-2">Commerçant</th>
                      <th className="px-3 py-2">Ville</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Opérateurs</th>
                      <th className="px-3 py-2">Inscrit le</th>
                      <th className="px-3 py-2">Statut</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-400 text-sm">Aucun commerçant trouvé</td>
                      </tr>
                    ) : filtered.map((m, idx) => {
                      const initials  = getInitials(m.prenom, m.nom);
                      const color     = getAvatarColor(idx);
                      const ops       = m.compte_operateurs.map((c) => c.operateur.nom);
                      const isLoading = actionLoading === m.id;
                      return (
                        <tr key={m.id} className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedMerchant(m)}>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold shrink-0"
                                style={{ background: color.bg, color: color.text }}>
                                {initials}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-900">{m.prenom} {m.nom}</p>
                                <p className="text-[11px] text-gray-500">{m.nom_entreprise}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">{m.ville}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{m.type_commerce}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {ops.map((op) => (
                                <span key={op} className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${opColorClasses[op] ?? "bg-gray-100 text-gray-700"}`}>
                                  {op}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">{formatDate(m.created_at)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClasses[m.status]}`}>
                              {statusLabel[m.status]}
                            </span>
                          </td>
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              {m.status === "actif" && (
                                <button onClick={() => handleSuspendre(m.id)} disabled={isLoading}
                                  className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
                                  {isLoading ? "..." : "Suspendre"}
                                </button>
                              )}
                              {m.status === "suspendu" && (
                                <button onClick={() => handleReactiver(m.id)} disabled={isLoading}
                                  className="rounded-md border border-green-300 bg-green-50 px-2 py-1 text-[10px] font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50">
                                  {isLoading ? "..." : "Réactiver"}
                                </button>
                              )}
                              {m.status === "attente" && (
                                <button onClick={() => handleReactiver(m.id)} disabled={isLoading}
                                  className="rounded-md border border-green-300 bg-green-50 px-2 py-1 text-[10px] font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50">
                                  {isLoading ? "..." : "Valider"}
                                </button>
                              )}
                              <button onClick={() => setSelectedMerchant(m)}
                                className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-900 hover:bg-blue-100">
                                Voir
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Panneau détail */}
      {selectedMerchant && (() => {
        const color    = getAvatarColor(merchants.findIndex((m) => m.id === selectedMerchant.id));
        const initials = getInitials(selectedMerchant.prenom, selectedMerchant.nom);
        const ops      = selectedMerchant.compte_operateurs.map((c) => c.operateur.nom);
        const isLoading = actionLoading === selectedMerchant.id;
        return (
          <aside className="fixed right-0 top-0 h-screen w-80 border-l border-gray-200 bg-white p-5 shadow-lg overflow-y-auto z-40">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Fiche commerçant</h2>
              <button onClick={() => setSelectedMerchant(null)}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="mb-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold mx-auto mb-2"
                style={{ background: color.bg, color: color.text }}>
                {initials}
              </div>
              <p className="text-sm font-semibold text-gray-900">{selectedMerchant.prenom} {selectedMerchant.nom}</p>
              <p className="text-xs text-gray-600">{selectedMerchant.nom_entreprise}</p>
              <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClasses[selectedMerchant.status]}`}>
                {statusLabel[selectedMerchant.status]}
              </span>
            </div>

            <div className="mb-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Informations</p>
              <div className="space-y-1 text-xs border-t border-gray-200 pt-2">
                {[
                  { label: "Téléphone",  value: selectedMerchant.telephone },
                  { label: "Email",      value: selectedMerchant.utilisateur?.email ?? "—" },
                  { label: "Ville",      value: selectedMerchant.ville },
                  { label: "Type",       value: selectedMerchant.type_commerce },
                  { label: "IFU",        value: selectedMerchant.ifu ?? "Non renseigné" },
                  { label: "Inscrit le", value: formatDate(selectedMerchant.created_at) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-900 text-right max-w-44 truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Opérateurs</p>
              <div className="flex flex-wrap gap-2">
                {ops.map((op) => (
                  <span key={op} className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${opColorClasses[op] ?? "bg-gray-100 text-gray-700"}`}>
                    {op}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2 mt-4">
              {selectedMerchant.status === "actif" && (
                <button onClick={() => handleSuspendre(selectedMerchant.id)} disabled={isLoading}
                  className="w-full rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
                  {isLoading ? "..." : "Suspendre le compte"}
                </button>
              )}
              {selectedMerchant.status === "suspendu" && (
                <button onClick={() => handleReactiver(selectedMerchant.id)} disabled={isLoading}
                  className="w-full rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                  {isLoading ? "..." : "Réactiver le compte"}
                </button>
              )}
              {selectedMerchant.status === "attente" && (
                <button onClick={() => handleReactiver(selectedMerchant.id)} disabled={isLoading}
                  className="w-full rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                  {isLoading ? "..." : "Valider le compte"}
                </button>
              )}
              <button onClick={() => setSelectedMerchant(null)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                Fermer
              </button>
            </div>
          </aside>
        );
      })()}

      {/* Toast unifié */}
      {toastMessage && (
        <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage("")} />
      )}
    </div>
  );
}
