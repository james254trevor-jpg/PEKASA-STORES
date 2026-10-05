import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, PackagePlus, Search, ShoppingBag } from 'lucide-react';
import { sqliteService } from '../db/sqlite';
import { useAuth } from '../context/AuthContext';
import { formatKES } from '../utils/numbering';

type StatusFilter = 'ALL' | 'IN_STOCK' | 'SOLD';

export const PersonalGoodsView: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const [goods, setGoods] = useState<any[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [saleId, setSaleId] = useState('');
  const [message, setMessage] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const refresh = () => setGoods(sqliteService.getPersonalGoods());
  useEffect(() => {
    refresh();
    return sqliteService.subscribe(refresh);
  }, []);

  const totals = useMemo(() => goods.reduce((sum, item) => ({
    stockCost: sum.stockCost + (item.status === 'IN_STOCK' ? Number(item.purchase_price) : 0),
    asking: sum.asking + (item.status === 'IN_STOCK' ? Number(item.asking_price) : 0),
    revenue: sum.revenue + (item.status === 'SOLD' ? Number(item.sale_price || 0) : 0),
    profit: sum.profit + (item.status === 'SOLD' ? Number(item.sale_price || 0) - Number(item.purchase_price || 0) : 0)
  }), { stockCost: 0, asking: 0, revenue: 0, profit: 0 }), [goods]);

  const visibleGoods = goods.filter((item) => {
    const matchesStatus = filter === 'ALL' || item.status === filter;
    const query = search.trim().toLowerCase();
    return matchesStatus && (!query || [item.item_name, item.category, item.seller_name, item.buyer_name].some((value) => String(value || '').toLowerCase().includes(query)));
  });

  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 dark:border-white/10 dark:bg-slate-950 dark:text-white';
  const label = 'mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300';

  if (!isAdmin) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800">Administrator access required.</div>;

  const handlePurchase = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const purchase = Number(form.get('purchase_price'));
    const asking = Number(form.get('asking_price'));
    if (!String(form.get('item_name') || '').trim() || purchase < 0 || asking < 0) return;
    sqliteService.addPersonalGood({
      item_name: String(form.get('item_name')).trim(), category: String(form.get('category') || 'Other'),
      details: String(form.get('details') || '').trim(), item_condition: String(form.get('item_condition') || ''),
      purchase_price: purchase, asking_price: asking, seller_name: String(form.get('seller_name') || '').trim(),
      purchase_date: String(form.get('purchase_date') || today), notes: String(form.get('notes') || '').trim(),
      created_by: currentUser?.full_name || currentUser?.username || 'Admin'
    });
    event.currentTarget.reset();
    setMessage('Purchase recorded and synced.');
    refresh();
  };

  const handleSale = (event: React.FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('sale_price'));
    if (amount < 0) return;
    sqliteService.recordPersonalGoodSale(id, {
      sale_price: amount, buyer_name: String(form.get('buyer_name') || '').trim(),
      buyer_phone: String(form.get('buyer_phone') || '').trim(), sale_date: String(form.get('sale_date') || today),
      payment_method: String(form.get('payment_method') || ''), payment_reference: String(form.get('payment_reference') || '').trim()
    });
    setSaleId('');
    setMessage('Sale recorded and synced.');
    refresh();
  };

  return (
    <section className="space-y-6">
      <header className="flex items-start gap-3">
        <div className="rounded-2xl bg-teal-500/10 p-3 text-teal-600 dark:text-teal-300"><ShoppingBag className="h-6 w-6" /></div>
        <div><h1 className="text-2xl font-black text-slate-900 dark:text-white">Personal Goods</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Track goods you personally buy and sell. These records stay separate from Rehani collateral, loans, and shop parts.</p></div>
      </header>

      {message && <div role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />{message}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Stock cost', totals.stockCost], ['Asking value', totals.asking], ['Sales revenue', totals.revenue], ['Realized profit', totals.profit]].map(([title, value]) =>
          <div key={String(title)} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</p>
            <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{formatKES(Number(value))}</p>
          </div>)}
      </div>

      <form onSubmit={handlePurchase} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3"><h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><PackagePlus className="h-4 w-4 text-teal-500" />Record a purchase</h2></div>
        <label><span className={label}>Item name *</span><input className={field} name="item_name" required maxLength={120} placeholder="e.g. Samsung refrigerator" /></label>
        <label><span className={label}>Category</span><input className={field} name="category" maxLength={60} placeholder="Appliances, furniture…" /></label>
        <label><span className={label}>Condition</span><input className={field} name="item_condition" maxLength={80} placeholder="Good, used…" /></label>
        <label><span className={label}>Purchase price (KES) *</span><input className={field} name="purchase_price" type="number" min="0" step="0.01" required /></label>
        <label><span className={label}>Asking price (KES) *</span><input className={field} name="asking_price" type="number" min="0" step="0.01" required /></label>
        <label><span className={label}>Purchase date</span><input className={field} name="purchase_date" type="date" defaultValue={today} required /></label>
        <label><span className={label}>Bought from</span><input className={field} name="seller_name" maxLength={120} /></label>
        <label><span className={label}>Item details</span><input className={field} name="details" maxLength={240} placeholder="Brand, model, serial number…" /></label>
        <label><span className={label}>Notes</span><input className={field} name="notes" maxLength={240} /></label>
        <div className="sm:col-span-2 lg:col-span-3"><button className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-500">Save purchase</button></div>
      </form>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-bold text-slate-900 dark:text-white">Your items ({visibleGoods.length})</h2>
          <div className="flex gap-2">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label="Search personal goods" className={field + ' pl-9'} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search goods" /></div>
            <select aria-label="Filter goods" className={field + ' w-auto'} value={filter} onChange={(event) => setFilter(event.target.value as StatusFilter)}><option value="ALL">All</option><option value="IN_STOCK">In stock</option><option value="SOLD">Sold</option></select>
          </div>
        </div>
        {visibleGoods.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">No personal goods recorded yet.</div> :
          <div className="grid gap-3 lg:grid-cols-2">{visibleGoods.map((item) =>
            <article key={item.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900 dark:text-white">{item.item_name}</h3><p className="text-xs text-slate-500 dark:text-slate-400">{item.category} · {item.item_condition || 'Condition not noted'} · Bought {item.purchase_date}</p>{item.details && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.details}</p>}</div>
                <span className={'rounded-full px-2.5 py-1 text-xs font-bold ' + (item.status === 'SOLD' ? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300')}>{item.status === 'SOLD' ? 'Sold' : 'In stock'}</span></div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm"><span>Cost: <b>{formatKES(Number(item.purchase_price))}</b></span><span>{item.status === 'SOLD' ? 'Sold for' : 'Asking'}: <b>{formatKES(Number(item.status === 'SOLD' ? item.sale_price : item.asking_price))}</b></span>{item.status === 'SOLD' && <span className={Number(item.sale_price) >= Number(item.purchase_price) ? 'text-emerald-600' : 'text-rose-600'}>Profit/loss: <b>{formatKES(Number(item.sale_price) - Number(item.purchase_price))}</b></span>}</div>
              {item.status === 'IN_STOCK' && (saleId === item.id ? <form onSubmit={(event) => handleSale(event, item.id)} className="grid gap-2 border-t border-slate-100 pt-3 dark:border-white/10 sm:grid-cols-2">
                <label><span className={label}>Sale price (KES) *</span><input className={field} name="sale_price" type="number" min="0" step="0.01" required /></label><label><span className={label}>Sale date</span><input className={field} name="sale_date" type="date" defaultValue={today} required /></label>
                <label><span className={label}>Buyer</span><input className={field} name="buyer_name" /></label><label><span className={label}>Buyer phone</span><input className={field} name="buyer_phone" type="tel" /></label>
                <label><span className={label}>Payment method</span><select className={field} name="payment_method"><option value="">Select</option><option>Cash</option><option>M-Pesa</option><option>Bank</option><option>Other</option></select></label><label><span className={label}>Payment reference</span><input className={field} name="payment_reference" /></label>
                <div className="flex gap-2 sm:col-span-2"><button className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white">Save sale</button><button type="button" onClick={() => setSaleId('')} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">Cancel</button></div>
              </form> : <button onClick={() => setSaleId(item.id)} className="rounded-xl border border-teal-600 px-3 py-2 text-sm font-bold text-teal-700 dark:text-teal-300">Mark as sold</button>)}
            </article>)}</div>}
      </section>
    </section>
  );
};
