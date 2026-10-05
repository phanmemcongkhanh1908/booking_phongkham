import axios from 'axios';
import { useAuthStore } from '../store/auth';
import { useBookingStore } from '../store/booking';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Attach tenantId ONLY for public booking APIs if available (never leak to admin/auth APIs)
  const isPublicUrl = config.url?.startsWith('/public') || config.url?.startsWith('public');
  if (isPublicUrl) {
    const tenantId = useBookingStore.getState().tenantId;
    if (tenantId) {
      config.headers['x-tenant-id'] = tenantId;
    }
  }
  
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;
