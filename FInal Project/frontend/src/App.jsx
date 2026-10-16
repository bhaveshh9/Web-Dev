import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Logout from './pages/Logout.jsx';
import TeacherDashboard from './pages/TeacherDashboard.jsx';
import TeacherUpload from './pages/TeacherUpload.jsx';
import StudyMaterials from './pages/StudyMaterials.jsx';
import GeneratedExams from './pages/GeneratedExams.jsx';
import ViewGeneratedExam from './pages/ViewGeneratedExam.jsx';
import StudentReports from './pages/StudentReports.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import Upload from './pages/Upload.jsx';
import Exam from './pages/Exam.jsx';
import Result from './pages/Result.jsx';

// Same URLs as the Flask app.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/logout" element={<Logout />} />

      {/* Teacher */}
      <Route path="/teacher/dashboard" element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/teacher/upload" element={<ProtectedRoute role="teacher"><TeacherUpload /></ProtectedRoute>} />
      <Route path="/teacher/materials" element={<ProtectedRoute role="teacher"><StudyMaterials /></ProtectedRoute>} />
      <Route path="/generated_exams" element={<ProtectedRoute role="teacher"><GeneratedExams /></ProtectedRoute>} />
      <Route path="/generated_exams/:examId" element={<ProtectedRoute role="teacher"><ViewGeneratedExam /></ProtectedRoute>} />
      <Route path="/student_reports" element={<ProtectedRoute role="teacher"><StudentReports /></ProtectedRoute>} />

      {/* Student */}
      <Route path="/student/dashboard" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
      <Route path="/upload" element={<ProtectedRoute role="student"><Upload /></ProtectedRoute>} />
      <Route path="/exam" element={<ProtectedRoute><Exam /></ProtectedRoute>} />
      <Route path="/result" element={<ProtectedRoute><Result /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
