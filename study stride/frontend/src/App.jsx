import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { MaterialProvider } from './context/MaterialContext';

import TopicFiles from './pages/TopicFiles';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import LearningMode from './pages/LearningMode';
import Notes from './pages/Notes';
import Flashcards from './pages/Flashcards';
import Quiz from './pages/Quiz';
import GeneratedContent from './pages/GeneratedContent';
import Profile from './pages/Profile';
import HomeChat from './pages/HomeChat';
import Loader from './components/common/Loader';

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader /></div>;
  return user ? children : <Navigate to="/login" replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
    <Route path="/upload" element={<Protected><Upload /></Protected>} />
    <Route path="/topic/:topicId/files" element={<Protected><TopicFiles /></Protected>} />
    <Route path="/learn/:materialId" element={<Protected><LearningMode /></Protected>} />
    <Route path="/material/:materialId/notes" element={<Protected><Notes /></Protected>} />
    <Route path="/material/:materialId/flashcards" element={<Protected><Flashcards /></Protected>} />
    <Route path="/material/:materialId/quiz" element={<Protected><Quiz /></Protected>} />
    <Route path="/material/:materialId/generate" element={<Protected><GeneratedContent /></Protected>} />
    
    
    <Route path="/profile" element={<Protected><Profile /></Protected>} />
    <Route path="/chat" element={<Protected><HomeChat /></Protected>} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <MaterialProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </MaterialProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;