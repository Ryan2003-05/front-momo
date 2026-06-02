import { type ReactNode, useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import api from "../api";
import Toast from "./Toast";

// Types 

type MerchantLayoutProps = {
  children: ReactNode;
};

interface Operateur {
  nom: string;
}

interface CompteOperateur {
  id: string;
  operateur: Operateur;
}

interface Commercant {
  nom: string;
  prenom: string;
  nom_entreprise: string;
  telephone: string;
  ville: string;
  compte_operateurs?: CompteOperateur[];
  compteOperateurs?: CompteOperateur[];
}

interface NotificationItem {
  id: string;
  message?: string;
  lue: boolean;
  created_at: string;
  transaction?: {
    statut?: string;
    reference_gateway?: string;
    numero_client?: string;
    session_paiement?: {
      montant?: string;
      id?: string;
      compte_operateur?: {
        operateur?: {
          nom?: string;
        };
      };
    };
  };
}

// Nav 

const navItems = [
  {
    key: "dashboard",
    label: "Tableau de bord",
    path: "/dashboard",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    key: "payment",
    label: "Nouveau paiement",
    path: "/nouveau-paiement",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    key: "historique",
    label: "Historique",
    path: "/historique",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    key: "profil",
    label: "Mon profil",
    path: "/profil",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

//  Helpers 

function getInitials(nom: string, prenom: string): string {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

const opColors: Record<string, string> = {
  MTN:    "bg-amber-100 text-amber-800",
  Moov:   "bg-blue-100 text-blue-800",
  Celtiis: "bg-purple-100 text-purple-800",
};

const opLabels: Record<string, string> = {
  MTN:    "MTN MoMo",
  Moov:   "Moov Money",
  Celtiis: "Celtiis",
};

//  Composant 

export default function MerchantLayout({ children }: MerchantLayoutProps) {
  const navigate = useNavigate();
  const [commercant, setCommercant] = useState<Commercant | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const lastNotificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchProfil = async () => {
      try {
        const response = await api.get("/commercant/profil");

        console.log("Commercant =", response.data);

        setCommercant(response.data.commercant);
      } catch (err) {
        console.log("ERREUR PROFIL =", err);
      } finally {
        setProfileLoaded(true);
      }
    };
    fetchProfil();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchNotifications = async () => {
      try {
        const response = await api.get("/notifications");

        console.log("NOTIFICATIONS =", response.data);

        if (cancelled) return;

        const list: NotificationItem[] = response.data.notifications?.data ?? [];
        setNotifications(list.slice(0, 5));
        setUnreadCount(response.data.non_lues ?? 0);

        const latest = list[0];
        if (!latest) return;

        if (lastNotificationIdRef.current === null) {
          lastNotificationIdRef.current = latest.id;
          return;
        }

        if (latest.id !== lastNotificationIdRef.current) {
          lastNotificationIdRef.current = latest.id;
          setToastMessage(notificationMessage(latest));
        }
      } catch (err) {
        console.log("ERREUR NOTIFICATIONS =", err);
      }
    };

    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    navigate("/login");
  };

  const handleNotificationsClick = async () => {
    const nextOpen = !showNotifications;
    setShowNotifications(nextOpen);

    if (!nextOpen || unreadCount === 0) return;

    setUnreadCount(0);
    setNotifications((items) => items.map((item) => ({ ...item, lue: true })));

    try {
      await api.put("/notifications/toutes-lues");
    } catch {
      // Le prochain polling remettra le compteur correct si la requete echoue.
    }
  };

  const initials   = commercant ? getInitials(commercant.nom, commercant.prenom) : "??";
  const nomComplet = commercant ? `${commercant.prenom} ${commercant.nom}` : "Chargement...";
  const commerce   = commercant ? `${commercant.nom_entreprise} · ${commercant.ville}` : "";
  const comptes    = commercant?.compte_operateurs ?? commercant?.compteOperateurs ?? [];
  const latestNotifications = notifications.length > 0 ? notifications : [];

  function notificationMessage(notification: NotificationItem): string {
    if (notification.message) return notification.message;

    const montant = notification.transaction?.session_paiement?.montant ?? "0";
    const numeroClient = notification.transaction?.numero_client ?? "N/A";
    const operateur = notification.transaction?.session_paiement?.compte_operateur?.operateur?.nom ?? "Mobile Money";

    return `Vous venez de recevoir un paiement de ${Number(montant).toLocaleString("fr-FR")} FCFA. Numero: ${numeroClient}. Operateur: ${operateur}.`;
  }

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans text-gray-900">

      {/* Sidebar */}
      <aside className="flex w-50 shrink-0 flex-col border-r border-blue-900 bg-blue-950 text-white">
        <div className="flex items-center gap-2 border-b border-blue-900 px-4 py-4">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-600 text-xs font-medium text-white">
            P
          </div>
          <span className="text-sm font-medium">Paycom</span>
        </div>

        <nav className="flex-1 px-3 py-4 text-[13px]">
          {navItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              end
              className={({ isActive }) =>
                `mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left ${
                  isActive ? "bg-green-500/20 font-medium text-green-300" : "text-blue-100 hover:bg-white/10"
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-blue-900 p-3">
          <div className="flex items-center gap-2 rounded-md px-2 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-[10px] font-medium text-green-700 shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white">{commercant?.nom_entreprise ?? "..."}</p>
              <p className="text-[11px] text-blue-200">{commercant?.telephone ?? ""}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-2 text-[13px] text-red-300 hover:bg-red-500/10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">

        {/* Topbar */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Retour à l'accueil
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNotificationsClick}
              className="relative flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
              aria-label="Notifications"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-24 top-12 z-40 w-80 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-900">Notifications</p>
                  <span className="text-[10px] text-gray-400">{unreadCount} non lue{unreadCount > 1 ? "s" : ""}</span>
                </div>

                {latestNotifications.length > 0 ? (
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {latestNotifications.map((notification) => (
                      <div key={notification.id} className="rounded-md border border-gray-100 bg-gray-50 p-2">
                        <p className="text-xs leading-5 text-gray-700">{notificationMessage(notification)}</p>
                        <p className="mt-1 text-[10px] text-gray-400">
                          {new Date(notification.created_at).toLocaleString("fr-FR")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md bg-gray-50 p-3 text-center text-xs text-gray-400">Aucune notification</p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => navigate("/nouveau-paiement")}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
            >
              + Nouveau paiement
            </button>
          </div>
        </div>

        {/* Profile banner */}
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-5 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-green-200 bg-green-100 text-xs font-medium text-green-700 shrink-0">
            {initials}
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-medium">{nomComplet}</p>
            <p className="text-xs text-gray-500">{commerce}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {comptes.length > 0 ? comptes.map((c) => (
                <span
                  key={c.id}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${opColors[c.operateur.nom] ?? "bg-gray-100 text-gray-700"}`}
                >
                  {opLabels[c.operateur.nom] ?? c.operateur.nom}
                </span>
              )) : (
                <span className="text-[10px] text-gray-400">
                  {profileLoaded ? "Aucun compte opérateur" : "Chargement..."}
                </span>
              )}
            </div>
          </div>
          <div className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[11px] font-semibold text-green-700">
            En ligne
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </main>

      {toastMessage && (
        <Toast message={toastMessage} type="success" onClose={() => setToastMessage("")} />
      )}
    </div>
  );
}
