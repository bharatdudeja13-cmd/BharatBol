import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

/**
 * Native install only when the browser fires beforeinstallprompt
 * (Chrome/Edge Android, some desktop). No how-to popup.
 */
export function PwaInstallButton({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!canInstall) return null;

  return (
    <button
      type="button"
      className={className || 'btn-secondary text-sm !py-2 !px-4'}
      onClick={async () => {
        const ev = deferred.current;
        if (!ev) return;
        await ev.prompt();
        deferred.current = null;
        setCanInstall(false);
      }}
    >
      {t('pwa.install')}
    </button>
  );
}

/** Optional compact strip for Header / Add — only renders when installable. */
export function PwaInstallSlot({ children }: { children?: ReactNode }) {
  return (
    <>
      <PwaInstallButton />
      {children}
    </>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
