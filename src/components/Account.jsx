import { useEffect, useState } from 'react';
import { api, price } from '../api.js';

export default function Account({ user, onAuth, onLogout, profile, onSaveProfile, onDeleteProfile,
  onOpenOrder, onRestoreProfile, onOpenOutfit }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [orders, setOrders] = useState([]);
  const [versions, setVersions] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user) { setOrders([]); setVersions([]); setOutfits([]); return; }
    Promise.all([api('/me/orders'), api('/me/body/history'), api('/me/outfits')])
      .then(([ordersData, historyData, outfitsData]) => {
        setOrders(ordersData.orders); setVersions(historyData.versions); setOutfits(outfitsData.outfits);
      }).catch((err) => setError(err.message));
  }, [user, profile?.version]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try { await onAuth(mode, form); } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return <section className="account-page">
    <div className="section-heading"><div><span className="eyebrow">Личный кабинет</span><h1>{user ? user.name : 'Вход и регистрация'}</h1></div>
      {user && <button type="button" className="text-button" onClick={onLogout}>Выйти</button>}</div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {!user ? <div className="auth-panel">
      <div className="tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">Войти</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')} type="button">Регистрация</button></div>
      <form onSubmit={submit}>
        {mode === 'register' && <label>Имя<input required minLength="2" autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>}
        <label>Электронная почта<input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>Пароль<input required minLength="8" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
      </form>
    </div> : <div className="account-grid">
      <div className="account-block"><h2>Профиль тела</h2>
        <p className="muted">Мерки сохраняются только после вашего действия и доступны в этом аккаунте.</p>
        {profile ? <p>Сохранена версия {profile.version}: рост {profile.measurements.height} см, грудь {profile.measurements.chest} см, талия {profile.measurements.waist} см, бёдра {profile.measurements.hips} см.</p> : <p>Профиль пока не сохранён.</p>}
        <div className="inline-actions"><button type="button" className="btn" onClick={onSaveProfile}>Сохранить текущие мерки</button>
          {profile && <button type="button" className="btn btn--ghost" onClick={onDeleteProfile}>Удалить профиль</button>}</div>
      </div>
      <div className="account-block"><h2>Мои заказы</h2>
        {orders.length ? <div className="order-list">{orders.map((order) => <button type="button" key={order.id} onClick={() => onOpenOrder(order.id)}>
          <span>№ {order.id.slice(0, 8)} · {new Date(`${order.created_at.replace(' ', 'T')}Z`).toLocaleDateString('ru-RU')}</span>
          <span>{price(order.total)} · {order.fulfillment_status === 'cancelled' ? 'Отменён' : 'Оформлен'}</span>
        </button>)}</div> : <p className="muted">Заказов пока нет.</p>}
      </div>
      <div className="account-block"><h2>Версии мерок</h2>
        {versions.length ? <div className="order-list">{versions.map((item) => <div key={item.version}>
          <span>Версия {item.version} · грудь {item.measurements.chest} см · талия {item.measurements.waist} см</span>
          <button type="button" className="text-button" onClick={() => onRestoreProfile(item)}>Использовать</button>
        </div>)}</div> : <p className="muted">Нет сохранённых версий.</p>}
      </div>
      <div className="account-block"><h2>Сохранённые образы</h2>
        {outfits.length ? <div className="order-list">{outfits.map((item) => <div key={item.id}>
          <button type="button" className="text-button" onClick={() => onOpenOutfit(item)}>{item.name}</button>
          <button type="button" className="text-button" onClick={async () => {
            try { await api(`/me/outfits/${item.id}`, { method: 'DELETE' });
              setOutfits((rows) => rows.filter((row) => row.id !== item.id)); }
            catch (err) { setError(err.message); }
          }}>Удалить</button>
        </div>)}</div> : <p className="muted">Образов пока нет.</p>}
      </div>
    </div>}
  </section>;
}
