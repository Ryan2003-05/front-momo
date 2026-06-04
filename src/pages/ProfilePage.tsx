import { useEffect, useState } from "react";
import MerchantLayout from "../components/MerchantLayout";
import { Pencil, Plus, Power, Save, X } from "lucide-react";
import api from "../api";
import {
  MOBILE_MONEY_PLACEHOLDER,
  OPERATOR_LABELS,
  formatMobileMoneyNumber,
  normalizeMobileMoneyNumber,
  operatorBadgeClass,
  operatorLogoClass,
} from "../utils/mobileMoney";

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

type AccountForm = {
  operateurNom: string;
  number: string;
  active: boolean;
};

type DashboardStats = {
  stats: { total: number; reussies: number; volume: number; taux_succes: number };
  solde_total: string;
};

const operators = ["MTN", "Moov", "Celtiis"];

function emptyAccountForm(operateurNom = ""): AccountForm {
  return { operateurNom, number: "", active: true };
}

function mapCompteToAccount(co: {
  id: string;
  numero: string;
  actif: boolean;
  operateur: { nom: string };
}): AccountInfo {
  return {
    id: co.id,
    label: OPERATOR_LABELS[co.operateur.nom] ?? co.operateur.nom,
    number: formatMobileMoneyNumber(co.numero),
    colorClass: operatorLogoClass(co.operateur.nom),
    active: co.actif,
    operateurNom: co.operateur.nom,
  };
}

