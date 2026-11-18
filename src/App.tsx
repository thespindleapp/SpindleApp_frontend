import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, LoginGate, RequireAuth } from './auth-context';
import { AppShell } from './components/AppShell';
import { BoardPage } from './pages/Board';
import { InboxPage } from './pages/Inbox';
import { EmailDetailPage } from './pages/EmailDetail';
import { AcceptInvitationPage } from './pages/AcceptInvitation';
import { LoginPage } from './pages/Login';
import { StyleCardPage } from './pages/StyleCard';
import { SuppliersPage } from './pages/Suppliers';
import { EmailConnectionsPage } from './pages/EmailConnections';
import { NotificationsPage } from './pages/Notifications';
import { ProfilePage } from './pages/Profile';
import { SubscriptionPage } from './pages/Subscription';
import { TeamPage } from './pages/Team';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <LoginGate>
              <LoginPage />
            </LoginGate>
          }
        />
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<BoardPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/styles/:styleId" element={<StyleCardPage />} />
            <Route path="/emails/:emailId/new" element={<Navigate to="/inbox" replace />} />
            <Route path="/emails/:emailId" element={<EmailDetailPage />} />
            <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
            <Route path="/settings/profile" element={<ProfilePage />} />
            <Route path="/settings/team" element={<TeamPage />} />
            <Route path="/settings/subscription" element={<SubscriptionPage />} />
            <Route path="/settings/email-connections" element={<EmailConnectionsPage />} />
            <Route path="/settings/notifications" element={<NotificationsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
