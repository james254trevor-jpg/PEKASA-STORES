import React, { useState } from 'react';
import {
  Phone,
  MessageCircle,
  Shield,
  Clock,
  Sparkles,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Tv,
  Sofa,
  Refrigerator,
  Speaker,
  Flame,
  BedDouble,
  Laptop,
  Layers,
  Wrench,
  HelpCircle,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
  Lock,
  HeartHandshake,
  Check,
  Send
} from 'lucide-react';
import { STORE_NAME, STORE_TEL, STORE_TEL_ALT, STORE_MOTTO } from '../types';

/** If a storefront photo fails to load, hide it so the dark tile and label remain instead of a broken-image icon. */
const hideBrokenImage = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.visibility = 'hidden';
};

interface PublicHomePageProps {
  onOpenPortal: () => void;
  isLoggedIn?: boolean;
}

export const PublicHomePage: React.FC<PublicHomePageProps> = ({ onOpenPortal, isLoggedIn }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [enquiryModalCategory, setEnquiryModalCategory] = useState<string | null>(null);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    phone: '',
    purpose: 'Rehani Cash Collateral',
    category: 'Furniture',
    message: ''
  });
  const [contactSubmitted, setContactSubmitted] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitted(true);
    // Format WhatsApp message as well
    const text = encodeURIComponent(
      `Hello PEKASA STORE,\nMy Name: ${contactForm.name}\nPhone: ${contactForm.phone}\nService: ${contactForm.purpose}\nItem Category: ${contactForm.category}\nDetails: ${contactForm.message || 'I would like to enquire about this service.'}`
    );
    window.open(`https://wa.me/254727108749?text=${text}`, '_blank');
  };

  const categories = [
    {
      id: 'furniture',
      name: 'Furniture',
      tagline: 'Living room sets, dining tables, beds, wardrobes, recliners & cabinets',
      img: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80',
      icon: Sofa,
      desc: 'Quality second-hand sofas, dining sets, hardwood beds, and home cabinets. We buy and offer cash against clean furniture in good condition.'
    },
    {
      id: 'fridges',
      name: 'Fridges & Freezers',
      tagline: 'Single door, double door, deep freezers & beverage coolers',
      img: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=800&q=80',
      icon: Refrigerator,
      desc: 'Tested and fully functional refrigerators, frost-free double door fridges, and commercial deep freezers. Cash against fridges in 15 minutes.'
    },
    {
      id: 'tvs',
      name: 'Flat-Screen TVs',
      tagline: 'Smart LED, 4K UHD, OLED TVs from 32" to 75"+',
      img: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=80',
      icon: Tv,
      desc: 'Samsung, LG, Sony, TCL, Hisense, Vitron and other smart TV brands. Safe storage in padded secure racks with fair valuation.'
    },
    {
      id: 'woofers',
      name: 'Woofers & Sound Systems',
      tagline: 'Subwoofers, home theaters, Bluetooth soundbars & amplifiers',
      img: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80',
      icon: Speaker,
      desc: 'Deep bass woofers, Sony / Sayona / Tagwood / Vitron sound systems. Quick testing and immediate cash disbursal.'
    },
    {
      id: 'gas-cylinders',
      name: 'Gas Cylinders',
      tagline: '6kg, 13kg & 50kg gas cylinders with burners & regulators',
      img: 'https://images.unsplash.com/photo-1588854337236-6889d631faa8?auto=format&fit=crop&w=800&q=80',
      icon: Flame,
      desc: 'Total, K-Gas, Afrigas, Rubis, Pro-Gas, Shell gas cylinders. Instant inspection and cash on the spot.'
    },
    {
      id: 'mattresses',
      name: 'Mattresses',
      tagline: 'High-density foam, orthopedic & spring mattresses in all sizes',
      img: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80',
      icon: BedDouble,
      desc: 'Clean, gently used mattresses from Dr. Mattress, Silentnight, Bobmil, Superfoam. Top prices paid for high-density models.'
    },
    {
      id: 'laptops',
      name: 'Laptops & Computers',
      tagline: 'HP, Dell, Lenovo, MacBooks, business laptops & monitors',
      img: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80',
      icon: Laptop,
      desc: 'Working laptops with chargers, Core i3/i5/i7/M-series MacBooks. Secure anti-static storage with immediate evaluation.'
    },
    {
      id: 'blenders',
      name: 'Blenders & Kitchen Electronics',
      tagline: 'Commercial blenders, smoothie makers, food processors',
      img: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=800&q=80',
      icon: Layers,
      desc: 'Nutribullet, Ramtons, Philips, Von blenders and juicers. Clean appliances bought and sold daily.'
    },
    {
      id: 'washing-machines',
      name: 'Washing Machines',
      tagline: 'Automatic front-load, top-load & twin tub washers',
      img: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=800&q=80',
      icon: Wrench,
      desc: 'LG, Samsung, Whirlpool, Bosch automatic washing machines. High cash advances against working laundry appliances.'
    },
    {
      id: 'microwaves',
      name: 'Microwaves & Appliances',
      tagline: 'Microwave ovens, electric air fryers, ovens & heaters',
      img: 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&w=800&q=80',
      icon: Flame,
      desc: 'Clean kitchen microwaves, toaster ovens, air fryers, water dispensers and domestic heating units.'
    },
    {
      id: 'cabinets',
      name: 'Cabinets & Storage',
      tagline: 'Shoe racks, display cabinets, book shelves & chests',
      img: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80',
      icon: Layers,
      desc: 'Wooden and metallic storage cabinets, TV stands, corner display units and office filing cabinets.'
    },
    {
      id: 'other-valuables',
      name: 'Other Valuable Items',
      tagline: 'Generators, power tools, lawnmowers, musical keyboards',
      img: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=80',
      icon: Sparkles,
      desc: 'Yamaha keyboards, studio gear, generators, drills and high-value tools. Bring your valuable item for fair assessment.'
    }
  ];

  return (
    <div className="theme-static min-h-screen bg-[#F8FAFC] text-[#0B2D4A] font-sans antialiased selection:bg-[#FFD700] selection:text-[#0B2D4A]">
      {/* 1. TOP INFORMATION BAR */}
      <div className="bg-[#0B2D4A] text-white border-b border-[#0B2D4A]/50 text-xs py-2 px-4 select-none">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
            <span className="text-white font-semibold">Safe</span>
            <span className="text-[#FFD700]">•</span>
            <span className="text-white font-semibold">Secure</span>
            <span className="text-[#FFD700]">•</span>
            <span className="text-white font-semibold">Reliable</span>
          </div>

          <div className="hidden md:flex items-center gap-2 tracking-wide font-bold text-[#FFD700]">
            <Sparkles className="w-3.5 h-3.5 text-[#FFD700]" />
            <span>Your Valuables • Our Trust</span>
          </div>

          <div className="flex items-center gap-4 text-slate-300">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#FFD700]" />
              <span>Open 6 Days a Week: <strong className="text-white">8:00 AM – 7:00 PM</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. STICKY MAIN NAVIGATION */}
      <header className="sticky top-0 z-40 bg-[#0B2D4A]/95 backdrop-blur-md border-b border-white/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <a href="#home" className="flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFD700] to-[#E6C200] p-0.5 shadow-md shadow-[#FFD700]/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0B2D4A] rounded-[10px] flex items-center justify-center text-[#FFD700]">
                <Shield className="w-6 h-6 stroke-[2.3]" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black tracking-wider text-white">PEKASA</span>
                <span className="text-2xl font-black tracking-wider text-[#FFD700]">STORE</span>
              </div>
              <p className="text-[10px] text-slate-300 font-semibold tracking-wider uppercase">
                Rehani & Second Hand Goods
              </p>
            </div>
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-200">
            <a href="#home" className="hover:text-[#FFD700] transition-colors">Home</a>
            <a href="#about" className="hover:text-[#FFD700] transition-colors">About Us</a>
            <a href="#services" className="hover:text-[#FFD700] transition-colors">Services</a>
            <a href="#items" className="hover:text-[#FFD700] transition-colors">Items We Buy & Sell</a>
            <a href="#how-it-works" className="hover:text-[#FFD700] transition-colors">How It Works</a>
            <a href="#contact" className="hover:text-[#FFD700] transition-colors">Contact Us</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Staff / Partner Portal Trigger */}
            <button
              onClick={onOpenPortal}
              className="px-3.5 py-2 rounded-lg text-xs font-bold text-white/90 bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Access staff Rehani management system, collateral vault and cash accounts"
            >
              <Lock className="w-3.5 h-3.5 text-[#FFD700]" />
              <span>{isLoggedIn ? 'Rehani Dashboard' : 'Staff Login'}</span>
            </button>

            {/* Prominent Gold Contact Button */}
            <a
              href="tel:0727108749"
              className="px-4 py-2.5 rounded-xl bg-[#FFD700] hover:bg-[#FFE033] text-[#0B2D4A] font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-[#FFD700]/25 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Phone className="w-4 h-4 fill-current" />
              <div className="leading-tight text-left">
                <span className="block text-[10px] uppercase font-bold text-[#0B2D4A]/80">Call / WhatsApp</span>
                <span className="font-black">0727108749 / 0180366344</span>
              </div>
            </a>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={onOpenPortal}
              className="p-2 text-xs font-bold text-white bg-white/10 rounded-lg border border-white/20"
            >
              <Lock className="w-4 h-4 text-[#FFD700]" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-white hover:text-[#FFD700] rounded-lg transition-colors cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0B2D4A] border-b border-white/10 px-4 pt-3 pb-6 space-y-3">
            <div className="flex flex-col space-y-3 text-sm font-semibold text-slate-200">
              <a href="#home" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-[#FFD700]">Home</a>
              <a href="#about" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-[#FFD700]">About Us</a>
              <a href="#services" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-[#FFD700]">Services</a>
              <a href="#items" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-[#FFD700]">Items We Buy & Sell</a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-[#FFD700]">How It Works</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="py-2 hover:text-[#FFD700]">Contact Us</a>
            </div>

            <div className="pt-3 border-t border-white/10 space-y-2">
              <button
                onClick={() => { setMobileMenuOpen(false); onOpenPortal(); }}
                className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4 text-[#FFD700]" />
                <span>{isLoggedIn ? 'Open Rehani Management System' : 'Staff / Partner Portal Login'}</span>
              </button>

              <a
                href="tel:0727108749"
                className="w-full py-3 px-4 bg-[#FFD700] text-[#0B2D4A] rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md"
              >
                <Phone className="w-4 h-4 fill-current" />
                <span>Call Now: 0727108749 / 0180366344</span>
              </a>
            </div>
          </div>
        )}
      </header>

      {/* 3. HERO SECTION */}
      <section id="home" className="relative bg-gradient-to-b from-[#0B2D4A] via-[#0B2D4A] to-[#113B5F] text-white pt-12 pb-24 overflow-hidden">
        {/* Subtle patterned background */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#FFD700_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Hero Text */}
            <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-[#FFD700]/40 text-[#FFD700] text-xs font-bold tracking-wider uppercase shadow-inner">
                <Sparkles className="w-3.5 h-3.5 text-[#FFD700]" />
                <span>Kenya's Trusted Rehani & Second Hand Centre</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-none text-white">
                PEKASA STORE
              </h1>

              {/* Gold Highlighted / Brush Motto */}
              <div className="inline-block relative">
                <div className="bg-[#FFD700] text-[#0B2D4A] font-extrabold text-lg sm:text-2xl px-4 py-2 rounded-lg shadow-xl shadow-[#FFD700]/20 rotate-[-1deg] transform transition-transform hover:rotate-0">
                  “We Buy and Sell Used Second Hand Goods”
                </div>
              </div>

              {/* Supporting message */}
              <div className="text-base sm:text-lg font-semibold text-slate-200">
                <span className="text-[#FFD700] font-black">Cash Against:</span> Furniture, Fridges, TVs, Woofers, Gas Cylinders, Mattresses, etc.
              </div>

              {/* Short description */}
              <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Turn your unused valuables into cash or find quality second-hand goods at affordable prices. We provide a simple, secure and convenient Rehani experience with prompt valuation.
              </p>

              {/* CTA Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <a
                  href="#contact"
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#FFD700] hover:bg-[#FFE033] text-[#0B2D4A] font-black text-sm sm:text-base tracking-wide flex items-center justify-center gap-3 shadow-xl shadow-[#FFD700]/30 hover:shadow-[#FFD700]/50 transition-all hover:scale-105 cursor-pointer uppercase"
                >
                  <DollarSign className="w-5 h-5 stroke-[2.5]" />
                  <span>GET CASH TODAY</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <a
                  href="#items"
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white border-2 border-white/30 font-bold text-sm sm:text-base flex items-center justify-center gap-2 backdrop-blur-sm transition-all hover:scale-105 cursor-pointer uppercase"
                >
                  <span>VIEW ITEMS</span>
                  <ChevronRight className="w-4 h-4 text-[#FFD700]" />
                </a>
              </div>

              {/* Direct Call Highlights */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> Instant Cash Payout
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> Fair Competitive Valuations
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> 100% Safe Custody
                </span>
              </div>
            </div>

            {/* Right Column: Commercial Product Collage */}
            <div className="lg:col-span-6 relative">
              <div className="relative mx-auto max-w-lg lg:max-w-none">
                {/* Gold Highlight Badge */}
                <div className="absolute -top-4 -right-2 sm:-right-4 z-20 bg-[#FFD700] text-[#0B2D4A] font-black text-[11px] sm:text-xs py-2 px-4 rounded-full shadow-2xl shadow-black/40 border-2 border-[#0B2D4A] uppercase tracking-wider animate-bounce">
                  ★ TURN YOUR UNWANTED ITEMS INTO CASH!
                </div>

                {/* Collage Grid */}
                <div className="grid grid-cols-3 gap-3 p-3 bg-white/5 border border-white/15 rounded-3xl backdrop-blur-md shadow-2xl">
                  {/* Item 1: Sofa */}
                  <div className="relative group overflow-hidden rounded-2xl bg-[#1F2937] aspect-square shadow-md border border-white/10">
                    <img
                      loading="lazy"
                      onError={hideBrokenImage}
                      src="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80"
                      alt="Second hand sofa"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                      <span className="text-[11px] font-bold text-white leading-tight">Sofas & Furniture</span>
                    </div>
                  </div>

                  {/* Item 2: Smart TV */}
                  <div className="relative group overflow-hidden rounded-2xl bg-[#1F2937] aspect-square shadow-md border border-white/10">
                    <img
                      loading="lazy"
                      onError={hideBrokenImage}
                      src="https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=600&q=80"
                      alt="Flat screen Smart TV"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                      <span className="text-[11px] font-bold text-white leading-tight">Smart TVs</span>
                    </div>
                  </div>

                  {/* Item 3: Refrigerator */}
                  <div className="relative group overflow-hidden rounded-2xl bg-[#1F2937] aspect-square shadow-md border border-white/10">
                    <img
                      loading="lazy"
                      onError={hideBrokenImage}
                      src="https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=600&q=80"
                      alt="Refrigerator"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                      <span className="text-[11px] font-bold text-white leading-tight">Fridges</span>
                    </div>
                  </div>

                  {/* Item 4: Sound System / Woofer */}
                  <div className="relative group overflow-hidden rounded-2xl bg-[#1F2937] aspect-square shadow-md border border-white/10">
                    <img
                      loading="lazy"
                      onError={hideBrokenImage}
                      src="https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80"
                      alt="Woofer sound system"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                      <span className="text-[11px] font-bold text-white leading-tight">Woofers</span>
                    </div>
                  </div>

                  {/* Center Featured: Cash & Valuation Shield */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#E6C200] p-3 text-[#0B2D4A] flex flex-col items-center justify-center text-center shadow-lg border-2 border-white">
                    <DollarSign className="w-8 h-8 stroke-[3]" />
                    <span className="text-xs font-black uppercase mt-1 leading-tight">Fast Cash Disbursed</span>
                    <span className="text-[9px] font-bold opacity-80 mt-0.5">M-Pesa / Cash</span>
                  </div>

                  {/* Item 6: Gas Cylinder */}
                  <div className="relative group overflow-hidden rounded-2xl bg-[#1F2937] aspect-square shadow-md border border-white/10">
                    <img
                      loading="lazy"
                      onError={hideBrokenImage}
                      src="https://images.unsplash.com/photo-1588854337236-6889d631faa8?auto=format&fit=crop&w=600&q=80"
                      alt="Gas Cylinder"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                      <span className="text-[11px] font-bold text-white leading-tight">Gas Cylinders</span>
                    </div>
                  </div>

                  {/* Item 7: Mattress */}
                  <div className="relative group overflow-hidden rounded-2xl bg-[#1F2937] aspect-square shadow-md border border-white/10">
                    <img
                      loading="lazy"
                      onError={hideBrokenImage}
                      src="https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=600&q=80"
                      alt="Mattress"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                      <span className="text-[11px] font-bold text-white leading-tight">Mattresses</span>
                    </div>
                  </div>

                  {/* Item 8: Washing Machine */}
                  <div className="relative group overflow-hidden rounded-2xl bg-[#1F2937] aspect-square shadow-md border border-white/10">
                    <img
                      loading="lazy"
                      onError={hideBrokenImage}
                      src="https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=600&q=80"
                      alt="Washing Machine"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                      <span className="text-[11px] font-bold text-white leading-tight">Washers</span>
                    </div>
                  </div>

                  {/* Item 9: Cabinet / Dining */}
                  <div className="relative group overflow-hidden rounded-2xl bg-[#1F2937] aspect-square shadow-md border border-white/10">
                    <img
                      loading="lazy"
                      onError={hideBrokenImage}
                      src="https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=600&q=80"
                      alt="Cabinets and Dining"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                      <span className="text-[11px] font-bold text-white leading-tight">Cabinets</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. TRUST FEATURES BLOCKS */}
      <section className="relative z-20 -mt-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Feature 1 */}
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200/80 hover:border-[#FFD700] hover:shadow-2xl transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#0B2D4A] text-[#FFD700] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-md">
              <DollarSign className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h3 className="text-base font-black text-[#0B2D4A] uppercase tracking-wide">QUICK CASH</h3>
            <p className="text-sm font-semibold text-slate-500 mt-1">“When You Need It”</p>
            <p className="text-xs text-slate-400 mt-2">Get paid immediately via M-Pesa or cash after quick assessment.</p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200/80 hover:border-[#FFD700] hover:shadow-2xl transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#0B2D4A] text-[#FFD700] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-md">
              <Shield className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h3 className="text-base font-black text-[#0B2D4A] uppercase tracking-wide">SAFE & SECURE</h3>
            <p className="text-sm font-semibold text-slate-500 mt-1">“Your Items Are Handled With Care”</p>
            <p className="text-xs text-slate-400 mt-2">Padded racks, tagged security codes, locked vault custody.</p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200/80 hover:border-[#FFD700] hover:shadow-2xl transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#0B2D4A] text-[#FFD700] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-md">
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h3 className="text-base font-black text-[#0B2D4A] uppercase tracking-wide">FAIR PRICES</h3>
            <p className="text-sm font-semibold text-slate-500 mt-1">“Competitive Valuation”</p>
            <p className="text-xs text-slate-400 mt-2">Honest appraisal based on condition, market demand and model.</p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200/80 hover:border-[#FFD700] hover:shadow-2xl transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#0B2D4A] text-[#FFD700] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-md">
              <Clock className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h3 className="text-base font-black text-[#0B2D4A] uppercase tracking-wide">FAST & EASY</h3>
            <p className="text-sm font-semibold text-slate-500 mt-1">“Simple Process With No Delays”</p>
            <p className="text-xs text-slate-400 mt-2">Zero unnecessary paperwork or red tape. Straightforward deals.</p>
          </div>
        </div>
      </section>

      {/* 5. ABOUT / BUSINESS INTRODUCTION */}
      <section id="about" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl p-8 sm:p-12 lg:p-16 border border-slate-200 shadow-xl">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase text-[#0B2D4A] bg-[#FFD700]/20 px-3.5 py-1.5 rounded-full border border-[#FFD700]">
              <HeartHandshake className="w-4 h-4 text-[#0B2D4A]" />
              <span>About PEKASA STORE</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0B2D4A] tracking-tight">
              Your Trusted Rehani Partner
            </h2>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-medium">
              “PEKASA STORE buys and sells quality used second-hand goods and provides cash against valuable items. Whether you want to sell an unwanted item, purchase an affordable second-hand product, or use an item as collateral for cash, our goal is to make the process simple, transparent and convenient.”
            </p>
          </div>

          {/* 3 Stat/Value Cards */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 border-2 border-slate-100 shadow-md text-center hover:border-[#FFD700] transition-colors">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0B2D4A] text-[#FFD700] flex items-center justify-center mb-4 shadow-md">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-[#0B2D4A]">Quality Used Goods</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Every appliance, television, sound system, and piece of furniture is physically inspected for condition, safety and performance before being placed on sale.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border-2 border-slate-100 shadow-md text-center hover:border-[#FFD700] transition-colors">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FFD700] text-[#0B2D4A] flex items-center justify-center mb-4 shadow-md">
                <DollarSign className="w-7 h-7 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-black text-[#0B2D4A]">Fair & Transparent Deals</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Clear loan terms, explicit valuation agreements, and statutory compliant receipting. No hidden surprises or arbitrary charges.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border-2 border-slate-100 shadow-md text-center hover:border-[#FFD700] transition-colors">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0B2D4A] text-[#FFD700] flex items-center justify-center mb-4 shadow-md">
                <Shield className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-[#0B2D4A]">Trusted Customer Service</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Friendly and respectful staff ready to assist you whether in person at our store, over the telephone, or through WhatsApp.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. WHAT WE BUY & SELL (12 CATEGORIES) */}
      <section id="items" className="py-20 bg-slate-100/70 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-black uppercase tracking-wider text-[#0B2D4A] bg-[#FFD700] px-3 py-1 rounded-md">
              Inventory & Rehani Collateral
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0B2D4A] tracking-tight">
              What We Buy & Sell
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Browse the wide range of quality items we trade daily. Whether you want to turn an item into quick cash or purchase second-hand items at honest prices, we have you covered.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {categories.map((cat, index) => {
              const IconComp = cat.icon;
              return (
                <div
                  key={cat.id}
                  className="bg-white rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-[#FFD700] transition-all duration-300 flex flex-col group"
                >
                  {/* Image with Tag */}
                  <div className="relative h-48 overflow-hidden bg-slate-900">
                    <img
                      loading="lazy"
                      onError={hideBrokenImage}
                      src={cat.img}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 bg-[#0B2D4A]/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm flex items-center gap-1.5 border border-white/20">
                      <IconComp className="w-3.5 h-3.5 text-[#FFD700]" />
                      <span>{cat.name}</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-[#0B2D4A] group-hover:text-[#0B2D4A] transition-colors">
                        {cat.name}
                      </h3>
                      <p className="text-xs font-semibold text-[#FFD700] bg-[#0B2D4A] px-2 py-0.5 rounded inline-block">
                        {cat.tagline}
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed pt-1">
                        {cat.desc}
                      </p>
                    </div>

                    {/* Enquire Button */}
                    <a
                      href={`https://wa.me/254727108749?text=${encodeURIComponent(`Hello PEKASA STORE, I would like to enquire about ${cat.name} (selling / buying / cash collateral).`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-[#FFD700] text-[#0B2D4A] font-bold text-xs flex items-center justify-center gap-2 border border-slate-200 group-hover:border-[#FFD700] transition-all cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4 text-[#10B981] group-hover:text-[#0B2D4A]" />
                      <span>Enquire Now</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. HOW REHANI WORKS (4-STEP PROCESS) */}
      <section id="how-it-works" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-xs font-black uppercase tracking-wider text-[#0B2D4A] bg-[#FFD700] px-3.5 py-1.5 rounded-full">
            Transparent Collateral Process
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0B2D4A] tracking-tight">
            How Rehani Works
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            A simple 4-step path to get money against your items with complete peace of mind.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Step 1 */}
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-200 shadow-md hover:border-[#FFD700] transition-all relative">
            <div className="absolute -top-4 left-6 bg-[#0B2D4A] text-[#FFD700] text-xs font-black px-3 py-1 rounded-full border-2 border-white shadow">
              STEP 1
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-[#0B2D4A] flex items-center justify-center mb-4 mt-2">
              <Sofa className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-[#0B2D4A] uppercase">BRING YOUR ITEM</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Bring your furniture, electronics, appliance, or other valuable item to our store counter.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-200 shadow-md hover:border-[#FFD700] transition-all relative">
            <div className="absolute -top-4 left-6 bg-[#0B2D4A] text-[#FFD700] text-xs font-black px-3 py-1 rounded-full border-2 border-white shadow">
              STEP 2
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-[#0B2D4A] flex items-center justify-center mb-4 mt-2">
              <CheckCircle2 className="w-6 h-6 text-[#10B981]" />
            </div>
            <h3 className="text-base font-black text-[#0B2D4A] uppercase">ITEM ASSESSMENT</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Our staff assess the item's condition, market value, working functionality and resale potential.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-200 shadow-md hover:border-[#FFD700] transition-all relative">
            <div className="absolute -top-4 left-6 bg-[#FFD700] text-[#0B2D4A] text-xs font-black px-3 py-1 rounded-full border-2 border-white shadow">
              STEP 3
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#FFD700]/20 text-[#0B2D4A] flex items-center justify-center mb-4 mt-2">
              <DollarSign className="w-6 h-6 stroke-[3]" />
            </div>
            <h3 className="text-base font-black text-[#0B2D4A] uppercase">RECEIVE CASH</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              If the transaction is approved, receive the agreed cash amount against the item instantly via M-Pesa or cash.
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-200 shadow-md hover:border-[#FFD700] transition-all relative">
            <div className="absolute -top-4 left-6 bg-[#0B2D4A] text-[#FFD700] text-xs font-black px-3 py-1 rounded-full border-2 border-white shadow">
              STEP 4
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-[#0B2D4A] flex items-center justify-center mb-4 mt-2">
              <Shield className="w-6 h-6 text-[#10B981]" />
            </div>
            <h3 className="text-base font-black text-[#0B2D4A] uppercase">REDEEM OR SELL</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Redeem your item according to the agreed terms, or complete the outright sale through PEKASA STORE.
            </p>
          </div>
        </div>

        {/* Clear Note Callout */}
        <div className="mt-8 bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 text-center text-xs sm:text-sm font-semibold text-amber-900 max-w-2xl mx-auto shadow-sm">
          ⚠️ <span className="font-bold">Important Note:</span> “Terms, valuation and applicable charges are agreed before the transaction.”
        </div>
      </section>

      {/* 8. WHY CHOOSE PEKASA STORE (DARK NAVY WITH GOLD ICONS) */}
      <section id="services" className="py-20 bg-[#0B2D4A] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-black uppercase tracking-wider text-[#0B2D4A] bg-[#FFD700] px-3.5 py-1.5 rounded-full">
              Trust & Integrity
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              Why Choose PEKASA STORE
            </h2>
            <p className="text-sm sm:text-base text-slate-300">
              We stand apart through our commitment to security, speed, and genuine customer care.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Competitive prices', desc: 'Fair, realistic valuations that reflect true market value.' },
              { title: 'Convenient service', desc: 'Rapid counter testing with minimal waiting time.' },
              { title: 'Secure handling of items', desc: 'Monitored vault rooms with individual security tags.' },
              { title: 'Clear transaction records', desc: 'Formal pawn tickets and receipts for every transaction.' },
              { title: 'Wide range of goods', desc: 'We accept appliances, electronics, furniture and cylinders.' },
              { title: 'Friendly customer service', desc: 'Polite, approachable and attentive staff to guide you.' },
              { title: 'Easy enquiry through phone/WhatsApp', desc: 'Quick replies at 0727108749 or 0180366344.' },
              { title: 'Convenient buying & selling', desc: 'A seamless, trustworthy experience from start to finish.' }
            ].map((feat, idx) => (
              <div
                key={idx}
                className="bg-white/5 border border-white/10 hover:border-[#FFD700] rounded-2xl p-6 transition-all duration-300 hover:bg-white/10 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#FFD700] text-[#0B2D4A] flex items-center justify-center font-black mb-4 group-hover:scale-110 transition-transform">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  {feat.title}
                </h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. CALL TO ACTION BANNER */}
      <section className="py-16 bg-gradient-to-r from-[#FFD700] via-[#FFE033] to-[#FFD700] text-[#0B2D4A] relative overflow-hidden shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#0B2D4A]">
            Have Something Valuable You Don't Need?
          </h2>
          <p className="text-xl sm:text-2xl font-black text-[#0B2D4A]/90">
            Turn it into cash with PEKASA STORE.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <a
              href="tel:0727108749"
              className="px-8 py-4 rounded-2xl bg-[#0B2D4A] text-white hover:bg-[#113B5F] font-black text-base sm:text-lg flex items-center gap-3 shadow-xl hover:scale-105 transition-all cursor-pointer"
            >
              <Phone className="w-5 h-5 fill-current text-[#FFD700]" />
              <span>CALL 0727108749</span>
            </a>

            <a
              href="https://wa.me/254727108749?text=Hello%20PEKASA%20STORE,%20I%20have%20an%20item%20I%20would%20like%20to%20turn%20into%20cash."
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 rounded-2xl bg-[#10B981] text-white hover:bg-[#0ea5e9] font-black text-base sm:text-lg flex items-center gap-3 shadow-xl hover:scale-105 transition-all cursor-pointer"
            >
              <MessageCircle className="w-5 h-5 fill-current" />
              <span>WHATSAPP US</span>
            </a>
          </div>

          <p className="text-xs sm:text-sm font-extrabold text-[#0B2D4A]/80 tracking-wider">
            Alternative Line: <span className="underline decoration-[#0B2D4A]">0180366344</span>
          </p>
        </div>
      </section>

      {/* 10. CONTACT SECTION */}
      <section id="contact" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-xs font-black uppercase tracking-wider text-[#0B2D4A] bg-[#FFD700] px-3.5 py-1.5 rounded-full">
            Direct Assistance
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0B2D4A] tracking-tight">
            Contact PEKASA STORE
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Reach out to our customer desk for quick evaluations, store directions, or stock inquiries.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Contact Details Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-lg space-y-6">
              {/* Phone */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#0B2D4A] text-[#FFD700] flex items-center justify-center shrink-0">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">PRIMARY PHONE</h4>
                  <a href="tel:0727108749" className="text-lg font-black text-[#0B2D4A] hover:text-[#10B981] transition-colors">
                    0727108749
                  </a>
                  <p className="text-xs text-slate-500">Available for calls and WhatsApp messages.</p>
                </div>
              </div>

              {/* Alt Phone */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#0B2D4A] text-[#FFD700] flex items-center justify-center shrink-0">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">ALTERNATIVE PHONE</h4>
                  <a href="tel:0180366344" className="text-lg font-black text-[#0B2D4A] hover:text-[#10B981] transition-colors">
                    0180366344
                  </a>
                  <p className="text-xs text-slate-500">Secondary contact line.</p>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#0B2D4A] text-[#FFD700] flex items-center justify-center shrink-0">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">LOCATION</h4>
                  <div className="text-base font-bold text-[#0B2D4A]">Kenya</div>
                  <p className="text-xs text-slate-500">Call our lines for current counter branch location and directions.</p>
                </div>
              </div>

              {/* Business Hours */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#0B2D4A] text-[#FFD700] flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">BUSINESS HOURS</h4>
                  <div className="text-base font-bold text-[#0B2D4A]">Open 7 Days a Week</div>
                  <div className="text-xs font-semibold text-[#10B981]">8:00 AM – 7:00 PM</div>
                </div>
              </div>

              {/* Direct Buttons */}
              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                <a
                  href="tel:0727108749"
                  className="py-3 px-4 rounded-xl bg-[#0B2D4A] hover:bg-[#113B5F] text-white text-xs font-bold flex items-center justify-center gap-2 shadow"
                >
                  <Phone className="w-4 h-4 text-[#FFD700]" />
                  <span>Call 0727108749</span>
                </a>
                <a
                  href="https://wa.me/254727108749"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold flex items-center justify-center gap-2 shadow"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          </div>

          {/* Contact Enquiry Form Column */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-xl">
              <h3 className="text-2xl font-black text-[#0B2D4A] mb-2">Send an Enquiry</h3>
              <p className="text-xs text-slate-500 mb-6">
                Tell us what you want to sell, use as collateral, or buy. We reply promptly.
              </p>

              {contactSubmitted ? (
                <div className="p-6 bg-emerald-50 border border-emerald-300 rounded-2xl text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-emerald-900">Enquiry Form Dispatched</h4>
                  <p className="text-xs text-emerald-700">
                    Thank you! Your enquiry has been submitted and forwarded via WhatsApp for immediate response.
                  </p>
                  <button
                    onClick={() => setContactSubmitted(false)}
                    className="text-xs font-bold text-emerald-800 underline pt-2 cursor-pointer"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        placeholder="e.g. John Mwangi"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/30 outline-none text-xs bg-slate-50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                        placeholder="e.g. 0712345678"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/30 outline-none text-xs bg-slate-50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">What are you looking for?</label>
                      <select
                        value={contactForm.purpose}
                        onChange={(e) => setContactForm({ ...contactForm, purpose: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/30 outline-none text-xs bg-slate-50"
                      >
                        <option value="Rehani Cash Collateral">Rehani Cash Against Item (Collateral)</option>
                        <option value="Sell Used Goods">Sell My Used Item Outright</option>
                        <option value="Buy Second Hand Goods">Buy Quality Second Hand Goods</option>
                        <option value="General Enquiry">General Information</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Item Category</label>
                      <select
                        value={contactForm.category}
                        onChange={(e) => setContactForm({ ...contactForm, category: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/30 outline-none text-xs bg-slate-50"
                      >
                        <option value="Furniture">Furniture (Sofa, Bed, Table)</option>
                        <option value="Fridges">Fridges & Freezers</option>
                        <option value="TVs">Flat Screen TVs</option>
                        <option value="Woofers">Woofers & Sound Systems</option>
                        <option value="Gas Cylinders">Gas Cylinders</option>
                        <option value="Mattresses">Mattresses</option>
                        <option value="Laptops">Laptops & Computers</option>
                        <option value="Washing Machines">Washing Machines</option>
                        <option value="Microwaves & Appliances">Microwaves & Appliances</option>
                        <option value="Other">Other Valuable Items</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Message / Item Description</label>
                    <textarea
                      rows={4}
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      placeholder="Describe the item: brand, model, condition, age, or any questions you have..."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/30 outline-none text-xs bg-slate-50"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 px-6 rounded-xl bg-[#0B2D4A] hover:bg-[#113B5F] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-[#FFD700]" />
                    <span>Submit Enquiry via WhatsApp</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 11. FOOTER */}
      <footer className="bg-[#0B2D4A] text-white pt-16 pb-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/10">
            {/* Col 1: Brand & Logo */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFD700] text-[#0B2D4A] flex items-center justify-center font-black">
                  <Shield className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-xl font-black text-white">PEKASA</span>
                  <span className="text-xl font-black text-[#FFD700] ml-1">STORE</span>
                </div>
              </div>

              <div className="text-sm font-bold text-[#FFD700]">
                “We Buy and Sell Used Second Hand Goods”
              </div>

              <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
                Your trusted destination for quality second-hand goods and convenient Rehani services. Fast cash valuations and secure storage in Kenya.
              </p>

              <div className="pt-2">
                <button
                  onClick={onOpenPortal}
                  className="inline-flex items-center gap-2 text-xs font-bold text-[#FFD700] bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-lg border border-white/15 cursor-pointer transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Staff / Partner System Portal</span>
                </button>
              </div>
            </div>

            {/* Col 2: Quick Links */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#FFD700]">QUICK LINKS</h4>
              <ul className="space-y-2 text-xs text-slate-300 font-medium">
                <li><a href="#home" className="hover:text-[#FFD700] transition-colors">Home</a></li>
                <li><a href="#about" className="hover:text-[#FFD700] transition-colors">About Us</a></li>
                <li><a href="#services" className="hover:text-[#FFD700] transition-colors">Services</a></li>
                <li><a href="#items" className="hover:text-[#FFD700] transition-colors">Items We Buy & Sell</a></li>
                <li><a href="#how-it-works" className="hover:text-[#FFD700] transition-colors">How It Works</a></li>
                <li><a href="#contact" className="hover:text-[#FFD700] transition-colors">Contact Us</a></li>
              </ul>
            </div>

            {/* Col 3: We Buy & Sell */}
            <div className="lg:col-span-3 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#FFD700]">WE BUY & SELL</h4>
              <ul className="grid grid-cols-2 gap-2 text-xs text-slate-300 font-medium">
                <li><a href="#items" className="hover:text-[#FFD700]">Furniture</a></li>
                <li><a href="#items" className="hover:text-[#FFD700]">Fridges</a></li>
                <li><a href="#items" className="hover:text-[#FFD700]">TVs</a></li>
                <li><a href="#items" className="hover:text-[#FFD700]">Woofers</a></li>
                <li><a href="#items" className="hover:text-[#FFD700]">Gas Cylinders</a></li>
                <li><a href="#items" className="hover:text-[#FFD700]">Mattresses</a></li>
                <li><a href="#items" className="hover:text-[#FFD700]">Electronics</a></li>
                <li><a href="#items" className="hover:text-[#FFD700]">Appliances</a></li>
                <li><a href="#items" className="hover:text-[#FFD700]">Other Goods</a></li>
              </ul>
            </div>

            {/* Col 4: Contact */}
            <div className="lg:col-span-3 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#FFD700]">CONTACT</h4>
              <div className="space-y-1.5 text-xs text-slate-300">
                <a href="tel:0727108749" className="block text-base font-black text-white hover:text-[#FFD700]">
                  0727108749
                </a>
                <a href="tel:0180366344" className="block text-sm font-bold text-slate-200 hover:text-[#FFD700]">
                  0180366344
                </a>
                <p className="text-slate-400 font-semibold pt-1">Call / WhatsApp</p>
                <div className="pt-2 text-xs font-bold text-[#FFD700] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Open 6 Days a Week (8:00 AM – 7:00 PM)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Copyright & Trust Moto */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3 text-center sm:text-left">
            <div>
              © 2026 PEKASA STORE. All Rights Reserved.
            </div>
            <div className="font-bold text-[#FFD700] tracking-wide flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#FFD700]" />
              <span>“Your Valuables • Our Trust”</span>
            </div>
          </div>
        </div>
      </footer>

      {/* 12. FLOATING WHATSAPP BUTTON (Bottom Right) */}
      <a
        href="https://wa.me/254727108749?text=Hello%20PEKASA%20STORE,%20I%20have%20an%20enquiry%20regarding%20used%20goods%20or%20rehani%20cash."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 p-3.5 sm:p-4 rounded-full bg-[#10B981] hover:bg-[#059669] text-white shadow-2xl shadow-black/40 hover:scale-110 transition-transform flex items-center justify-center group"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle className="w-7 h-7 fill-current" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs group-hover:ml-2 font-bold text-xs transition-all duration-300">
          WhatsApp Us
        </span>
      </a>

      {/* 13. FLOATING CALL NOW BUTTON (Mobile Only) */}
      <div className="fixed bottom-6 left-6 z-50 sm:hidden">
        <a
          href="tel:0727108749"
          className="p-3.5 rounded-full bg-[#FFD700] text-[#0B2D4A] shadow-2xl flex items-center justify-center font-black"
          aria-label="Call Now"
        >
          <Phone className="w-6 h-6 fill-current" />
        </a>
      </div>
    </div>
  );
};