function sortAccounts(comptes: AccountInfo[]) {
  return [...comptes].sort((a, b) => operators.indexOf(a.operateurNom) - operators.indexOf(b.operateurNom));
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ProfilePage() {
  const [editingSection, setEditingSection] = useState<"none" | "personal" | "commerce">("none");
  const [toastMessage, setToastMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [savingAccountId, setSavingAccountId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm>(() => emptyAccountForm(operators[0]));

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
        const c = profilRes.data.commercant;
        const u = c.user;

        setPersonal({
          firstName: c.prenom,
          lastName: c.nom,
          phone: formatMobileMoneyNumber(c.telephone),
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
        const comptesData: AccountInfo[] = compteOperateurs.map(mapCompteToAccount);
        setAccounts(sortAccounts(comptesData));
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

  function getAccountError(err: unknown, fallback: string) {
    const error = err as { response?: { data?: { message?: string } } };
    return error.response?.data?.message || fallback;
  }

  function getAccountOperatorOptions(accountId: string | null = editingAccountId) {
    return operators.filter((op) => !accounts.some((a) => a.operateurNom === op && a.id !== accountId));
  }

  function startAddAccount() {
    if (accounts.length >= 3) {
      showToast("Maximum 3 comptes mobile money.");
      return;
    }

    const firstAvailable = getAccountOperatorOptions("new")[0];
    if (!firstAvailable) {
      showToast("Tous les opérateurs sont déjà configurés.");
      return;
    }

    setEditingAccountId("new");
    setAccountForm(emptyAccountForm(firstAvailable));
  }

  function startEditAccount(account: AccountInfo) {
    setEditingAccountId(account.id);
    setAccountForm({
      operateurNom: account.operateurNom,
      number: account.number,
      active: account.active,
    });
  }

  function cancelAccountForm() {
    setEditingAccountId(null);
    setAccountForm(emptyAccountForm(operators[0]));
  }

  function handleAccountFormChange(field: keyof AccountForm, value: string | boolean) {
    setAccountForm((prev) => ({ ...prev, [field]: value }));
  }

  function countActiveAfterSave(currentId: string | null, active: boolean) {
    const existingActive = accounts.reduce((count, account) => {
      if (account.id === currentId) return count + (active ? 1 : 0);
      return count + (account.active ? 1 : 0);
    }, 0);

    return currentId ? existingActive : existingActive + (active ? 1 : 0);
  }

  async function handleSaveAccount() {
    if (!editingAccountId) return;

    const isNew = editingAccountId === "new";
    const currentId = isNew ? null : editingAccountId;
    const numero = accountForm.number.trim();

    if (!accountForm.operateurNom) { showToast("Choisissez un opérateur."); return; }
    if (!numero) { showToast("Entrez le numéro mobile money."); return; }
    if (isNew && accounts.length >= 3) { showToast("Maximum 3 comptes mobile money."); return; }

    const duplicate = accounts.some((a) => a.operateurNom === accountForm.operateurNom && a.id !== currentId);
    if (duplicate) { showToast("Cet opérateur est déjà configuré."); return; }

    if (countActiveAfterSave(currentId, accountForm.active) < 1) {
      showToast("Vous devez garder au moins 1 compte actif.");
      return;
    }

    setSavingAccountId(editingAccountId);
    try {
      const payload = {
        operateur_nom: accountForm.operateurNom,
        numero: normalizeMobileMoneyNumber(numero),
        actif: accountForm.active,
      };

      if (isNew) {
        const response = await api.post<{ compte: Parameters<typeof mapCompteToAccount>[0] }>("/commercant/comptes-operateurs", payload);
        const saved = mapCompteToAccount(response.data.compte);
        setAccounts((prev) => sortAccounts([...prev, saved]));
        showToast("Compte mobile money ajouté");
      } else {
        const response = await api.put<{ compte: Parameters<typeof mapCompteToAccount>[0] }>(`/commercant/comptes-operateurs/${editingAccountId}`, payload);
        const saved = mapCompteToAccount(response.data.compte);
        setAccounts((prev) => sortAccounts(prev.map((a) => a.id === saved.id ? saved : a)));
        showToast("Compte mobile money mis à jour");
      }

      cancelAccountForm();
    } catch (err) {
      showToast(getAccountError(err, "Erreur lors de la sauvegarde du compte."));
    } finally {
      setSavingAccountId(null);
    }
  }

  async function handleToggleAccount(account: AccountInfo) {
    if (account.active && accounts.filter((a) => a.active).length <= 1) {
      showToast("Vous devez garder au moins 1 compte actif.");
      return;
    }

    setSavingAccountId(account.id);
    try {
      const response = await api.put<{ compte: Parameters<typeof mapCompteToAccount>[0] }>(`/commercant/comptes-operateurs/${account.id}`, {
        actif: !account.active,
      });
      const saved = mapCompteToAccount(response.data.compte);
      setAccounts((prev) => sortAccounts(prev.map((a) => a.id === saved.id ? saved : a)));
      showToast(saved.active ? "Compte activé" : "Compte désactivé");
    } catch (err) {
      showToast(getAccountError(err, "Erreur lors du changement de statut."));
    } finally {
      setSavingAccountId(null);
    }
  }

  // Sauvegarder le profil
  async function handleSavePersonal() {
    setSaving(true);
    try {
      await api.put("/commercant/profil", {
        nom: personal.lastName,
        prenom: personal.firstName,
        telephone: normalizeMobileMoneyNumber(personal.phone),
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
                  <span key={a.id} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${operatorBadgeClass(a.operateurNom)}`}>
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
                    { label: "Téléphone", value: formatMobileMoneyNumber(personal.phone) },
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
                      <input value={personal[field]} onChange={(e) => handlePersonalChange(field, field === "phone" ? formatMobileMoneyNumber(e.target.value) : e.target.value)}
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
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Comptes mobile money</p>
                  <p className="mt-1 text-xs text-gray-500">Maximum 3 comptes, au moins 1 actif.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{accounts.filter((a) => a.active).length} / {accounts.length} actifs</span>
                  <button type="button" onClick={startAddAccount} disabled={accounts.length >= 3 || Boolean(editingAccountId)}
                    title="Ajouter un compte"
                    className="inline-flex items-center gap-1.5 rounded-md border border-green-100 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50">
                    <Plus size={14} />
                    Ajouter
                  </button>
                </div>
              </div>

              {editingAccountId && (
                <div className="mb-4 rounded-2xl border border-green-100 bg-green-50/60 p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,160px)_minmax(0,1fr)_auto] md:items-end">
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Opérateur</span>
                      <select value={accountForm.operateurNom}
                        onChange={(e) => handleAccountFormChange("operateurNom", e.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100">
                        {getAccountOperatorOptions(editingAccountId).map((op) => (
                          <option key={op} value={op}>{OPERATOR_LABELS[op] ?? op}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Numéro</span>
                      <input type="tel" value={accountForm.number} placeholder={MOBILE_MONEY_PLACEHOLDER}
                        onChange={(e) => handleAccountFormChange("number", formatMobileMoneyNumber(e.target.value))}
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100" />
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700">
                      <input type="checkbox" checked={accountForm.active}
                        onChange={(e) => handleAccountFormChange("active", e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                      Actif
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={handleSaveAccount} disabled={savingAccountId === editingAccountId}
                      className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                      <Save size={14} />
                      {savingAccountId === editingAccountId ? "Enregistrement..." : "Enregistrer"}
                    </button>
                    <button type="button" onClick={cancelAccountForm} disabled={savingAccountId === editingAccountId}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                      <X size={14} />
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {accounts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
                    Aucun compte mobile money configuré.
                  </div>
                ) : accounts.map((account) => {
                  const isBusy = savingAccountId === account.id;
                  return (
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
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-gray-700">
                        <span className="font-medium">{account.number}</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => startEditAccount(account)} disabled={Boolean(editingAccountId) || isBusy}
                            title="Modifier"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                            <Pencil size={14} />
                          </button>
                          <button type="button" onClick={() => handleToggleAccount(account)} disabled={Boolean(editingAccountId) || isBusy}
                            title={account.active ? "Désactiver" : "Activer"}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-50 ${
                              account.active
                                ? "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                                : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            }`}>
                            <Power size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
