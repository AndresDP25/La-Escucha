import { useState, type FormEvent } from 'react';
import { createEcosystem, type EcosystemAccount, type EcosystemGroup, type TenantOption } from './api';
import { IconBack } from './icons';
import { AccountLogo } from './logos';

function spots(count: number): { x: number; y: number }[] {
  if (count <= 1) return [{ x: 50, y: 76 }];
  const cx = 50;
  const cy = 46;
  const radius = count === 2 ? 28 : 32;
  return Array.from({ length: count }, (_, index) => {
    const turn = count === 2 ? index * Math.PI : -Math.PI / 2 + (index * 2 * Math.PI) / count;
    return {
      x: cx + Math.cos(turn) * radius,
      y: cy + Math.sin(turn) * (count === 2 ? 8 : radius * 0.62),
    };
  });
}

export function EcosystemView({
  group,
  selectedId,
  onOpenAccount,
  onOpenGroup,
}: {
  group: EcosystemGroup;
  selectedId: string | null;
  onOpenAccount: (account: EcosystemAccount) => void;
  onOpenGroup: () => void;
}) {
  const points = spots(group.accounts.length);

  return (
    <section className="eco-page">
      <div className="page-head">
        <h2>{group.name}</h2>
        <p>Elegí el centro o una cuenta. Queda marcada arriba, y el monitoreo se abre desde Monitoreo.</p>
      </div>
      <div className="eco-map" aria-label={`Mapa de ${group.name}`}>
        <svg className="eco-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {points.map((point, index) => (
            <line key={group.accounts[index].id} x1="50" y1="46" x2={point.x} y2={point.y} />
          ))}
        </svg>
        <button
          type="button"
          className={`eco-hub${selectedId ? '' : ' on'}`}
          aria-pressed={!selectedId}
          onClick={onOpenGroup}
        >
          <span>{group.name}</span>
        </button>
        {group.accounts.map((account, index) => (
          <button
            key={account.id}
            type="button"
            className={`eco-node${selectedId === account.id ? ' on' : ''}`}
            aria-pressed={selectedId === account.id}
            style={{ left: `${points[index].x}%`, top: `${points[index].y}%` }}
            onClick={() => onOpenAccount(account)}
          >
            <AccountLogo slug={account.slug} size={36} />
            <strong>{account.name}</strong>
            <span className="muted">
              {account.instagramHandle ? `@${account.instagramHandle}` : 'Sin Instagram'}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function EcosystemsPage({
  groups,
  activeId,
  available,
  onBack,
  onSelect,
  onCreated,
}: {
  groups: EcosystemGroup[];
  activeId: string | null;
  available: TenantOption[];
  onBack: () => void;
  onSelect: (group: EcosystemGroup) => void;
  onCreated: (group: EcosystemGroup) => void;
}) {
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || picked.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const created = await createEcosystem(name.trim(), picked);
      setName('');
      setPicked([]);
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el ecosistema');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-page">
      <button type="button" className="back-btn" onClick={onBack}>
        <span className="back-icon">
          <IconBack size={18} />
        </span>
        Volver
      </button>
      <h2>Ecosistemas</h2>
        <p className="muted settings-lead">
        Elegí cuál se escucha. Cada cuenta entra en un solo ecosistema.
      </p>
      <h3 className="settings-kicker">Ya armados</h3>
      {groups.length === 0 ? (
        <p className="muted">Todavía no hay ecosistemas.</p>
      ) : (
        <ul className="account-catalog">
          {groups.map((group) => {
            const current = group.id === activeId;
            return (
            <li key={group.id} className={current ? 'current' : ''}>
              <button type="button" className="eco-pick" onClick={() => onSelect(group)} aria-pressed={current}>
                <span className="account-catalog-copy">
                  <strong>
                    {group.name}
                    {current ? <span className="pill">En uso</span> : null}
                  </strong>
                  <span className="muted">
                    {group.accounts.map((account) => account.name).join(' · ') || 'Sin cuentas'}
                  </span>
                </span>
              </button>
            </li>
            );
          })}
        </ul>
      )}
      <form className="card account-form eco-create" onSubmit={(event) => void onSubmit(event)}>
        <h3 className="settings-kicker">Nuevo ecosistema</h3>
        <label>
          Nombre
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} />
        </label>
        <fieldset>
          <legend>Cuentas</legend>
          {available.length === 0 ? (
            <p className="muted">No hay cuentas libres. Cada cuenta entra en un solo ecosistema.</p>
          ) : (
            available.map((tenant) => (
              <label key={tenant.id} className="eco-check">
                <input
                  type="checkbox"
                  checked={picked.includes(tenant.id)}
                  onChange={() => toggle(tenant.id)}
                />
                {tenant.name}
              </label>
            ))
          )}
        </fieldset>
        {error ? <p className="error">{error}</p> : null}
        <p className="eco-create-actions">
          <button className="btn" type="submit" disabled={busy || !name.trim() || picked.length === 0}>
            {busy ? 'Creando…' : 'Crear ecosistema'}
          </button>
        </p>
      </form>
    </div>
  );
}
