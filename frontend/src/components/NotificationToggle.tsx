import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bell, BellOff, Send, Clock, CheckCircle2, AlertCircle,
  Loader2, Smartphone, Info, ExternalLink, ShieldAlert, RefreshCw
} from 'lucide-react';

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

function detectPlatform() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isPWA = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
  return { isIOS, isSafari, isAndroid, isPWA };
}

export default function NotificationToggle() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('info');
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [platform, setPlatform] = useState({ isIOS: false, isSafari: false, isAndroid: false, isPWA: false });

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
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
      throw new Error('I Service Worker non sono supportati su questo browser/dispositivo.');
    }
    return navigator.serviceWorker.register('/sw.js');
  }

  async function subscribeUser() {
    const p = detectPlatform();

    // Su iOS, le notifiche push web funzionano solo se l'app è installata come PWA
    if (p.isIOS && !p.isPWA) {
      setShowIOSGuide(true);
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setStatusMessage('Permesso notifiche negato. Vai in Impostazioni del browser e abilita le notifiche per questo sito.');
        setStatusType('error');
        setLoading(false);
        return;
      }

      await registerServiceWorker();
      const swReg = await navigator.serviceWorker.ready;

      // Se esiste già una sottoscrizione precedente (es. con vecchie chiavi VAPID), la resettiamo
      const existingSub = await swReg.pushManager.getSubscription();
      if (existingSub) {
        try {
          await existingSub.unsubscribe();
          console.log('[NotificationToggle] Vecchia iscrizione rimossa, creazione nuova...');
        } catch (e) {
          console.warn('[NotificationToggle] Pulizia vecchia iscrizione:', e);
        }
      }

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
      setStatusMessage('✅ Dispositivo iscritto! Riceverai la notifica ogni mattina alle 08:00 e un alert 1 ora prima di ogni corsa.');
      setStatusType('success');
    } catch (err: any) {
      console.error('Errore iscrizione push:', err);
      setStatusMessage(`❌ Errore durante l'attivazione: ${err.message || 'Impossibile iscriversi'}`);
      setStatusType('error');
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
      setStatusType('info');
    } catch (err: any) {
      console.error('Errore disiscrizione:', err);
      setStatusMessage(`Errore disattivazione: ${err.message}`);
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  }

  async function sendTestNotification() {
    setLoading(true);
    try {
      const res = await api.post('/push/test');
      setStatusMessage(`✅ ${res.data?.message || 'Notifica di prova inviata! Controlla il centro notifiche.'}`);
      setStatusType('success');
    } catch (err: any) {
      const errorText = err.response?.data?.error || err.response?.data?.message || err.message;
      setStatusMessage(`❌ ${errorText}`);
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  }

  async function sendDailyTestNotification() {
    setLoading(true);
    try {
      const res = await api.post('/push/test-daily');
      setStatusMessage(`✅ ${res.data?.message || 'Riepilogo del mattino inviato! Guarda la notifica in arrivo.'}`);
      setStatusType('success');
    } catch (err: any) {
      const errorText = err.response?.data?.error || err.response?.data?.message || err.message;
      setStatusMessage(`❌ ${errorText}`);
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  }

  async function resubscribe() {
    setLoading(true);
    setStatusMessage('🔄 Rinnovo iscrizione in corso...');
    setStatusType('info');
    try {
      // Prima disiscriviamo
      const swReg = await navigator.serviceWorker.getRegistration();
      if (swReg) {
        const sub = await swReg.pushManager.getSubscription();
        if (sub) {
          try { await api.post('/push/unsubscribe', { endpoint: sub.endpoint }); } catch { }
          await sub.unsubscribe();
        }
      }
      setIsSubscribed(false);
      setLoading(false);
      // Poi riscriviamo
      await subscribeUser();
    } catch (err: any) {
      setStatusMessage(`❌ Errore rinnovo: ${err.message}`);
      setStatusType('error');
      setLoading(false);
    }
  }

  const statusBgColor = statusType === 'success'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : statusType === 'error'
      ? 'bg-red-50 border-red-200 text-red-800'
      : 'bg-slate-100 border-slate-200 text-slate-800';

  const statusIcon = statusType === 'success'
    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
    : statusType === 'error'
      ? <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
      : <AlertCircle className="h-4 w-4 text-blue-500 shrink-0" />;

  return (
    <Card className="border shadow-sm overflow-hidden">
      <CardHeader className="bg-slate-900 text-white rounded-t-lg">
        <CardTitle className="text-lg font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-400 animate-pulse" />
            <span>Notifiche Push & PWA</span>
          </div>
          {isSubscribed ? (
            <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Attive
            </Badge>
          ) : permission === 'denied' ? (
            <Badge variant="destructive" className="flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> Permesso Negato
            </Badge>
          ) : (
            <Badge variant="outline" className="text-slate-300 border-slate-600">
              Disattivate
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-6 space-y-5">

        {/* Info orari */}
        <div className="text-sm text-slate-600 space-y-2 bg-blue-50 border border-blue-100 rounded-lg p-4">
          <p className="flex items-center gap-2 font-semibold text-slate-800">
            <Clock className="h-4 w-4 text-blue-600 shrink-0" />
            Notifiche automatiche attive:
          </p>
          <ul className="ml-6 space-y-1 list-disc text-slate-700">
            <li><strong>Ogni mattina alle 08:00</strong> — Riepilogo di tutte le corse del giorno</li>
            <li><strong>~1 ora prima di ogni corsa</strong> — Alert per non perdere nessuna partenza</li>
          </ul>
        </div>

        {/* Guida iOS */}
        {platform.isIOS && !platform.isPWA && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
            <p className="flex items-center gap-2 font-semibold text-amber-800 text-sm">
              <Smartphone className="h-4 w-4 shrink-0" />
              ⚠️ Su iPhone le notifiche richiedono l'installazione come app
            </p>
            <button
              onClick={() => setShowIOSGuide(!showIOSGuide)}
              className="text-xs text-amber-700 underline flex items-center gap-1"
            >
              <Info className="h-3 w-3" />
              {showIOSGuide ? 'Nascondi istruzioni' : 'Mostra istruzioni per iPhone'}
            </button>
            {showIOSGuide && (
              <ol className="text-xs text-amber-800 space-y-2 list-decimal ml-4 leading-relaxed">
                <li>Apri questa pagina in <strong>Safari</strong> (non Chrome o Firefox)</li>
                <li>Tocca il pulsante <strong>Condividi</strong> (quadrato con freccia su) in basso</li>
                <li>Scorri e seleziona <strong>"Aggiungi a schermata Home"</strong></li>
                <li>Tocca <strong>"Aggiungi"</strong> in alto a destra</li>
                <li>Apri l'app dalla schermata Home (non da Safari)</li>
                <li>Torna in Impostazioni e attiva le notifiche</li>
              </ol>
            )}
          </div>
        )}

        {/* PWA già installata su iOS */}
        {platform.isIOS && platform.isPWA && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            App installata come PWA — le notifiche sono supportate su questo dispositivo.
          </div>
        )}

        {/* Pulsanti azione */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {!isSubscribed ? (
            <Button
              onClick={subscribeUser}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium gap-2 shadow"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              {platform.isIOS && !platform.isPWA
                ? 'Come attivare su iPhone →'
                : 'Attiva Notifiche su questo Dispositivo'
              }
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
                Disattiva
              </Button>

              <Button
                variant="outline"
                onClick={resubscribe}
                disabled={loading}
                className="text-blue-600 border-blue-200 hover:bg-blue-50 gap-2"
                title="Usa se le notifiche non arrivano: rinnova la sottoscrizione con le chiavi attuali"
              >
                <RefreshCw className="h-4 w-4" />
                Rinnova Iscrizione
              </Button>

              <Button
                onClick={sendTestNotification}
                disabled={loading}
                variant="secondary"
                className="gap-2"
              >
                <Send className="h-4 w-4 text-blue-600" />
                Test Notifica
              </Button>

              <Button
                onClick={sendDailyTestNotification}
                disabled={loading}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
              >
                <Clock className="h-4 w-4" />
                Simula Riepilogo 08:00
              </Button>
            </>
          )}
        </div>

        {/* Messaggio di stato */}
        {statusMessage && (
          <div className={`p-3 rounded-md text-xs font-medium flex items-start gap-2 border ${statusBgColor}`}>
            {statusIcon}
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Info tecnica: istruzioni cron-job.org */}
        <details className="group">
          <summary className="text-xs text-slate-400 cursor-pointer flex items-center gap-1 hover:text-slate-600 transition-colors select-none">
            <Info className="h-3 w-3" />
            Informazioni tecniche e configurazione cron esterno
          </summary>
          <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-3">
            <p className="font-semibold text-slate-700">⚠️ Perché configurare un cron esterno?</p>
            <p className="text-slate-600">
              Il backend su Render.com (piano gratuito) va in <strong>sleep dopo 15 minuti</strong> di inattività.
              Quando il server dorme, il cron interno non funziona. È necessario un servizio esterno che
              svegli il server all'orario giusto e invii le notifiche.
            </p>
            <div className="space-y-2">
              <p className="font-semibold text-slate-700">📋 Configurazione su cron-job.org (gratuito):</p>
              <div className="space-y-2 font-mono text-slate-600 bg-white border rounded p-3 leading-relaxed">
                <p>
                  <span className="text-green-600">✓ Keep-alive</span> (ogni 14 min):<br />
                  <span className="text-blue-600">GET</span> https://pannello-admin-prenotazioni.onrender.com/health
                </p>
                <p>
                  <span className="text-amber-600">✓ Riepilogo mattino</span> (ore 08:00 ogni giorno):<br />
                  <span className="text-blue-600">GET</span> /api/push/cron-morning?secret=secret-morning-cron-key-2026
                </p>
                <p>
                  <span className="text-purple-600">✓ Alert imminenti</span> (ogni 30 min):<br />
                  <span className="text-blue-600">GET</span> /api/push/cron-upcoming?secret=secret-morning-cron-key-2026
                </p>
              </div>
              <a
                href="https://cron-job.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline"
              >
                <ExternalLink className="h-3 w-3" />
                Apri cron-job.org →
              </a>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
