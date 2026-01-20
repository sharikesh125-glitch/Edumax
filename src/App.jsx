import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import PdfLibrary from './pages/PdfLibrary';
import PdfViewer from './pages/PdfViewer';
import StateBoards from './pages/StateBoards';
import AdminUpload from './pages/AdminUpload';
import AdminPayments from './pages/AdminPayments';
import DashboardLayout from './layouts/DashboardLayout';
import './App.css';

const PrivateRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/state-boards"
          element={
            <PrivateRoute>
              <DashboardLayout>
                <StateBoards />
              </DashboardLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/upload"
          element={
            <PrivateRoute>
              <DashboardLayout>
                <AdminUpload />
              </DashboardLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/payments"
          element={
            <PrivateRoute>
              <DashboardLayout>
                <AdminPayments />
              </DashboardLayout>
            </PrivateRoute>
          }
        />

        <Route
          path="/library"
          element={
            <PrivateRoute>
              <PdfLibrary />
            </PrivateRoute>
          }
        />
        <Route
          path="/pdf/:id"
          element={
            <PrivateRoute>
              <PdfViewer />
            </PrivateRoute>
          }
        />

        {/* Redirect root to library. PrivateRoute will handle login check if needed, 
            but for better UX we can redirect to login if not auth'd at the route level 
            or just let the library route handle it. 
            However, user wants "Login -> Library". 
            Let's redirect root to /login, and Login page auto-redirects to /library. */}
        <Route path="/" element={<Navigate to="/login" />} />
        {/* Catch-all for /dashboard to redirect to library if user manually types it */}
        <Route path="/dashboard" element={<Navigate to="/library" />} />
      </Routes>
    </Router>
  );
}

export default App;
