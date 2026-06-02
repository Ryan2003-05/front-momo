import { useEffect, useState } from "react";
import MerchantLayout from "../components/MerchantLayout";
import api from "../api";

// ─── Types ────────────────────────────────────────────────────────────────────

type PersonalInfo = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

type CommerceInfo = {
  shopName: string;
  businessType: string;
  city: string;
  ifu: string;
};

type AccountInfo = {
  id: string;
  label: string;
  number: string;
  colorClass: string;
  active: boolean;
  operateurNom: string;
};

type PasswordFields = {
  current: string;
  next: string;
  confirm: string;
};

type PasswordVisibility = {
  current: boolean;
  next: boolean;
  confirm: boolean;
};

type DashboardStats = {
  stats: { total: number; reussies: number; volume: number; taux_succes: number };
  solde_total: string;
};

const opColors: Record<string, string> = {
  MTN: "bg-amber-500",
  Moov: "bg-blue-600",
  Celtiis: "bg-purple-600",
};

const opBadge: Record<string, string> = {
  MTN: "bg-amber-100 text-amber-800",
  Moov: "bg-blue-100 text-blue-800",
  Celtiis: "bg-purple-100 text-purple-800",
};

const opLabels: Record<string, string> = {
  MTN: "MTN MoMo",
  Moov: "Moov Money",
  Celtiis: "Celtiis",
};

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ProfilePage() {
  const [editingSection, setEditingSection] = useState<"none" | "personal" | "commerce">("none");
  const [toastMessage, setToastMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [personal, setPersonal] = useState<PersonalInfo>({
    firstName: "", lastName: "", phone: "", email: "",
  });

  const [commerce, setCommerce] = useState<CommerceInfo>({
    shopName: "", businessType: "", city: "", ifu: "",
  });

  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [initials, setInitials] = useState("??");
  const [memberSince, setMemberSince] = useState("");

  const [passwords, setPasswords] = useState<PasswordFields>({
    current: "", next: "", confirm: "",
  });

  const [showPassword, setShowPassword] = useState<PasswordVisibility>({
    current: false, next: false, confirm: false,
  });

  // Charger le profil
  useEffect(() => {
    const fetchProfil = async () => {
      setLoading(true);
      try {
        const [profilRes, dashRes] = await Promise.all([
          api.get("/commercant/profil"),
          api.get("/dashboard?periode=tout"),
        ]);
        console.log(
          JSON.stringify(profilRes.data, null, 2)
        );

        const c = profilRes.data.commercant;
        const u = c.user;

        setPersonal({
          firstName: c.prenom,
          lastName: c.nom,
          phone: c.telephone,
          email: u?.email ?? "",
        });

        setCommerce({
          shopName: c.nom_entreprise,
          businessType: c.type_commerce,
          city: c.ville,
          ifu: c.ifu ?? "",
        });

        setInitials(`${c.prenom.charAt(0)}${c.nom.charAt(0)}`.toUpperCase());

        if (c.created_at) {
          const d = new Date(c.created_at);
          setMemberSince(d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));
        }

        const compteOperateurs = c.compte_operateurs ?? c.compteOperateurs ?? [];
        const comptesData: AccountInfo[] = compteOperateurs.map((co: {
          id: string; numero: string; actif: boolean;
          operateur: { nom: string };
        }) => ({
          id: co.id,
          label: opLabels[co.operateur.nom] ?? co.operateur.nom,
          number: co.numero,
          colorClass: opColors[co.operateur.nom] ?? "bg-gray-400",
          active: co.actif,
          operateurNom: co.operateur.nom,
        }));
        setAccounts(comptesData);
        setStats(dashRes.data);

      } catch {
        showToast("Erreur lors du chargement du profil.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfil();
  }, []);

  // Toast
  useEffect(() => {
    if (!toastMessage) return undefined;
    const t = window.setTimeout(() => setToastMessage(""), 2500);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  function showToast(message: string) { setToastMessage(message); }
  function toggleEdit(section: "personal" | "commerce") {
    setEditingSection((prev) => prev === section ? "none" : section);
  }
  function handlePersonalChange(field: keyof PersonalInfo, value: string) {
    setPersonal((prev) => ({ ...prev, [field]: value }));
  }
  function handleCommerceChange(field: keyof CommerceInfo, value: string) {
    setCommerce((prev) => ({ ...prev, [field]: value }));
  }
  function handlePasswordChange(field: keyof PasswordFields, value: string) {
    setPasswords((prev) => ({ ...prev, [field]: value }));
  }
  function togglePasswordField(field: keyof PasswordVisibility) {
    setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }));
  }

  // Sauvegarder le profil
  async function handleSavePersonal() {
    setSaving(true);
    try {
      await api.put("/commercant/profil", {
        nom: personal.lastName,
        prenom: personal.firstName,
        telephone: personal.phone,
      });
      setEditingSection("none");
      setInitials(`${personal.firstName.charAt(0)}${personal.lastName.charAt(0)}`.toUpperCase());
      showToast("Informations personnelles mises à jour");
    } catch {
      showToast("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCommerce() {
    setSaving(true);
    try {
      await api.put("/commercant/profil", {
        nom_entreprise: commerce.shopName,
        type_commerce: commerce.businessType,
        ville: commerce.city,
        ifu: commerce.ifu || null,
      });
      setEditingSection("none");
      showToast("Informations du commerce mises à jour");
    } catch {
      showToast("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  // Changer le mot de passe
  async function handleUpdatePassword() {
    if (!passwords.current) { showToast("Entrez votre mot de passe actuel."); return; }
    if (passwords.next.length < 8) { showToast("Le nouveau mot de passe doit contenir au moins 8 caractères."); return; }
    if (passwords.next !== passwords.confirm) { showToast("Les mots de passe ne correspondent pas."); return; }

    setSavingPassword(true);
    try {
      await api.put("/commercant/mot-de-passe", {
        mot_de_passe_actuel: passwords.current,
        nouveau_mot_de_passe: passwords.next,
        nouveau_mot_de_passe_confirmation: passwords.confirm,
      });
      setPasswords({ current: "", next: "", confirm: "" });
      showToast("Mot de passe mis à jour avec succès");
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      showToast(error.response?.data?.message || "Erreur lors de la mise à jour.");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <MerchantLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-sm text-gray-400">Chargement du profil...</p>
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout>
      <div className="space-y-6">

        {/* Header profil */}
        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="h-14 bg-green-600" />
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:gap-6">
            <div className="relative shrink-0">
              <div className="h-16 w-16 rounded-full border-4 border-white bg-emerald-100 text-xl font-semibold text-green-700 flex items-center justify-center">
                {initials}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-lg font-semibold text-gray-900">{personal.firstName} {personal.lastName}</p>
              <p className="mt-1 text-sm text-gray-500">{commerce.shopName} · {commerce.city} · Membre depuis {memberSince}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {accounts.map((a) => (
                  <span key={a.id} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${opBadge[a.operateurNom] ?? "bg-gray-100 text-gray-700"}`}>
                    {a.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center text-sm">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-2xl font-semibold text-gray-900">{stats?.stats.total ?? 0}</p>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Transactions</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-2xl font-semibold text-green-700">{stats?.stats.taux_succes ?? 0}%</p>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Taux succès</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-2xl font-semibold text-gray-900">
                  {stats ? `${Math.round(Number(stats.solde_total) / 1000)}k F` : "0 F"}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Solde</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">

            {/* Informations personnelles */}
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">Informations personnelles</p>
                <button type="button" onClick={() => toggleEdit("personal")}
                  className="inline-flex items-center gap-2 rounded-md border border-green-100 bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
                  {editingSection === "personal" ? "Annuler" : "Modifier"}
                </button>
              </div>
              {editingSection !== "personal" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Prénom", value: personal.firstName },
                    { label: "Nom", value: personal.lastName },
                    { label: "Téléphone", value: personal.phone },
                    { label: "Email", value: personal.email },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
                      <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm text-gray-900">{value || "—"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {([
                    { label: "Prénom", field: "firstName" as const },
                    { label: "Nom", field: "lastName" as const },
                    { label: "Téléphone", field: "phone" as const },
                  ]).map(({ label, field }) => (
                    <label key={field} className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
                      <input value={personal[field]} onChange={(e) => handlePersonalChange(field, e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100" />
                    </label>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleSavePersonal} disabled={saving}
                      className="rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                      {saving ? "Enregistrement..." : "Enregistrer"}
                    </button>
                    <button type="button" onClick={() => setEditingSection("none")}
                      className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Informations du commerce */}
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">Informations du commerce</p>
                <button type="button" onClick={() => toggleEdit("commerce")}
                  className="inline-flex items-center gap-2 rounded-md border border-green-100 bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
                  {editingSection === "commerce" ? "Annuler" : "Modifier"}
                </button>
              </div>
              {editingSection !== "commerce" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Nom du commerce", value: commerce.shopName },
                    { label: "Type de commerce", value: commerce.businessType },
                    { label: "Ville", value: commerce.city },
                    { label: "IFU", value: commerce.ifu || "Non renseigné" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
                      <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {([
                    { label: "Nom du commerce", field: "shopName" as const },
                    { label: "Type de commerce", field: "businessType" as const },
                    { label: "Ville", field: "city" as const },
                    { label: "IFU", field: "ifu" as const },
                  ]).map(({ label, field }) => (
                    <label key={field} className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
                      <input value={commerce[field]} onChange={(e) => handleCommerceChange(field, e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100" />
                    </label>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleSaveCommerce} disabled={saving}
                      className="rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                      {saving ? "Enregistrement..." : "Enregistrer"}
                    </button>
                    <button type="button" onClick={() => setEditingSection("none")}
                      className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Comptes mobile money */}
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">Comptes mobile money</p>
                <span className="text-xs text-gray-500">{accounts.filter((a) => a.active).length} / {accounts.length} actifs</span>
              </div>
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div key={account.id} className="rounded-2xl border border-gray-200">
                    <div className="flex items-center gap-3 border-b border-gray-200 bg-slate-50 px-4 py-3">
                      <div className={`${account.colorClass} flex h-9 w-14 items-center justify-center rounded-xl text-[10px] font-semibold text-white`}>
                        {account.operateurNom.slice(0, 3).toUpperCase()}
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{account.label}</p>
                      <span className={`ml-auto rounded-full px-3 py-1 text-[10px] font-semibold ${account.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {account.active ? "Actif" : "Inactif"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 text-sm text-gray-700">
                      <span>{account.number}</span>
                      <button type="button" onClick={() => showToast(`Numéro ${account.label} modifié`)}
                        className="text-xs font-semibold text-green-700 hover:underline">
                        Modifier le numéro
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">

            {/* Sécurité */}
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="mb-4 text-sm font-semibold text-gray-900">Sécurité</p>
              <div className="space-y-4">
                {([
                  { label: "Mot de passe actuel", field: "current" as const, placeholder: "Votre mot de passe" },
                  { label: "Nouveau mot de passe", field: "next" as const, placeholder: "8 caractères minimum" },
                  { label: "Confirmer", field: "confirm" as const, placeholder: "Répétez le nouveau" },
                ]).map(({ label, field, placeholder }) => (
                  <div key={field} className="relative">
                    <label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500">{label}</label>
                    <input type={showPassword[field] ? "text" : "password"}
                      value={passwords[field]} placeholder={placeholder}
                      onChange={(e) => handlePasswordChange(field, e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 pr-16 text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100" />
                    <button type="button" onClick={() => togglePasswordField(field)}
                      className="absolute right-3 top-8 text-xs text-gray-500 hover:text-gray-700">
                      {showPassword[field] ? "Masquer" : "Voir"}
                    </button>
                  </div>
                ))}
                <button type="button" onClick={handleUpdatePassword} disabled={savingPassword}
                  className="w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                  {savingPassword ? "Mise à jour..." : "Mettre à jour"}
                </button>
              </div>
            </section>

            {/* Clôture de compte */}
            <section className="rounded-xl border border-green-100 bg-green-50 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-green-700 text-xs font-semibold">
                  Tel
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-700">Demande de clôture de compte</p>
                  <p className="mt-2 text-sm leading-6 text-green-800/80">
                    Pour fermer votre compte, contactez l'administrateur PayPME. Votre historique sera conservé conformément à la réglementation.
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => showToast("Demande envoyée à l'administrateur")}
                className="mt-4 w-full rounded-2xl bg-green-700 px-4 py-3 text-sm font-semibold text-white hover:bg-green-800">
                Contacter
              </button>
            </section>
          </aside>
        </div>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl animate-bounce-in">
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span className="text-sm">{toastMessage}</span>
        </div>
      )}
    </MerchantLayout>
  );
}
