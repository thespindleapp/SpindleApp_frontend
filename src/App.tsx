import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, LoginGate, RequireAuth } from './auth-context';
import { AppShell } from './components/AppShell';
import { BoardPage } from './pages/Board';
import { InboxPage } from './pages/Inbox';
import { EmailDetailPage } from './pages/EmailDetail';
import { NewFromEmailPage } from './pages/NewFromEmail';
import { AcceptInvitationPage } from './pages/AcceptInvitation';
import { LoginPage } from './pages/Login';
import { StyleCardPage } from './pages/StyleCard';
import { EmailConnectionsPage } from './pages/EmailConnections';

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
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/styles/:styleId" element={<StyleCardPage />} />
            <Route path="/emails/:emailId/new" element={<NewFromEmailPage />} />
            <Route path="/emails/:emailId" element={<EmailDetailPage />} />
            <Route path="/settings/email-connections" element={<EmailConnectionsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
