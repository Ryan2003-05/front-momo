import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProfilePage from "./pages/ProfilePage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminOperatorsPage from "./pages/AdminOperatorsPage";
import AdminMerchantsPage from "./pages/AdminMerchantsPage";
import HistoriquePage from "./pages/HistoriquePage";
import NewPaymentPage from "./pages/NewPaymentPage";
import SuccessConfirmPage from "./pages/SuccessConfirmPage";
import FailedConfirmPage from "./pages/FailedConfirmPage";
import GetewayPage from "./pages/GetewayPage";
import PushClientPage from "./pages/PushClientPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/operators" element={<AdminOperatorsPage />} />
        <Route path="/admin/operateurs" element={<AdminOperatorsPage />} />
        <Route path="/admin/merchants" element={<AdminMerchantsPage />} />
        <Route path="/admin/commercants" element={<AdminMerchantsPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/AdminDashboard" element={<AdminDashboardPage />} />
        <Route path="/historique" element={<HistoriquePage />} />
        <Route path="/historique-commercant" element={<HistoriquePage />} />
        <Route path="/nouveau-paiement" element={<NewPaymentPage />} />
        <Route path="/gateway" element={<GetewayPage />} />
        <Route path="/geteway" element={<GetewayPage />} />
        <Route path="/gateway/:sessionId" element={<GetewayPage />} />
        <Route path="/confirmation-paiement/succes" element={<SuccessConfirmPage />} />
        <Route path="/confirmation-paiement/echec" element={<FailedConfirmPage />} />
        <Route path="/SuccessConfirm" element={<SuccessConfirmPage />} />
        <Route path="/FailedConfirm" element={<FailedConfirmPage />} />
        <Route path="/success-confirm" element={<SuccessConfirmPage />} />
        <Route path="/failed-confirm" element={<FailedConfirmPage />} />
        <Route path="/push-client" element={<PushClientPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
