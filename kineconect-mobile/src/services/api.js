import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants/config';

const api = axios.create({ baseURL: API_URL, timeout: 10000 });

let onSessionExpired = () => {};
export const setSessionExpiredHandler = (fn) => { onSessionExpired = fn; };

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        refreshing = refreshing || (async () => {
          const refresh = await SecureStore.getItemAsync('refresh_token');
          if (!refresh) throw new Error('sin refresh');
          const { data } = await axios.post(`${API_URL}/api/token/refresh/`, { refresh });
          await SecureStore.setItemAsync('access_token', data.access);
          if (data.refresh) await SecureStore.setItemAsync('refresh_token', data.refresh);
          return data.access;
        })();
        const newAccess = await refreshing;
        refreshing = null;
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (e) {
        refreshing = null;
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  }
);

export default api;