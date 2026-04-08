import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const usePushNotifications = (token: string | null) => {
  useEffect(() => {
    if (!token) return;

    const subscribeToPush = async () => {
      // ---> 1. Tratamento para Aplicativo Nativo (Android/iOS) usando Capacitor:
      if (Capacitor.isNativePlatform()) {
        try {
          // Solicita a permissão do usuário de forma nativa
          const permStatus = await PushNotifications.requestPermissions();
          if (permStatus.receive === 'granted') {
             // Se concedido, registra o aparelho no FCM (Firebase)
             await PushNotifications.register();
             
             // Escuta o momento que o Google responde com o Token do aparelho
             await PushNotifications.addListener('registration', async (tokenData) => {
               // Envia o token FCM para o nosso backend Node.js guardar
               await fetch('/api/subscribe', {
                 method: 'POST',
                 body: JSON.stringify({ endpoint: tokenData.value, isNative: true }), // Usamos endpoint aqui aproveitando a mesma estrutura do backend
                 headers: {
                   'Content-Type': 'application/json',
                   'Authorization': `Bearer ${token}`
                 }
               });
               console.log('Push nativo registrado com sucesso no backend.');
             });
             
             // Loga notificações recebidas em 1º plano no console:
             await PushNotifications.addListener('pushNotificationReceived', (notification) => {
               console.log('Push recebida em primeiro plano: ', notification);
             });
          } else {
            console.warn('Permissão de Push negada nativamente.');
          }
        } catch (e) {
          console.error('Erro ao registrar Push Notification nativa:', e);
        }
        // Retorna logo em seguida para não tentar rodar o código de Web Push (navegadores) abaixo
        return;
      }

      // ---> 2. Web Push Tradicional (Fallback para PC/Mac/Browser):
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications are not supported by the browser.');
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered with scope:', registration.scope);

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('Permission for notifications was denied');
          return;
        }

        const response = await fetch('/api/vapidPublicKey');
        const vapidPublicKey = await response.json();
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey.publicKey);

        let subscription = await registration.pushManager.getSubscription();
        
        if (subscription && subscription.options && subscription.options.applicationServerKey) {
          const currentKey = new Uint8Array(subscription.options.applicationServerKey);
          let keysMatch = currentKey.length === convertedVapidKey.length;
          if (keysMatch) {
            for (let i = 0; i < currentKey.length; i++) {
              if (currentKey[i] !== convertedVapidKey[i]) {
                keysMatch = false;
                break;
              }
            }
          }
          if (!keysMatch) {
            console.log('VAPID key changed, unsubscribing from old push subscription...');
            await subscription.unsubscribe();
            subscription = null;
          }
        }

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
          });
        }

        // Adiciona um campo flag indicando que é da plataforma WEB
        const payload = {
          ...subscription.toJSON(),
          isNative: false
        }

        await fetch('/api/subscribe', {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        console.log('Push notification web subscription successful.');
      } catch (error) {
        console.error('Error subscribing to push notifications:', error);
      }
    };

    subscribeToPush();
    
    // Cleanup de listeners nativos (recomendado) para não duplicar se o componente re-renderizar
    return () => {
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [token]);
};
