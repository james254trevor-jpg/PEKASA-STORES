import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  User, 
  Shield, 
  KeyRound, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Clock, 
  Camera, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Eye, 
  EyeOff, 
  Save, 
  Sparkles,
  BadgeCheck,
  ShieldAlert,
  ArrowRight,
  UserCheck
} from 'lucide-react';

interface UserProfileViewProps {
  onNavigateToSettings?: (section?: string) => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({ onNavigateToSettings }) => {
  const { currentUser, updateUserProfile, changeUserPassword, isAdmin, isManager, isCashier, isTechnician } = useAuth();
  const { currentAccent } = useTheme();

  // Profile Form State
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [address, setAddress] = useState(currentUser?.address || '');
  const [notes, setNotes] = useState(currentUser?.notes || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Status banners
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-slate-400">
        Please sign in to view your profile.
      </div>
    );
  }

  // Handle Photo Upload via file input
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setProfileError('Photo file size must be less than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setAvatarUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatarUrl('');
  };

  // Handle Profile Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);

    if (!fullName.trim()) {
      setProfileError('Full name cannot be empty.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await updateUserProfile({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        notes: notes.trim(),
        avatar_url: avatarUrl
      });

      if (res.success) {
        setProfileSuccess('Profile updated successfully!');
        setTimeout(() => setProfileSuccess(null), 4000);
      } else {
        setProfileError(res.error || 'Failed to update profile.');
      }
    } catch (err: any) {
      setProfileError(err?.message || 'An unexpected error occurred.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError('New password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await changeUserPassword(currentPassword, newPassword);
      if (res.success) {
        setPasswordSuccess('Password changed successfully! Keep your new credentials safe.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(null), 5000);
      } else {
        setPasswordError(res.error || 'Failed to change password.');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to change password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 border border-white/10 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#0ABAB5]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with Upload Badge */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl bg-slate-800 flex items-center justify-center text-white text-2xl font-black">
              {avatarUrl ? (
                <img src={avatarUrl} alt={currentUser.full_name} className="w-full h-full object-cover" />
              ) : (
                <span className="tracking-wider bg-gradient-to-br from-[#0ABAB5] to-[#FFD700] bg-clip-text text-transparent text-3xl">
                  {getInitials(currentUser.full_name)}
                </span>
              )}
            </div>

            <label className="absolute -bottom-2 -right-2 p-2 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black rounded-xl cursor-pointer shadow-lg transition-transform hover:scale-110 flex items-center justify-center">
              <Camera className="w-4 h-4" />
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
          </div>

          {/* User Identity Details */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {currentUser.full_name}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                isAdmin
                  ? 'bg-[#FFD700]/15 text-[#FFD700] border-[#FFD700]/30'
                  : isManager
                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  : isCashier
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
              }`}>
                {currentUser.role_title || 'Staff Member'}
              </span>
            </div>

            <div className="text-xs text-slate-300 flex flex-wrap items-center justify-center sm:justify-start gap-4 font-medium">
              <span className="flex items-center gap-1.5 text-slate-400">
                <UserCheck className="w-3.5 h-3.5 text-[#0ABAB5]" />
                <span>@{currentUser.username}</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <Mail className="w-3.5 h-3.5 text-[#0ABAB5]" />
                <span>{currentUser.email || 'No email registered'}</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <Phone className="w-3.5 h-3.5 text-[#0ABAB5]" />
                <span>{currentUser.phone || 'No phone registered'}</span>
              </span>
            </div>

            {/* Quick action buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              {avatarUrl && (
                <button
                  onClick={handleRemovePhoto}
                  className="px-3 py-1 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Avatar</span>
                </button>
              )}
              {onNavigateToSettings && (
                <button
                  onClick={() => onNavigateToSettings('appearance')}
                  className="px-3 py-1 text-xs font-semibold text-slate-200 hover:text-white bg-white/10 hover:bg-white/15 border border-white/15 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FFD700]" />
                  <span>Customize Theme & Colours</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Edit Personal Information & Security Password */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Personal Information Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#0ABAB5]" />
                  <span>Personal & Contact Information</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Update your display name, communication details, and counter contact info.
                </p>
              </div>
            </div>

            {profileSuccess && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#0ABAB5] focus:outline-none rounded-xl text-sm text-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Terminal Username (Permanent)
                  </label>
                  <input
                    type="text"
                    value={currentUser.username}
                    disabled
                    className="w-full px-3.5 py-2.5 bg-black/60 border border-white/10 rounded-xl text-sm text-slate-400 cursor-not-allowed font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>Email Address</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@pekasastores.co.ke"
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#0ABAB5] focus:outline-none rounded-xl text-sm text-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Phone Number</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0727108749 / 0180366344"
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#0ABAB5] focus:outline-none rounded-xl text-sm text-white transition-colors font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Physical Address / Station Location</span>
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Kombani Commercial Centre, Kwale Coast"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#0ABAB5] focus:outline-none rounded-xl text-sm text-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Personal Desk Notes / Specialization
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes regarding duties, shift preferences, or hardware valuation specialty..."
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#0ABAB5] focus:outline-none rounded-xl text-sm text-white transition-colors"
                />
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-[#0ABAB5]/20 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingProfile ? 'Saving Changes...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Secure Password Change Card */}
          <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-5">
            <div className="border-b border-white/10 pb-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#FFD700]" />
                <span>Security & Password Management</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Passwords are protected using PBKDF2/SHA-256 cryptographic salt hashing.
              </p>
            </div>

            {passwordSuccess && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Current Password *
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter existing password"
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#FFD700] focus:outline-none rounded-xl text-sm text-white pr-10 font-mono transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-white"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    New Secure Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Min 4 characters"
                      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#FFD700] focus:outline-none rounded-xl text-sm text-white pr-10 font-mono transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-white"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Confirm New Password *
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repeat new password"
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#FFD700] focus:outline-none rounded-xl text-sm text-white font-mono transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  Tip: Use uppercase, lowercase, and numbers for maximum strength.
                </span>
                <button
                  type="submit"
                  disabled={isSavingPassword || !currentPassword || !newPassword}
                  className="px-5 py-2.5 bg-[#FFD700] hover:bg-[#E6C200] text-black font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-[#FFD700]/20 transition-all disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{isSavingPassword ? 'Verifying...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column (1 Col): Account Status, Privileges & Metadata */}
        <div className="space-y-6">
          {/* Account Overview Box */}
          <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-[#0ABAB5]" />
              <span>Account Credentials</span>
            </h4>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                <span className="text-slate-400 block text-[11px]">System Role & Clearance:</span>
                <strong className="text-white text-sm block">{currentUser.role_title}</strong>
                <p className="text-[11px] text-slate-300 mt-1">
                  {isAdmin
                    ? 'Full executive administrator with unrestricted database, ledger, sales authorization, and settings access.'
                    : isManager
                    ? 'Branch manager authorized for item custody, loan appraisal approvals, and store reporting.'
                    : isCashier
                    ? 'Cashier desk operator authorized for payments, receipts, and cash reconciliations.'
                    : 'Technician authorized for testing, repair parts, and collateral inspections.'}
                </p>
              </div>

              <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                <span className="text-slate-400 block text-[11px]">Account Created:</span>
                <span className="font-mono text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{currentUser.created_at || 'Registered at Setup'}</span>
                </span>
              </div>

              <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                <span className="text-slate-400 block text-[11px]">Last Terminal Login:</span>
                <span className="font-mono text-emerald-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{currentUser.last_login || 'Active Session'}</span>
                </span>
              </div>

              <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                <span className="text-slate-400 block text-[11px]">Assigned Station:</span>
                <span className="font-semibold text-white">
                  Kombani Main Store (HQ) · Kwale
                </span>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts to Settings */}
          {onNavigateToSettings && (
            <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Quick Shortcuts
              </h4>
              <div className="space-y-2">
                <button
                  onClick={() => onNavigateToSettings('appearance')}
                  className="w-full p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left text-xs font-semibold text-white flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#FFD700]" />
                    <span>Theme & Colours</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => onNavigateToSettings('notifications')}
                  className="w-full p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left text-xs font-semibold text-white flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#0ABAB5]" />
                    <span>Notification Alerts</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => onNavigateToSettings('security')}
                  className="w-full p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left text-xs font-semibold text-white flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>Sessions & Security</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {isAdmin && (
                  <button
                    onClick={() => onNavigateToSettings('business')}
                    className="w-full p-2.5 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 border border-[#FFD700]/30 rounded-xl text-left text-xs font-black text-[#FFD700] flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-[#FFD700]" />
                      <span>Business Settings (Admin)</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#FFD700]" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
