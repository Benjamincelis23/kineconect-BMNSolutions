import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const QUEUE = 'feedback_queue';

export const cacheSet = (k, v) => AsyncStorage.setItem(k, JSON.stringify(v)).catch(() => {});
export const cacheGet = async (k) => {
  try {
    const v = await AsyncStorage.getItem(k);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};

export async function contarPendientesCola() {
  const q = (await cacheGet(QUEUE)) || [];
  return Array.isArray(q) ? q.length : 0;
}

// Devuelve 'enviado' o 'en_cola'. Solo encola si NO hubo respuesta del servidor (sin señal).
export async function enviarFeedback(payload) {
  try {
    await api.post('/api/feedback/', payload);
    return 'enviado';
  } catch (e) {
    if (e.response) throw e;
    const q = (await cacheGet(QUEUE)) || [];
    q.push(payload);
    await cacheSet(QUEUE, q);
    return 'en_cola';
  }
}

export async function vaciarCola() {
  const q = (await cacheGet(QUEUE)) || [];
  if (!q.length) return 0;
  const pendientes = [];
  for (const p of q) {
    try {
      await api.post('/api/feedback/', p);
    } catch (e) {
      if (!e.response) pendientes.push(p);
    }
  }
  await cacheSet(QUEUE, pendientes);
  return pendientes.length;
}