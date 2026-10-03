import React, { useState, useRef } from 'react';
import { sqliteService } from '../db/sqlite';
import { X, Download, Upload, RefreshCw, HardDrive, CheckCircle2, AlertTriangle, FileCode } from 'lucide-react';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({ isOpen, onClose }) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Download official .sqlite binary file
  const handleDownloadSqlite = () => {
    try {
      const bytes = sqliteService.exportDatabaseBinary();
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `PEKASA_Database_${dateStr}.sqlite`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage('SQLite database exported successfully (.sqlite binary format).');
    } catch (e: any) {
      console.error(e);
      setStatusMessage('Error exporting SQLite database: ' + (e?.message || 'Unknown'));
    }
  };

  // Download JSON backup
  const handleDownloadJson = () => {
    try {
      const json = sqliteService.exportDatabaseJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `PEKASA_Relational_Backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage('JSON relational backup exported successfully.');
    } catch (e: any) {
      console.error(e);
      setStatusMessage('Error exporting JSON backup: ' + (e?.message || 'Unknown'));
    }
  };

  // Upload and restore file (.sqlite or .json)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage('Reading file and verifying relational structure...');

    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        await sqliteService.restoreFromJson(text);
        setStatusMessage('Successfully restored PEKASA database from JSON backup!');
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        await sqliteService.restoreFromSqliteBinary(bytes);
        setStatusMessage('Successfully restored SQLite database from .sqlite file!');
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage('Failed to restore database: ' + (err?.message || 'Invalid format'));
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearAllData = async () => {
    if (!confirm('Are you sure you want to clear all customer names, loans, payments, and profit data? This will give you a clean slate to install your personal records. Admin accounts (Trevor and Peter) and store settings will be preserved.')) {
      return;
    }
    setIsProcessing(true);
    try {
      await sqliteService.clearAllOperationalData();
      setStatusMessage('All customer names, loans, and profit data have been cleared successfully. Ready for personal data entry!');
    } catch (e: any) {
      setStatusMessage('Clear error: ' + e?.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Database Backup & Recovery</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-sm text-slate-300">
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-200">Relational SQLite Storage Engine</span>
              <span className="text-emerald-400 font-mono">IndexedDB Persistent</span>
            </div>
            <p className="text-xs text-slate-400">
              PEKASA uses an embedded WebAssembly SQLite database running locally on your device. All records
              (customers, appliances, payments, invoices, inventory) are relationally linked. You can export the
              exact binary <span className="text-amber-400 font-mono">.sqlite</span> database or restore from a previous backup file at any time.
            </p>
          </div>

          {statusMessage && (
            <div className="flex items-start gap-2.5 p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Download Options */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              1. Download Database Backup
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleDownloadSqlite}
                className="p-3.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl flex items-center gap-3 transition-colors text-left cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-white text-xs">Download .sqlite File</div>
                  <div className="text-[11px] text-slate-400">Full binary database</div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleDownloadJson}
                className="p-3.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl flex items-center gap-3 transition-colors text-left cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-white text-xs">Download JSON Backup</div>
                  <div className="text-[11px] text-slate-400">Human-readable dump</div>
                </div>
              </button>
            </div>
          </div>

          {/* Restore Option */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              2. Restore Previous Database
            </h3>
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <p className="text-xs text-slate-400">
                Select an existing <span className="text-amber-400 font-mono">.sqlite</span>, <span className="text-amber-400 font-mono">.db</span>, or <span className="text-emerald-400 font-mono">.json</span> file to restore.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".sqlite,.db,.sqlite3,.json"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Clear Operational Data Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>3. Clean Slate for Personal Installation</span>
              <span className="text-[10px] text-amber-400 font-normal">Admins Preserved</span>
            </h3>
            <div className="p-4 bg-rose-950/20 border border-rose-800/40 rounded-xl space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-rose-300">Clear All Customer Names & Profit Records</div>
                  <p className="text-[11px] text-slate-400">
                    Wipes all customer profiles, collaterals, loans, payments, profit figures, and transactions so you can install and enter all your personal store records from a 100% clean baseline. Admin accounts (Trevor and Peter) remain active.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearAllData}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-900/30 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>Clear All Customer Names, Loans & Profit Data Now</span>
              </button>
            </div>
          </div>

          {/* Reset Option */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleClearAllData}
              disabled={isProcessing}
              className="text-xs text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>Reset to Clean Slate (Clear All Data)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
