import { create } from 'zustand';

interface PatientAuthState {
  token: string | null;
  user: any | null;
  setAuth: (token: string, user: any) => void;
  logout: () => void;
}

export const usePatientAuthStore = create<PatientAuthState>((set) => ({
  token: localStorage.getItem('patientToken'),
  user: JSON.parse(localStorage.getItem('patientUser') || 'null'),
  setAuth: (token, user) => {
    localStorage.setItem('patientToken', token);
    localStorage.setItem('patientUser', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('patientToken');
    localStorage.removeItem('patientUser');
    set({ token: null, user: null });
  },
}));
