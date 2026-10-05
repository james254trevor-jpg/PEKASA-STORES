import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ShoppingBag, 
  Edit3, 
  MoreVertical, 
  Package, 
  Tag, 
  Calendar, 
  TrendingUp, 
  ShieldCheck, 
  MapPin, 
  Check, 
  Share2, 
  Printer, 
  Trash2, 
  AlertTriangle 
} from 'lucide-react';
import { CollateralItem, STORE_NAME } from '../../types';
import { formatKES } from '../../utils/numbering';
import { useTheme } from '../../context/ThemeContext';

interface MobileProductDetailViewProps {
  product: CollateralItem;
  onBack: () => void;
  onSellItem: (product: CollateralItem) => void;
  onEditItem?: (product: CollateralItem) => void;
}

export const MobileProductDetailView: React.FC<MobileProductDetailViewProps> = ({
  product,
  onBack,
  onSellItem,
  onEditItem
}) => {
  const { currentAccent } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Derived financial computations
  const purchasePrice = Number(product.amount_offered) || Number(product.market_value * 0.5) || 0;
  const sellingPrice = Number(product.estimated_resale_value) || Number(product.market_value) || 0;
  const estimatedProfit = Math.max(0, sellingPrice - purchasePrice);
  const marginPercent = sellingPrice > 0 ? Math.round((estimatedProfit / sellingPrice) * 100) : 0;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${product.item_name} - ${STORE_NAME}`,
        text: `${product.item_name} (${product.condition}) for ${formatKES(sellingPrice)} at ${STORE_NAME}.`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${product.item_name} for ${formatKES(sellingPrice)} at ${STORE_NAME}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-24 animate-in fade-in duration-200">
      {/* Top Sticky Header */}
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 p-1.5 -ml-1 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-xs font-bold">Back</span>
        </button>

        <span className="text-xs font-mono font-bold text-slate-400">
          {product.collateral_number}
        </span>

        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-white/15 rounded-2xl shadow-2xl p-1.5 z-50 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleShare();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl text-left"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Product</span>
                </button>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    window.print();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl text-left"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Item Tag</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content with Generous Whitespace */}
      <div className="p-5 space-y-6 flex-1">
        {/* Large Product Image at Top */}
        <div className="w-full aspect-[4/3] rounded-3xl bg-slate-900 border border-white/15 overflow-hidden flex items-center justify-center relative shadow-xl">
          {product.photo_front ? (
            <img
              src={product.photo_front}
              alt={product.item_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
              <Package className="w-16 h-16 stroke-1 text-[#0ABAB5]" />
              <span className="text-xs font-medium text-slate-400">Standard Product View</span>
            </div>
          )}

          {/* Status Badge Overlay */}
          <div className="absolute top-4 left-4">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider backdrop-blur-md shadow-md ${
                product.status === 'Available for Sale'
                  ? 'bg-emerald-500/90 text-black'
                  : product.status === 'Sold'
                  ? 'bg-rose-500/90 text-white'
                  : 'bg-amber-500/90 text-black'
              }`}
            >
              {product.status}
            </span>
          </div>
        </div>

        {/* Product Title & Basic Metadata */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0ABAB5] uppercase tracking-wider">
            <span>{product.category}</span>
            <span>·</span>
            <span>{product.condition}</span>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">
            {product.item_name}
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
            <span>Brand: {product.brand || 'N/A'}</span>
            <span>·</span>
            <span>Model: {product.model || 'N/A'}</span>
            {product.serial_number && (
              <>
                <span>·</span>
                <span>S/N: {product.serial_number}</span>
              </>
            )}
          </div>
        </div>

        {/* Price & Profit Card (Spacious, Elevated) */}
        <div className="p-5 rounded-2xl bg-white/5 border border-white/15 space-y-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Selling Price
            </span>
            <span className="text-2xl font-black text-[#0ABAB5]">
              {formatKES(sellingPrice)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Intake / Purchase:</span>
              <span className="font-bold text-slate-200 mt-0.5 block">{formatKES(purchasePrice)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Estimated Profit:</span>
              <span className="font-black text-emerald-400 mt-0.5 block">
                +{formatKES(estimatedProfit)} ({marginPercent}%)
              </span>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Description & Notes
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed p-4 rounded-2xl bg-white/5 border border-white/10">
            {product.notes || product.accessories_included 
              ? `${product.notes || ''} ${product.accessories_included ? `Accessories: ${product.accessories_included}` : ''}`
              : 'Second-hand goods inspected and verified in good operating condition according to PEKASA STORE standards.'}
          </p>
        </div>

        {/* Storage & Item ID Details */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Vault Location & Details
          </h3>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Storage Rack / Shelf:</span>
              <span className="font-bold text-white">{product.rack_shelf || 'Showroom Display'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Date Added / Intaken:</span>
              <span className="font-bold text-white">{product.date_received || product.created_at?.split(' ')[0] || 'Recent'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Security Tag:</span>
              <span className="font-mono text-[#0ABAB5] font-bold">{product.security_tag || product.collateral_number}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Area */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-slate-950/90 backdrop-blur-xl border-t border-white/15 flex items-center gap-3">
        {onEditItem && (
          <button
            onClick={() => onEditItem(product)}
            className="flex-1 py-3.5 px-4 rounded-xl border border-white/20 bg-white/5 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit</span>
          </button>
        )}

        <button
          onClick={() => onSellItem(product)}
          className="flex-[2] py-3.5 px-4 rounded-xl bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0ABAB5]/25 active:scale-98 transition-all"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Sell Item</span>
        </button>
      </div>
    </div>
  );
};
