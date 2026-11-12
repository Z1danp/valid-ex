import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '@/shared/components/AppLayout';
import LoginPage from '@/features/auth/LoginPage';
import CalibrationListPage from '@/features/calibration/pages/CalibrationListPage';
import CalibrationWizardPage from '@/features/calibration/pages/CalibrationWizardPage';
import CalibrationDetailPage from '@/features/calibration/pages/CalibrationDetailPage';
import QcProfilesPage from '@/features/qc/pages/QcProfilesPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/calibrations" replace /> },
      { path: 'calibrations', element: <CalibrationListPage /> },
      { path: 'calibrations/new', element: <CalibrationWizardPage /> },
      { path: 'calibrations/:id', element: <CalibrationDetailPage /> },
      { path: 'qc-profiles', element: <QcProfilesPage /> },
      { path: '*', element: <Navigate to="/calibrations" replace /> },
    ],
  },
]);
