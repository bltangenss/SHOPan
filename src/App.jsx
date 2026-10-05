import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { api, price } from './api.js';
import { suggestedSize } from './utils/bodyGeometry.js';
import Catalog from './components/Catalog.jsx';
import ProductDetail from './components/ProductDetail.jsx';
import Checkout from './components/Checkout.jsx';
import Account from './components/Account.jsx';
import Admin from './components/Admin.jsx';
import MeasurementForm from './components/MeasurementForm.jsx';
import SceneErrorBoundary from './components/ErrorBoundary.jsx';
import ProductImage from './components/ProductImage.jsx';
import { ArrowLeft, CheckCircle2, ChevronRight, Grid2X2, Heart, Search, ScanLine, ShoppingBag, UserRound, X } from 'lucide-react';

const FittingStage = lazy(() => import('./components/FittingStage.jsx'));
const DEFAULT_MEASUREMENTS = { height: 168, chest: 92, waist: 74, hips: 98, shoulder: 40 };
const DEFAULT_SELECTION = { top: 'tee-milk', bottom: 'trousers-charcoal', dress: null };
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function currentRoute() { return decodeURIComponent(location.hash.slice(1)) || 'catalog'; }
function navigate(route) { location.hash = route; window.scrollTo({ top: 0, behavior: 'instant' }); }

