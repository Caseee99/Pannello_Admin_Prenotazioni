import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Send, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationToggle() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, []);

  async function checkExistingSubscription() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      }
    } catch (e) {
      console.error('Errore durante il controllo della sottoscrizione:', e);
    }
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      throw new Error('I Service Worker non sono supportati su questo browser.');
    }
    return navigator.serviceWorker.register('/sw.js');
  }

  async function subscribeUser() {
    setLoading(true);
    setStatusMessage(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setStatusMessage('Permesso notifiche negato dal browser/dispositivo.');
        setLoading(false);
        return;
      }

      const swReg = await registerServiceWorker();

      // Ottieni chiave VAPID dal backend
      const res = await api.get('/push/vapid-public-key');
      const publicKey = res.data.publicKey;

      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // Salva nel backend
      await api.post('/push/subscribe', subscription.toJSON());

      setIsSubscribed(true);
      setStatusMessage('Dispositivo iscritto con successo alle notifiche del mattino (08:00)!');
    } catch (err: any) {
      console.error('Errore iscrizione push:', err);
      setStatusMessage(`Errore durante l'attivazione: ${err.message || 'Impossibile iscriversi'}`);
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribeUser() {
    setLoading(true);
    setStatusMessage(null);
    try {
      const swReg = await navigator.serviceWorker.getRegistration();
      if (swReg) {
        const sub = await swReg.pushManager.getSubscription();
        if (sub) {
          await api.post('/push/unsubscribe', { endpoint: sub.endpoint });
          await sub.unsubscribe();
        }
      }
      setIsSubscribed(false);
      setStatusMessage('Notifiche disattivate per questo dispositivo.');
    } catch (err: any) {
      console.error('Errore disiscrizione:', err);
      setStatusMessage(`Errore disattivazione: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function sendTestNotification() {
    setLoading(true);
    try {
      await api.post('/push/test');
      setStatusMessage('Inviata notifica di prova! Controlla il tuo schermo/centro notifiche.');
    } catch (err: any) {
      setStatusMessage(`Errore notifica test: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function sendDailyTestNotification() {
    setLoading(true);
    try {
      await api.post('/push/test-daily');
      setStatusMessage('Inviato riepilogo del mattino di prova! Guarda la notifica in arrivo.');
    } catch (err: any) {
      setStatusMessage(`Errore notifica mattino: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="bg-slate-900 text-white rounded-t-lg">
        <CardTitle className="text-lg font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-400 animate-pulse" />
            <span>Notifiche del Mattino & PWA</span>
          </div>
          {isSubscribed ? (
            <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Attive ({permission})
            </Badge>
          ) : (
            <Badge variant="outline" className="text-slate-300 border-slate-700">
              Disattivate ({permission})
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
          <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
            <Clock className="h-4 w-4 text-blue-600" /> Notifica automatica quotidiana alle ore 08:00 AM
          </p>
          <p>
            Attiva questo dispositivo per ricevere ogni mattina un avviso sul tuo iPhone o Android con il conteggio delle corse e i dettagli della prima partenza del giorno.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {!isSubscribed ? (
            <Button
              onClick={subscribeUser}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium gap-2 shadow"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              Attiva Notifiche su questo iPhone/Dispositivo
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={unsubscribeUser}
                disabled={loading}
                className="text-red-600 border-red-200 hover:bg-red-50 gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
                Disattiva Notifiche
              </Button>

              <Button
                onClick={sendTestNotification}
                disabled={loading}
                variant="secondary"
                className="gap-2"
              >
                <Send className="h-4 w-4 text-blue-600" />
                Invia Notifica di Prova
              </Button>

              <Button
                onClick={sendDailyTestNotification}
                disabled={loading}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
              >
                <Clock className="h-4 w-4" />
                Simula Notifica Mattino (08:00)
              </Button>
            </>
          )}
        </div>

        {statusMessage && (
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-md text-xs font-medium flex items-center gap-2 border text-slate-800 dark:text-slate-200">
            {isSubscribed ? (
              <AlertCircle className="h-4 w-4 text-blue-500 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            )}
            <span>{statusMessage}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
