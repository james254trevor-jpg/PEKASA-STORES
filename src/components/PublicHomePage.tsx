import React, { useMemo, useState } from 'react';
import {
  ArrowRight, BadgeCheck, Headphones, Laptop, Menu, PackageCheck, Phone,
  Refrigerator, Search, ShieldCheck, ShoppingBag, Sofa, Speaker, Truck,
  Tv, UserRound, WalletCards, X, HeartHandshake, BedDouble
} from 'lucide-react';
import { STORE_TEL, STORE_TEL_ALT } from '../types';

interface PublicHomePageProps {
  onOpenPortal: () => void;
  isLoggedIn?: boolean;
}

const categories = [
  { name: 'Electronics', detail: 'TVs, laptops, phones & audio', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=720&q=85', icon: Laptop },
  { name: 'Home & Living', detail: 'Furniture, beds & décor', image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=720&q=85', icon: Sofa },
  { name: 'Fridges', detail: 'Fridges & freezers', image: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=720&q=85', icon: Refrigerator },
  { name: 'TVs', detail: 'Smart and flat-screen TVs', image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=720&q=85', icon: Tv },
  { name: 'Sound Systems', detail: 'Woofers & home audio', image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=720&q=85', icon: Speaker },
  { name: 'More', detail: 'Gas, mattresses & more', image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=720&q=85', icon: BedDouble }
];

const popularGoods = [
  { name: 'Laptops & Computers', category: 'Electronics', image: categories[0].image, detail: 'Find a device for work, study or home.' },
  { name: 'Sofas & Furniture', category: 'Home & Living', image: categories[1].image, detail: 'Comfortable finds for your home.' },
  { name: 'Refrigerators', category: 'Fridges', image: categories[2].image, detail: 'Browse available fridges and freezers.' },
  { name: 'Smart TVs', category: 'TVs', image: categories[3].image, detail: 'Ask us about current TV stock.' },
  { name: 'Woofers & Audio', category: 'Sound Systems', image: categories[4].image, detail: 'Bring sound home for less.' }
];

const benefits = [
  { title: 'Trusted & Secure', detail: 'Your valuables are handled with care.', icon: ShieldCheck },
  { title: 'Fair Valuations', detail: 'Clear, competitive offers on your items.', icon: BadgeCheck },
  { title: 'Friendly Support', detail: 'Talk to our team when you need help.', icon: Headphones },
  { title: 'Quality Finds', detail: 'Good second-hand goods at fair prices.', icon: PackageCheck }
];

export const PublicHomePage: React.FC<PublicHomePageProps> = ({ onOpenPortal, isLoggedIn }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const visibleCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return categories.filter((item) => !query || (item.name + ' ' + item.detail).toLowerCase().includes(query));
  }, [search]);

  const openEnquiry = (category: string) => {
    const message = encodeURIComponent('Hello PEKASA STORE, I am interested in ' + category + '. Please let me know what is currently available.');
    window.open('https://wa.me/254727108749?text=' + message, '_blank', 'noopener,noreferrer');
  };
  const closeMenu = () => setMenuOpen(false);
  const linkClass = 'transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

  return (
    <div className="min-h-screen bg-white font-sans text-[#0B2744] antialiased">
      <div className="bg-[#071D33] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 text-[11px] font-medium sm:px-6 lg:px-8">
          <span className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-blue-300" />Trusted local store</span>
          <span className="hidden items-center gap-2 sm:flex"><Truck className="h-3.5 w-3.5 text-blue-300" />Ask us about delivery</span>
          <a href={'tel:' + STORE_TEL} className="flex items-center gap-2 hover:text-blue-200"><Headphones className="h-3.5 w-3.5 text-blue-300" />Customer support</a>
          <span className="hidden items-center gap-2 md:flex"><WalletCards className="h-3.5 w-3.5 text-blue-300" />Cash · M-Pesa · Bank</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#home" className="flex shrink-0 items-center gap-2.5" aria-label="Pekasa Store home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B2744] text-white"><ShoppingBag className="h-6 w-6" /></span>
            <span className="leading-none"><b className="block text-xl font-black tracking-tight">PEKASA</b><small className="mt-1 block text-[9px] font-semibold tracking-[0.42em] text-slate-500">STORE</small></span>
          </a>
          <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm font-semibold lg:flex">
            <a href="#home" className={linkClass + ' border-b-2 border-blue-600 py-2 text-blue-700'}>Home</a>
            <a href="#items" className={linkClass}>Shop</a><a href="#about" className={linkClass}>About Us</a><a href="#contact" className={linkClass}>Contact</a>
          </nav>
          <div className="hidden min-w-0 flex-1 items-center justify-end gap-4 sm:flex lg:flex-none">
            <label className="flex w-full max-w-[270px] items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-500 focus-within:border-blue-400">
              <Search className="h-4 w-4 shrink-0" /><input value={search} onChange={(event) => { setSearch(event.target.value); if (event.target.value) document.getElementById('items')?.scrollIntoView({ behavior: 'smooth' }); }} className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400" placeholder="Search categories…" aria-label="Search product categories" />
            </label>
            <button type="button" onClick={onOpenPortal} className="rounded-lg p-2 text-[#0B2744] hover:bg-slate-100" aria-label={isLoggedIn ? 'Open staff portal' : 'Staff sign in'} title={isLoggedIn ? 'Staff portal' : 'Staff sign in'}><UserRound className="h-5 w-5" /></button>
            <a href="#items" aria-label="Browse products" title="Browse products" className="rounded-lg p-2 text-[#0B2744] hover:bg-slate-100"><ShoppingBag className="h-5 w-5" /></a>
          </div>
          <button type="button" onClick={() => setMenuOpen(!menuOpen)} className="rounded-lg p-2 text-[#0B2744] hover:bg-slate-100 sm:hidden" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>{menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
        </div>
        {menuOpen && <nav aria-label="Mobile navigation" className="space-y-1 border-t border-slate-200 bg-white px-4 py-3 sm:hidden">
          <a href="#home" onClick={closeMenu} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-50">Home</a><a href="#items" onClick={closeMenu} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-50">Shop</a><a href="#about" onClick={closeMenu} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-50">About Us</a><a href="#contact" onClick={closeMenu} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-50">Contact</a>
          <button type="button" onClick={() => { closeMenu(); onOpenPortal(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50"><UserRound className="h-4 w-4" />{isLoggedIn ? 'Staff portal' : 'Staff sign in'}</button>
          <label className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"><Search className="h-4 w-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm text-slate-800 outline-none" placeholder="Search categories…" aria-label="Search product categories" /></label>
        </nav>}
      </header>

      <main>
        <section id="home" className="relative isolate overflow-hidden bg-[#F2F7FC]">
          <div className="absolute inset-y-0 right-0 -z-10 w-full lg:w-[64%]">
            <img src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1800&q=90" alt="Customer shopping in-store" className="h-full w-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#F2F7FC] via-[#F2F7FC]/90 to-transparent lg:via-[#F2F7FC]/55" /><div className="absolute inset-0 bg-gradient-to-t from-[#F2F7FC]/65 via-transparent to-transparent lg:hidden" />
          </div>
          <div className="mx-auto grid min-h-[490px] max-w-7xl items-center px-4 py-12 sm:px-6 lg:min-h-[480px] lg:grid-cols-2 lg:px-8">
            <div className="max-w-xl py-4 lg:py-8">
              <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-blue-700">Welcome to Pekasa Store</p>
              <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-[#0B2744] sm:text-5xl">Quality goods.<br />Better living.</h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-700">Discover quality second-hand products at fair prices. Buy with confidence, or bring us your items for a fair cash offer.</p>
              <a href="#items" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">Shop now <ArrowRight className="h-4 w-4" /></a>
              <div className="mt-8 grid max-w-xl grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
                {[{ icon: Truck, title: 'Helpful delivery', subtitle: 'Ask our team' }, { icon: ShieldCheck, title: 'Secure service', subtitle: 'Your items matter' }, { icon: Headphones, title: 'Local support', subtitle: 'Here to help' }, { icon: BadgeCheck, title: 'Fair value', subtitle: 'Quality checked' }].map((item) => { const Icon = item.icon; return <div key={item.title} className="flex items-center gap-2"><Icon className="h-5 w-5 shrink-0 text-[#0B2744]" /><span><b className="block text-[10px] leading-tight">{item.title}</b><small className="text-[9px] text-slate-600">{item.subtitle}</small></span></div>; })}
              </div>
            </div>
          </div>
        </section>

        <section id="items" className="scroll-mt-24 bg-white py-10 sm:py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-5 flex items-end justify-between gap-4"><div><h2 className="text-xl font-black tracking-tight text-[#0B2744] sm:text-2xl">Shop by category</h2><div className="mt-2 h-0.5 w-8 bg-blue-600" /></div><a href="#popular" className="hidden items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 sm:flex">Popular finds <ArrowRight className="h-3.5 w-3.5" /></a></div>
            {visibleCategories.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {visibleCategories.map((category) => { const Icon = category.icon; return <button type="button" key={category.name} onClick={() => openEnquiry(category.name)} className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"><div className="h-32 overflow-hidden sm:h-36"><img src={category.image} alt={category.name} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /></div><div className="px-3 pb-3 pt-2.5"><h3 className="flex items-center gap-1.5 text-xs font-extrabold text-[#0B2744] sm:text-sm"><Icon className="h-3.5 w-3.5 text-blue-600" />{category.name}</h3><p className="mt-1 min-h-8 text-[10px] leading-4 text-slate-500">{category.detail}</p><span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700">Shop now <ArrowRight className="h-3 w-3" /></span></div></button>; })}
            </div> : <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-600">No categories match “{search}”. Try another search.</p>}
          </div>
        </section>

        <section id="about" className="scroll-mt-24 bg-[#F2F7FC] py-10 sm:py-12">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
            <div className="max-w-lg"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-700">About Pekasa Store</p><h2 className="mt-2 text-2xl font-black leading-tight tracking-tight text-[#0B2744] sm:text-3xl">Your trusted second-hand shopping destination</h2><p className="mt-3 text-sm leading-6 text-slate-600">We make it easier to buy and sell useful goods. Our team values items fairly, checks quality, and helps you find practical products at sensible prices.</p><a href="#contact" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700">Talk to our team <ArrowRight className="h-4 w-4" /></a></div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200">{benefits.map((benefit) => { const Icon = benefit.icon; return <div key={benefit.title} className="flex min-h-24 items-center gap-3 bg-[#F7FAFE] p-4 sm:p-5"><Icon className="h-8 w-8 shrink-0 text-blue-600" /><span><b className="block text-xs text-[#0B2744] sm:text-sm">{benefit.title}</b><small className="mt-1 block text-[10px] leading-4 text-slate-600">{benefit.detail}</small></span></div>; })}</div>
          </div>
        </section>

        <section id="popular" className="scroll-mt-24 bg-white py-10 sm:py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-5 flex items-end justify-between gap-4"><div><h2 className="text-xl font-black tracking-tight text-[#0B2744] sm:text-2xl">Popular at Pekasa</h2><div className="mt-2 h-0.5 w-8 bg-blue-600" /></div><a href="#items" className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900">All categories <ArrowRight className="h-3.5 w-3.5" /></a></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{popularGoods.map((good) => <article key={good.category} className="overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg"><button type="button" onClick={() => openEnquiry(good.category)} className="block w-full text-left"><div className="relative h-36 bg-slate-50 sm:h-40"><img src={good.image} alt={good.name} loading="lazy" className="h-full w-full object-cover" /><span className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-blue-700"><HeartHandshake className="h-3.5 w-3.5" /></span></div><div className="p-3"><h3 className="text-xs font-bold text-[#0B2744]">{good.name}</h3><p className="mt-1 min-h-8 text-[10px] leading-4 text-slate-500">{good.detail}</p><span className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-2 py-2 text-[10px] font-bold text-white">Enquire on WhatsApp <ArrowRight className="h-3 w-3" /></span></div></button></article>)}</div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-24 px-4 pb-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-[#073A61] via-[#0B4773] to-[#073A61] px-5 py-5 text-white shadow-lg sm:flex-row sm:px-8">
            <div className="flex items-center gap-4"><ShieldCheck className="h-10 w-10 shrink-0 text-blue-200 sm:h-12 sm:w-12" /><div><h2 className="text-base font-extrabold sm:text-lg">Shop with confidence</h2><p className="mt-1 text-xs text-blue-100">Fair prices, quality second-hand goods, and a helpful local team.</p></div></div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><a href={'https://wa.me/254727108749?text=' + encodeURIComponent('Hello PEKASA STORE, I would like to ask what products are currently available.')} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-extrabold text-[#0B2744] hover:bg-blue-50">Start shopping <ArrowRight className="h-4 w-4" /></a><a href={'tel:' + STORE_TEL} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10"><Phone className="h-4 w-4" />Call us</a></div>
          </div>
        </section>
      </main>

      <footer className="bg-[#071D33] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div><a href="#home" className="inline-flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#071D33]"><ShoppingBag className="h-5 w-5" /></span><span className="leading-none"><b className="block text-lg font-black">PEKASA</b><small className="mt-1 block text-[8px] tracking-[0.4em] text-blue-200">STORE</small></span></a><p className="mt-3 max-w-xs text-xs leading-5 text-slate-300">Quality second-hand goods. Better living. Your local place to buy and sell with confidence.</p></div>
          <div><h3 className="text-xs font-extrabold uppercase tracking-wide text-blue-200">Quick links</h3><ul className="mt-3 space-y-2 text-xs text-slate-200"><li><a href="#home" className="hover:text-white">Home</a></li><li><a href="#items" className="hover:text-white">Shop</a></li><li><a href="#about" className="hover:text-white">About Us</a></li><li><a href="#contact" className="hover:text-white">Contact</a></li></ul></div>
          <div><h3 className="text-xs font-extrabold uppercase tracking-wide text-blue-200">Customer care</h3><ul className="mt-3 space-y-2 text-xs text-slate-200"><li><a href="#contact" className="hover:text-white">How to buy</a></li><li><a href="#contact" className="hover:text-white">Selling your item</a></li><li><a href="https://wa.me/254727108749" target="_blank" rel="noreferrer" className="hover:text-white">WhatsApp support</a></li><li><a href={'tel:' + STORE_TEL} className="hover:text-white">Call support</a></li></ul></div>
          <div><h3 className="text-xs font-extrabold uppercase tracking-wide text-blue-200">We accept</h3><div className="mt-3 flex flex-wrap gap-2"><span className="rounded bg-white px-3 py-2 text-[10px] font-black text-[#0B2744]">CASH</span><span className="rounded bg-white px-3 py-2 text-[10px] font-black text-emerald-700">M-PESA</span><span className="rounded bg-white px-3 py-2 text-[10px] font-black text-blue-700">BANK</span></div><p className="mt-3 text-xs text-slate-300">Call us: <a href={'tel:' + STORE_TEL} className="font-semibold text-white hover:text-blue-200">{STORE_TEL}</a><br /><a href={'tel:' + STORE_TEL_ALT} className="font-semibold text-white hover:text-blue-200">{STORE_TEL_ALT}</a></p></div>
        </div>
        <div className="border-t border-white/10"><div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><span>© {new Date().getFullYear()} PEKASA Store. All rights reserved.</span><span>Quality Products. Better Living.</span></div></div>
      </footer>
    </div>
  );
};