export default function App() {
  const [route, setRoute] = useState(currentRoute);
  const [products, setProducts] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [measurements, setMeasurements] = useState(DEFAULT_MEASUREMENTS);
  const [gender, setGender] = useState('female');
  const [skinTone, setSkinTone] = useState('#E4C6A8');
  const [hairColor, setHairColor] = useState('#3B2A1E');
  const [selection, setSelection] = useState(DEFAULT_SELECTION);
  const [fittingProductId, setFittingProductId] = useState('tee-milk');
  const [fittingSku, setFittingSku] = useState('tee-milk-M');
  const [compareSku, setCompareSku] = useState('');
  const [showComparison, setShowComparison] = useState(false);
  const [outfitName, setOutfitName] = useState('');
  const [fitStatus, setFitStatus] = useState('');
  const [cart, setCart] = useState(() => readSaved('atelier-cart-v1', []));
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [notice, setNotice] = useState('');
  const [order, setOrder] = useState(null);
  const [orderError, setOrderError] = useState('');
  const [filters, setFilters] = useState({ query: '', category: 'all', audience: 'all' });
  const [favorites, setFavorites] = useState(() => { const saved = readSaved('shopan-favorites-v1', []); return Array.isArray(saved) ? saved : []; });
  const checkoutKey = useRef(crypto.randomUUID());

  useEffect(() => {
    const update = () => setRoute(currentRoute());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => { localStorage.setItem('atelier-cart-v1', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('shopan-favorites-v1', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5500);
    return () => clearTimeout(timer);
  }, [notice]);
  const toggleFavorite = (id) => setFavorites((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const openCatalog = (next = {}) => { setFilters({ query: '', category: 'all', audience: 'all', ...next }); navigate('catalog'); };
  const refreshCatalog = () => api('/catalog').then((data) => { setProducts(data.products); setCatalogError(''); });
  useEffect(() => {
    Promise.all([refreshCatalog(), api('/me').then((data) => setUser(data.user))])
      .catch((error) => setCatalogError(error.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!user) {
      setProfile(null); setMeasurements(DEFAULT_MEASUREMENTS);
      setGender('female'); setSkinTone('#E4C6A8'); setHairColor('#3B2A1E');
      return;
    }
    setMeasurements(DEFAULT_MEASUREMENTS);
    api('/me/body').then(({ profile: saved }) => {
      setProfile(saved);
      if (saved) {
        setMeasurements(saved.measurements); setGender(saved.gender);
        setSkinTone(saved.skinTone); setHairColor(saved.hairColor);
      }
    }).catch((error) => setNotice(error.message));
  }, [user?.id]);

  const activeProduct = products.find((item) => item.id === fittingProductId);
  const activeVariant = activeProduct?.variants.find((item) => item.sku === fittingSku) || activeProduct?.variants[0];
  const previewVariant = showComparison ? activeProduct?.variants.find((item) => item.sku === compareSku) || activeVariant : activeVariant;
  const profileVersion = profile && JSON.stringify(profile.measurements) === JSON.stringify(measurements) &&
    profile.gender === gender && profile.skinTone === skinTone && profile.hairColor === hairColor ? profile.version : 0;
  const outfit = useMemo(() => {
    const pieces = []; const colors = {}; const factors = {};
    for (const slot of ['top', 'bottom', 'dress']) {
      const product = products.find((item) => item.id === selection[slot]);
      if (!product) continue;
      pieces.push(product.piece);
      colors[product.piece] = product.id === fittingProductId ? previewVariant?.color : product.variants[0]?.color;
      if (product.id === fittingProductId && previewVariant) {
        factors[product.piece] = 1 + (SIZE_ORDER.indexOf(previewVariant.size) -
          SIZE_ORDER.indexOf(suggestedSize(measurements.chest))) * 0.045;
      }
    }
    return { pieces, colors, factors };
  }, [selection, products, fittingProductId, previewVariant?.size, previewVariant?.color, measurements.chest]);

  useEffect(() => {
    if (route !== 'fitting' || !activeVariant) return;
    const controller = new AbortController();
    setFitStatus('Проверяем выбранный вариант…');
    api('/try-on', { method: 'POST', signal: controller.signal, body: {
      sku: activeVariant.sku, profile: { measurements, gender, skinTone, hairColor },
      profileVersion,
    } }).then((result) => setFitStatus(result.limitation))
      .catch((error) => { if (!controller.signal.aborted) setFitStatus(error.message); });
    return () => controller.abort();
  }, [route, activeVariant?.sku, measurements, gender, skinTone, hairColor, profileVersion]);

  const chooseForFit = (productId, sku) => {
    const item = products.find((row) => row.id === productId);
    if (!item) return;
    setFittingProductId(productId);
    setFittingSku(sku || item.variants.find((variant) => variant.size === suggestedSize(measurements.chest))?.sku || item.variants[0]?.sku || '');
    setCompareSku(''); setShowComparison(false);
    setSelection((previous) => item.category === 'dress' ? { top: null, bottom: null, dress: item.id } :
      item.category === 'bottom' ? { ...previous, bottom: item.id, dress: null } :
        { ...previous, top: item.id, dress: null });
    navigate('fitting');
  };

  const cartRows = useMemo(() => cart.map((entry) => {
    const product = products.find((item) => item.variants.some((variant) => variant.sku === entry.sku));
    const variant = product?.variants.find((item) => item.sku === entry.sku);
    return product && variant ? { ...entry, product, variant } : null;
  }).filter(Boolean), [cart, products]);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const addToCart = (sku) => {
    const item = products.flatMap((product) => product.variants).find((variant) => variant.sku === sku);
    if (!item || item.stock < 1) { setNotice('Этот вариант сейчас недоступен'); return; }
    setCart((previous) => {
      const existing = previous.find((row) => row.sku === sku);
      if (existing) return previous.map((row) => row.sku === sku ?
        { ...row, quantity: Math.min(item.stock, row.quantity + 1) } : row);
      return [...previous, { sku, quantity: 1 }];
    });
    checkoutKey.current = crypto.randomUUID();
    setNotice('Товар добавлен в корзину');
  };
  const changeQuantity = (sku, quantity) => {
    const variant = products.flatMap((product) => product.variants).find((item) => item.sku === sku);
    if (!variant || !Number.isFinite(quantity)) return;
    setCart((previous) => previous.map((row) => row.sku === sku ?
      { ...row, quantity: Math.max(1, Math.min(variant.stock, Math.floor(quantity))) } : row));
    checkoutKey.current = crypto.randomUUID();
  };
  const removeFromCart = (sku) => {
    setCart((previous) => previous.filter((row) => row.sku !== sku));
    checkoutKey.current = crypto.randomUUID();
  };
  const checkout = async ({ customer, paymentScenario }) => {
    if (checkoutBusy) return;
    setCheckoutBusy(true); setCheckoutError('');
    try {
      const result = await api('/orders', { method: 'POST', body: {
        idempotencyKey: checkoutKey.current, items: cartRows.map(({ sku, quantity }) => ({ sku, quantity })),
        customer, fulfillment: 'pickup_arranged', paymentScenario,
      } });
      const receipts = readSaved('atelier-receipts-v1', {});
      receipts[result.id] = result.receiptToken;
      localStorage.setItem('atelier-receipts-v1', JSON.stringify(receipts));
      setOrder(result); setCart([]); checkoutKey.current = crypto.randomUUID();
      navigate(`order/${result.id}`);
      refreshCatalog().catch((error) => setNotice(error.message));
    } catch (error) { setCheckoutError(error.message); }
    finally { setCheckoutBusy(false); }
  };
  const authenticate = async (mode, form) => {
    const result = await api(`/auth/${mode}`, { method: 'POST', body: form });
    setUser(result.user); setNotice('Вы вошли в аккаунт');
  };
  const logout = async () => { await api('/auth/logout', { method: 'POST' }); setUser(null); setNotice('Вы вышли из аккаунта'); };
  const saveProfile = async () => {
    try {
      const result = await api('/me/body', { method: 'PUT', body: { measurements, gender, skinTone, hairColor } });
      setProfile(result.profile); setNotice('Мерки сохранены');
    } catch (error) { setNotice(error.message); }
  };
  const saveOutfit = async () => {
    if (!user || !activeVariant) return;
    try {
      await api('/me/outfits', { method: 'POST', body: {
        name: outfitName.trim() || `Образ ${new Date().toLocaleDateString('ru-RU')}`,
        selection, sku: activeVariant.sku, profileVersion,
      } });
      setOutfitName(''); setNotice('Образ сохранён в кабинете');
    } catch (error) { setNotice(error.message); }
  };
  const deleteProfile = async () => {
    try { await api('/me/body', { method: 'DELETE' }); setProfile(null); setNotice('Профиль тела удалён'); }
    catch (error) { setNotice(error.message); }
  };
  useEffect(() => {
    if (!route.startsWith('order/')) return;
    const id = route.slice(6);
    const token = readSaved('atelier-receipts-v1', {})[id];
    setOrderError('');
    api(`/orders/${id}`, { headers: token ? { 'X-Receipt-Token': token } : {} })
      .then((data) => setOrder(data.order)).catch((error) => setOrderError(error.message));
  }, [route, user?.id]);
  const cancelOrder = async () => {
    const token = readSaved('atelier-receipts-v1', {})[order.id];
    try {
      const result = await api(`/orders/${order.id}/cancel`, { method: 'POST', headers: token ? { 'X-Receipt-Token': token } : {} });
      setOrder(result.order); await refreshCatalog();
    } catch (error) { setNotice(error.message); }
  };

  let content;
  if (loading) content = <p className="empty-state">Загружаем каталог…</p>;
  else if (catalogError) content = <div className="empty-state" role="alert">{catalogError} <button type="button" onClick={() => refreshCatalog().catch((error) => setCatalogError(error.message))}>Повторить</button></div>;
  else if (route.startsWith('product/')) {
    const product = products.find((item) => item.id === route.slice(8));
    content = product ? <ProductDetail product={product} chestCm={measurements.chest} gender={gender}
      onBack={() => navigate('catalog')} onTryOn={chooseForFit} onAddToCart={addToCart}
      favorite={favorites.includes(product.id)} onFavorite={() => toggleFavorite(product.id)} /> :
      <p className="empty-state">Товар не найден.</p>;
  } else if (route === 'fitting') {
    content = <section className="fitting-page">
      <div className="breadcrumbs"><button onClick={() => navigate('catalog')}>Каталог</button><ChevronRight size={14} /><span>3D-примерочная</span></div>
      <div className="section-heading"><div><h1>3D-примерочная</h1><p className="section-subtitle">Ваш образ в SHOPan</p></div>
        <button className="back-link" onClick={() => navigate('catalog')}><ArrowLeft size={17} />Продолжить покупки</button></div>
      <div className="fitting-layout">
        <MeasurementForm measurements={measurements} onChange={setMeasurements} gender={gender} onGenderChange={setGender}
          skinTone={skinTone} onSkinTone={setSkinTone} hairColor={hairColor} onHairColor={setHairColor} />
        <SceneErrorBoundary><Suspense fallback={<div className="mirror-frame mirror-frame--error">Загружаем 3D-модель…</div>}>
          <FittingStage measurements={measurements} gender={gender} skinTone={skinTone} hairColor={hairColor} outfit={outfit} />
        </Suspense></SceneErrorBoundary>
        <div className="fitting-side"><h2>Ваш образ</h2>
          {activeProduct && <div className="fitting-product"><ProductImage product={activeProduct} /><div><span>SHOPan</span><strong>{activeProduct.name}</strong></div></div>}
          <label>Товар<select value={activeProduct?.id || ''} onChange={(event) => chooseForFit(event.target.value)}>
            {products.filter((item) => item.variants.length).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          {activeProduct && <><p className="fitting-side__price">{price(activeProduct.price)}</p>
            <p>{activeProduct.fabric}</p><label>Размер<select value={activeVariant?.sku || ''} onChange={(event) => {
              setFittingSku(event.target.value); setCompareSku(''); setShowComparison(false);
            }}>
              {activeProduct.variants.map((variant) => <option key={variant.sku} value={variant.sku} disabled={!variant.stock}>
                {variant.size} · {variant.color_name}{variant.stock ? '' : ' · нет в наличии'}</option>)}</select></label>
            <p className="muted">По мерке груди: {suggestedSize(measurements.chest)}. Проверьте таблицу размера и реальные замеры изделия.</p>
            <label>Сравнить с размером<select value={compareSku} onChange={(event) => { setCompareSku(event.target.value); setShowComparison(false); }}>
              <option value="">Не сравнивать</option>
              {activeProduct.variants.filter((variant) => variant.sku !== activeVariant?.sku && variant.color === activeVariant?.color && variant.stock > 0)
                .map((variant) => <option key={variant.sku} value={variant.sku}>{variant.size}</option>)}
            </select></label>
            {compareSku && <><div className="tabs size-compare">
              <button type="button" className={!showComparison ? 'active' : ''} onClick={() => setShowComparison(false)}>Выбранный {activeVariant?.size}</button>
              <button type="button" className={showComparison ? 'active' : ''} onClick={() => setShowComparison(true)}>Сравнить {activeProduct.variants.find((variant) => variant.sku === compareSku)?.size}</button>
            </div><p className="fine-print">Одинаковое тело и ракурс. Меняется объём 3D-вещи выбранного размера.</p></>}
            <button className="btn btn--wide" type="button" disabled={!activeVariant?.stock} onClick={() => addToCart(activeVariant.sku)}><ShoppingBag size={18} />В корзину</button>
            <button className="text-button" type="button" onClick={() => navigate(`product/${activeProduct.id}`)}>Открыть товар</button></>}
          <p className="fine-print" role="status">{fitStatus}</p>
          {user && <button className="btn btn--ghost btn--wide" type="button" onClick={saveProfile}>Сохранить мерки</button>}
          {user && <div className="save-outfit"><label>Название образа<input value={outfitName} onChange={(event) => setOutfitName(event.target.value)} placeholder="Например, на каждый день" /></label>
            <button className="btn btn--ghost btn--wide" type="button" onClick={saveOutfit}>Сохранить образ</button></div>}
        </div>
      </div>
    </section>;
  } else if (route === 'cart') {
    content = <Checkout rows={cartRows} onQuantity={changeQuantity} onRemove={removeFromCart} onCheckout={checkout}
      busy={checkoutBusy} error={checkoutError} user={user} onBrowse={() => navigate('catalog')} />;
  } else if (route === 'account') {
    content = <Account user={user} onAuth={authenticate} onLogout={logout} profile={profile}
      onSaveProfile={saveProfile} onDeleteProfile={deleteProfile} onOpenOrder={(id) => navigate(`order/${id}`)}
      onRestoreProfile={(version) => {
        setMeasurements(version.measurements); setGender(version.gender);
        setSkinTone(version.skinTone); setHairColor(version.hairColor); navigate('fitting');
      }} onOpenOutfit={(saved) => {
        const item = products.find((row) => row.variants.some((variant) => variant.sku === saved.sku));
        if (!item) { setNotice('Товар этого образа больше недоступен'); return; }
        setSelection(saved.selection); setFittingProductId(item.id); setFittingSku(saved.sku);
        setCompareSku(''); setShowComparison(false); navigate('fitting');
      }} />;
  } else if (route === 'admin') {
    content = user?.role === 'admin' ? <Admin onCatalogChange={refreshCatalog} /> : <p className="empty-state">Для управления магазином войдите как администратор.</p>;
  } else if (route.startsWith('order/')) {
    content = order && order.id === route.slice(6) ? <section className="order-page">
      <span className="eyebrow">Тестовый заказ</span><h1>Заказ № {order.id.slice(0, 8)}</h1>
      <p>Статус: {order.fulfillment_status === 'cancelled' ? 'отменён' : 'оформлен'} · {order.payment_status === 'test_confirmed' ? 'тестовая оплата подтверждена' : 'тестовая оплата отменена'}</p>
      <div className="order-list">{order.items.map((item) => <div key={item.sku}>{item.name} · {item.size} · {item.quantity} шт. <strong>{price(item.unit_price * item.quantity)}</strong></div>)}</div>
      <p className="order-total">Итого: {price(order.total)}</p>
      <p>Получение: самовывоз по согласованию. Контакт: {order.customer_email}</p>
      <p className="fine-print">Это тестовый заказ. Реальная оплата и доставка не подключены.</p>
      {order.fulfillment_status === 'new' && <button className="btn btn--ghost" type="button" onClick={cancelOrder}>Отменить заказ</button>}
    </section> : <p className="empty-state">{orderError || 'Загружаем заказ…'}</p>;
  } else content = <Catalog key={route === 'favorites' ? 'favorites' : 'catalog'} products={products} onOpen={(id) => navigate(`product/${id}`)}
    onBrowse={() => openCatalog()}
    onTryOn={(id) => id ? chooseForFit(id) : navigate('fitting')} filters={filters} onFilters={setFilters}
    favorites={favorites} onFavorite={toggleFavorite} favoritesOnly={route === 'favorites'} />;

  return <div className="app">
    <div className="utility-bar"><div><span>Интернет-магазин одежды</span><span>Тестовый режим · без списаний</span>{user?.role === 'admin' && <button onClick={() => navigate('admin')}>Управление магазином</button>}</div></div>
    <header className="site-header"><div className="site-header__inner">
      <button type="button" className="brand" aria-label="SHOPan, главная" onClick={() => openCatalog()}><ShoppingBag aria-hidden="true" /><span>SHOP<b>an</b></span></button>
      <button className="catalog-button" type="button" onClick={() => openCatalog()}><Grid2X2 size={19} />Каталог</button>
      <form className="header-search" role="search" onSubmit={(event) => { event.preventDefault(); setFilters((previous) => ({ ...previous, category: 'all', audience: 'all' })); navigate('catalog'); }}>
        <input aria-label="Поиск товаров" type="search" value={filters.query} placeholder="Найти в SHOPan" onChange={(event) => setFilters({ ...filters, query: event.target.value })} />
        <button type="submit" aria-label="Найти" title="Найти"><Search size={21} /></button>
      </form>
      <div className="site-header__actions">
        <button type="button" className={route === 'account' ? 'active' : ''} onClick={() => navigate('account')}><UserRound size={23} /><span>{user ? user.name : 'Войти'}</span></button>
        <button type="button" aria-label="Избранное" title="Избранное" className={route === 'favorites' ? 'active' : ''} onClick={() => { setFilters({ query: '', category: 'all', audience: 'all' }); navigate('favorites'); }}><span className="nav-icon"><Heart size={23} />{favorites.length > 0 && <b>{favorites.length}</b>}</span><span>Избранное</span></button>
        <button type="button" aria-label="Корзина" title="Корзина" className={route === 'cart' ? 'active' : ''} onClick={() => navigate('cart')}><span className="nav-icon"><ShoppingBag size={23} />{cartCount > 0 && <b>{cartCount}</b>}</span><span>Корзина</span></button>
      </div>
    </div>
      <nav className="category-nav" aria-label="Категории магазина"><div>
        <button className={route === 'catalog' && filters.category === 'all' && filters.audience === 'all' ? 'active' : ''} onClick={() => openCatalog()}>Вся одежда</button>
        <button className={route === 'catalog' && filters.audience === 'female' ? 'active' : ''} onClick={() => openCatalog({ audience: 'female' })}>Женщинам</button>
        <button className={route === 'catalog' && filters.audience === 'male' ? 'active' : ''} onClick={() => openCatalog({ audience: 'male' })}>Мужчинам</button>
        <button onClick={() => openCatalog({ category: 'top' })}>Футболки</button>
        <button onClick={() => openCatalog({ category: 'bottom' })}>Брюки и юбки</button>
        <button onClick={() => openCatalog({ category: 'dress' })}>Платья</button>
        <button onClick={() => openCatalog({ category: 'outerwear' })}>Верхняя одежда</button>
        <button className={`nav-fitting ${route === 'fitting' ? 'active' : ''}`} onClick={() => navigate('fitting')}><ScanLine size={18} />3D-примерочная</button>
      </div></nav>
    </header>
    <main className={`page-content ${route === 'fitting' ? 'page-content--fitting' : ''}`}>
      {notice && <div className="toast" role="status"><CheckCircle2 size={20} /><span>{notice}</span><button type="button" aria-label="Закрыть сообщение" onClick={() => setNotice('')}><X size={18} /></button></div>}{content}
    </main>
    <footer className="site-footer"><div className="footer-top"><button className="brand" onClick={() => openCatalog()}><span>SHOP<b>an</b></span></button><span>Одежда, которая вам подходит.</span><nav aria-label="Ссылки в подвале"><button onClick={() => openCatalog()}>Каталог</button><button onClick={() => navigate('fitting')}>Примерочная</button><button onClick={() => navigate('account')}>Личный кабинет</button></nav></div>
      <div className="footer-bottom"><span>© SHOPan, {new Date().getFullYear()}</span><span>Визуализации товаров. 3D-примерка приблизительная. SMPL: некоммерческое использование.</span></div>
    </footer>
    <nav className="mobile-nav" aria-label="Основная навигация">
      <button className={route === 'catalog' ? 'active' : ''} onClick={() => openCatalog()}><Grid2X2 size={21} />Каталог</button>
      <button className={route === 'favorites' ? 'active' : ''} onClick={() => { setFilters({ query: '', category: 'all', audience: 'all' }); navigate('favorites'); }}><Heart size={21} />Избранное</button>
      <button className={route === 'fitting' ? 'active' : ''} onClick={() => navigate('fitting')}><ScanLine size={21} />Примерка</button>
      <button className={route === 'cart' ? 'active' : ''} onClick={() => navigate('cart')}><span className="nav-icon"><ShoppingBag size={21} />{cartCount > 0 && <b>{cartCount}</b>}</span>Корзина</button>
      <button className={route === 'account' ? 'active' : ''} onClick={() => navigate('account')}><UserRound size={21} />Профиль</button>
    </nav>
  </div>;
}
