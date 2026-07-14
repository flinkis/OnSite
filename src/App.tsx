import { Route, Routes } from 'react-router-dom';
import {
  RequireAdmin,
  RequireAuth,
  RequireUser,
  RootRedirect,
} from './components/RouteGuards';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { PrintQrPage } from './pages/PrintQrPage';
import { ScanPage } from './pages/ScanPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<RequireUser />}>
          <Route path="/scan" element={<ScanPage />} />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/print/:id" element={<PrintQrPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
