import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { TenantOption } from './api';
import { IconInstagram, IconTwitter } from './icons';
import { AccountLogo } from './logos';

export function PublishPage({
  accounts,
  listeningId,
}: {
  accounts: TenantOption[];
  listeningId: string | null;
}) {
  const owned = useMemo(
    () => accounts.filter((account) => account.isOwned && account.isActive !== false),
    [accounts],
  );
  const [accountId, setAccountId] = useState(
    () => owned.find((account) => account.id === listeningId)?.id ?? owned[0]?.id ?? '',
  );
  const account = owned.find((item) => item.id === accountId) ?? owned[0] ?? null;
  const [network, setNetwork] = useState<'instagram' | 'twitter'>('instagram');
  const [caption, setCaption] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!account) return;
    if (network === 'instagram' && !account.instagramHandle && account.twitterHandle) {
      setNetwork('twitter');
    }
    if (network === 'twitter' && !account.twitterHandle && account.instagramHandle) {
      setNetwork('instagram');
    }
  }, [account, network]);

  function chooseAccount(id: string) {
    setAccountId(id);
    setReady(false);
  }

  function onPhoto(file: File | null) {
    setPhoto((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
    setReady(false);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!account || !caption.trim()) return;
    setReady(true);
  }

  if (!account) {
    return (
      <section className="publish-page">
        <div className="page-head">
          <h2>Publicar</h2>
          <p>Acá salen las publicaciones de las cuentas nuestras.</p>
        </div>
        <p className="hint">
          Todavía no hay una cuenta propia. Marcala en Ajustes → Cuentas.
        </p>
      </section>
    );
  }

  const handle = network === 'twitter' ? account.twitterHandle : account.instagramHandle;

  return (
    <section className="publish-page">
      <div className="page-head">
        <h2>Publicar</h2>
        <p>Solo con las cuentas nuestras. Sale como la que elijas.</p>
      </div>
      <form className="publish-layout" onSubmit={onSubmit}>
        <div className="publish-form card">
          <span className="muted">Publicar como</span>
          <div className="publish-accounts" role="listbox" aria-label="Cuenta propia">
            {owned.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === account.id ? 'on' : ''}
                aria-pressed={item.id === account.id}
                onClick={() => chooseAccount(item.id)}
              >
                <AccountLogo slug={item.slug} size={28} />
                <span>
                  <strong>{item.name}</strong>
                  <span className="muted">Propia</span>
                </span>
              </button>
            ))}
          </div>
          <div className="net-switch" role="tablist" aria-label="Dónde sale">
            <button
              type="button"
              className={network === 'instagram' ? 'on' : ''}
              disabled={!account.instagramHandle}
              onClick={() => {
                setNetwork('instagram');
                setReady(false);
              }}
            >
              Instagram
            </button>
            <button
              type="button"
              className={network === 'twitter' ? 'on' : ''}
              disabled={!account.twitterHandle}
              onClick={() => {
                setNetwork('twitter');
                setReady(false);
              }}
            >
              Twitter
            </button>
          </div>
          <label className="publish-photo">
            {photo ? <img src={photo} alt="" /> : <span>Sumar una foto</span>}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => onPhoto(event.target.files?.[0] ?? null)}
            />
          </label>
          <label>
            Texto
            <textarea
              rows={5}
              value={caption}
              placeholder="Escribí la publicación"
              onChange={(event) => {
                setCaption(event.target.value);
                setReady(false);
              }}
            />
          </label>
          <button className="btn" type="submit" disabled={!caption.trim() || !handle}>
            Publicar
          </button>
          {ready ? (
            <p className="ok-msg">
              Quedó armada como {account.name}. Cuando conectemos la cuenta, sale desde acá.
            </p>
          ) : null}
        </div>
        <article className="publish-preview card">
          <header>
            <AccountLogo slug={account.slug} size={36} />
            <span>
              <strong>{account.name}</strong>
              <span className="muted">{handle ? `@${handle}` : 'Sin usuario'}</span>
            </span>
            {network === 'twitter' ? <IconTwitter size={16} /> : <IconInstagram size={16} />}
          </header>
          {photo ? <img src={photo} alt="" /> : <div className="publish-preview-empty">La foto va acá</div>}
          <p>{caption.trim() || 'El texto de la publicación aparece acá.'}</p>
        </article>
      </form>
    </section>
  );
}
