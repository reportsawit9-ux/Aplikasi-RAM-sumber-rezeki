import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Lock,
  Layers,
  Fuel,
  Wrench,
  Receipt,
} from 'lucide-react';
import { CashAccount, CashTransaction, UserProfile } from '../types';
import { storage } from '../lib/storage';

interface CashSectionProps {
  currentUser: UserProfile;
}

export const CashSection: React.FC<CashSectionProps> = ({ currentUser }) => {
  const isOwner = currentUser.role === 'OWNER';

  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('ALL');
  const [directionFilter, setDirectionFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Expense Form Fields
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [expenseCategory, setExpenseCategory] = useState('BBM & Solar Genset');
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState<'KAS_ADMIN' | 'KAS_OWNER'>('KAS_ADMIN');

  // Transfer Form Fields
  const [transferFrom, setTransferFrom] = useState<'KAS_OWNER' | 'KAS_ADMIN'>('KAS_OWNER');
  const [transferTo, setTransferTo] = useState<'KAS_OWNER' | 'KAS_ADMIN' | 'PETTY_CASH'>('KAS_ADMIN');
  const [transferAmount, setTransferAmount] = useState<number | ''>('');
  const [transferNotes, setTransferNotes] = useState('');

  const refreshData = async () => {
    try {
      let accs = await storage.getCashAccounts();
      if (!isOwner && !accs.some(a => a.id === 'KAS_ADMIN')) {
        const adminAcc = await storage.getCashAccountById('KAS_ADMIN');
        if (adminAcc) accs = [...accs, adminAcc];
      }
      const txs = await storage.getCashTransactions();
      setAccounts(accs);
      setTransactions(txs);
    } catch (err) {
      console.error('Error refreshing cash data:', err);
    }
  };

  useEffect(() => {
    refreshData();
  }, [currentUser.id, currentUser.role]);

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  // Filter visible accounts based on role:
  // Admin sees KAS_ADMIN! Owner sees all.
  const visibleAccounts = accounts.filter((acc) => {
    if (isOwner) return true;
    if (acc.id === 'KAS_ADMIN') return true;
    return Array.isArray(acc.roleRestricted) && acc.roleRestricted.includes(currentUser.role);
  });

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(expenseAmount) || 0;
    if (amount <= 0) {
      alert('Nominal pengeluaran harus lebih besar dari Rp 0!');
      return;
    }

    await storage.addCashTransaction({
      transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
      date: expenseDate,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      type: 'PENGELUARAN_OPERASIONAL',
      category: expenseCategory,
      accountId: isOwner ? expenseAccountId : 'KAS_ADMIN',
      direction: 'OUT',
      amount,
      description: expenseDescription || expenseCategory,
    });

    await refreshData();
    setIsExpenseModalOpen(false);
    setExpenseAmount('');
    setExpenseDescription('');
    alert('Pengeluaran operasional berhasil dicatat!');
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(transferAmount) || 0;
    if (amount <= 0) {
      alert('Nominal transfer harus lebih besar dari Rp 0!');
      return;
    }

    if (transferFrom === transferTo) {
      alert('Akun asal dan akun tujuan tidak boleh sama!');
      return;
    }

    const fromAcc = accounts.find((a) => a.id === transferFrom);
    if (fromAcc && fromAcc.balance < amount) {
      alert(`Saldo ${fromAcc.name} tidak mencukupi (Rp ${fromAcc.balance.toLocaleString('id-ID')})!`);
      return;
    }

    await storage.transferCash(transferFrom, transferTo, amount, transferNotes);
    await refreshData();
    setIsTransferModalOpen(false);
    setTransferAmount('');
    setTransferNotes('');
    alert('Transfer saldo kas antarakun berhasil dijalankan!');
  };

  // Filter transactions visible to user
  const visibleTransactions = transactions.filter((tx) => {
    // If Admin, only show transactions concerning KAS_ADMIN
    if (!isOwner && tx.accountId !== 'KAS_ADMIN' && tx.targetAccountId !== 'KAS_ADMIN') {
      return false;
    }

    const matchAccount =
      selectedAccountFilter === 'ALL' ||
      tx.accountId === selectedAccountFilter ||
      tx.targetAccountId === selectedAccountFilter;

    const matchDirection =
      directionFilter === 'ALL' || tx.direction === directionFilter;

    const matchSearch =
      tx.transactionNumber.toLowerCase().includes(search.toLowerCase()) ||
      tx.category.toLowerCase().includes(search.toLowerCase()) ||
      tx.description.toLowerCase().includes(search.toLowerCase());

    return matchAccount && matchDirection && matchSearch;
  });

  return (
    <div className="space-y-3.5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-4 h-4 text-indigo-600" />
            Manajemen Saldo Kas & Pengeluaran RAM
          </h2>
          <p className="text-xs text-slate-500">
            {isOwner
              ? 'Monitoring Kas Owner, Kas Admin, Petty Cash, dan mutasi pengeluaran'
              : 'Monitoring saldo Kas Operasional Admin dan pengeluaran harian pos timbangan'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 flex items-center gap-2 transition-all"
            >
              <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
              Transfer Antarkas
            </button>
          )}

          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            Catat Biaya Operasional
          </button>
        </div>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {visibleAccounts.map((acc) => {
          const isMainOwner = acc.id === 'KAS_OWNER';
          const isPetty = acc.id === 'PETTY_CASH';

          return (
            <div
              key={acc.id}
              className={`p-4 sm:p-5 rounded-3xl border shadow-xs transition-all relative overflow-hidden ${
                isMainOwner
                  ? 'bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white border-indigo-800'
                  : 'bg-white border-slate-200/90 text-slate-900'
              }`}
            >
              <div className="flex justify-between items-start">
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                    isMainOwner
                      ? 'bg-white/10 text-indigo-200 border border-white/15'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {acc.id}
                </span>
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isMainOwner
                      ? 'bg-white/10 text-white'
                      : 'bg-indigo-50 text-indigo-600'
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-3">
                <span
                  className={`text-xs font-semibold ${
                    isMainOwner ? 'text-indigo-200' : 'text-slate-500'
                  }`}
                >
                  {acc.name}
                </span>
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight mt-1">
                  {formatRupiah(acc.balance)}
                </div>
              </div>

              <p
                className={`text-[11px] mt-3 pt-2.5 border-t ${
                  isMainOwner
                    ? 'border-white/10 text-slate-300'
                    : 'border-slate-100 text-slate-400'
                }`}
              >
                {acc.description}
              </p>
            </div>
          );
        })}

        {/* Informative placeholder if user is Admin and can't see Owner cash */}
        {!isOwner && (
          <div className="p-4 sm:p-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 flex flex-col justify-center items-center text-center">
            <div className="w-9 h-9 rounded-2xl bg-slate-200 text-slate-400 flex items-center justify-center mb-1.5">
              <Lock className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-xs text-slate-700">Kas Utama Owner Terproteksi</h4>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
              Sesuai hak akses Admin, Kas Utama Owner dan Petty Cash Keuntungan hanya dapat dilihat oleh Owner.
            </p>
          </div>
        )}
      </div>

      {/* Transaction Filter & History Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari transaksi kas, kategori, keterangan..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium"
            >
              <option value="ALL">Semua Arah Arus</option>
              <option value="IN">Masuk (Penerimaan)</option>
              <option value="OUT">Keluar (Pengeluaran)</option>
            </select>

            {isOwner && (
              <select
                value={selectedAccountFilter}
                onChange={(e) => setSelectedAccountFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium"
              >
                <option value="ALL">Semua Akun Kas</option>
                <option value="KAS_ADMIN">Kas Admin</option>
                <option value="KAS_OWNER">Kas Owner</option>
                <option value="PETTY_CASH">Petty Cash</option>
              </select>
            )}
          </div>
        </div>

        {/* Dense Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px] leading-tight border-collapse">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-tighter">
              <tr>
                <th className="py-2 px-2 whitespace-nowrap">Bukti / Waktu</th>
                <th className="py-2 px-2">Kategori / Keterangan</th>
                <th className="py-2 px-2">Akun</th>
                <th className="py-2 px-2">Pihak</th>
                <th className="py-2 px-2 text-right">Nominal (Rp)</th>
                <th className="py-2 px-2 text-right">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-1.5 px-2 whitespace-nowrap">
                    <div className="flex flex-col leading-none">
                      <span className="font-mono font-bold text-slate-900">{tx.transactionNumber}</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">{tx.date} {tx.time}</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-2">
                    <div className="flex flex-col leading-none">
                      <span className="font-bold text-slate-800">{tx.category}</span>
                      <span className="text-[9px] text-slate-500 mt-0.5 truncate max-w-[200px]">{tx.description}</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-2">
                    <span className="px-1 py-0.5 rounded-[4px] font-black uppercase text-[8px] bg-slate-100 text-slate-600 border border-slate-200">
                      {tx.accountId.replace('KAS_', '')}
                    </span>
                    {tx.targetAccountId && (
                      <span className="text-slate-400 mx-1">➔ {tx.targetAccountId.replace('KAS_', '')}</span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-slate-600 truncate max-w-[100px]">
                    {tx.partyName || '-'}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono font-black text-[11px] whitespace-nowrap">
                    <span className={tx.direction === 'IN' ? 'text-emerald-600' : 'text-rose-600'}>
                      {tx.direction === 'IN' ? '+' : '-'}{Math.round(tx.amount).toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-right text-slate-400 opacity-70 italic">
                    {tx.createdByName.split(' ')[0]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleExpenseSubmit}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600" />
                Catat Pengeluaran Operasional
              </h3>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kategori Biaya
              </label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
              >
                <option value="BBM & Solar Genset">BBM & Solar Genset Timbangan</option>
                <option value="Upah & Gaji Karyawan">Upah & Gaji Karyawan Lapangan</option>
                <option value="Makan & Konsumsi Pekerja">Makan & Konsumsi Harian</option>
                <option value="Perawatan & Kalibrasi Timbangan">Perawatan & Tera Timbangan</option>
                <option value="Listrik, Pulsa & ATK">Listrik, Pulsa & Kertas Struk ATK</option>
                <option value="Biaya Lain-Lain">Biaya Operasional Lain-Lain</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sumber Kas Pembayaran
              </label>
              <select
                value={expenseAccountId}
                onChange={(e) =>
                  setExpenseAccountId(e.target.value as 'KAS_ADMIN' | 'KAS_OWNER')
                }
                disabled={!isOwner}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold"
              >
                <option value="KAS_ADMIN">Kas Operasional Admin (Brankas RAM)</option>
                {isOwner && <option value="KAS_OWNER">Kas Utama Owner</option>}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jumlah Pengeluaran (Rp)
              </label>
              <input
                type="number"
                placeholder="0"
                value={expenseAmount}
                onChange={(e) =>
                  setExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full px-3 py-2 text-sm font-mono font-black text-rose-600 border border-slate-200 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Keterangan Lengkap
              </label>
              <input
                type="text"
                placeholder="Contoh: Beli 25 liter solar untuk genset sore"
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20"
              >
                Simpan Pengeluaran
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Transfer Modal (Owner Only) */}
      {isTransferModalOpen && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleTransferSubmit}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
                Transfer Antarkas RAM
              </h3>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dari Akun Asal
                </label>
                <select
                  value={transferFrom}
                  onChange={(e) =>
                    setTransferFrom(e.target.value as 'KAS_OWNER' | 'KAS_ADMIN')
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="KAS_OWNER">Kas Owner</option>
                  <option value="KAS_ADMIN">Kas Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ke Akun Tujuan
                </label>
                <select
                  value={transferTo}
                  onChange={(e) =>
                    setTransferTo(
                      e.target.value as 'KAS_OWNER' | 'KAS_ADMIN' | 'PETTY_CASH'
                    )
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="KAS_ADMIN">Kas Admin (Operasional)</option>
                  <option value="PETTY_CASH">Petty Cash Keuntungan</option>
                  <option value="KAS_OWNER">Kas Owner</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jumlah Transfer (Rp)
              </label>
              <input
                type="number"
                placeholder="0"
                value={transferAmount}
                onChange={(e) =>
                  setTransferAmount(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full px-3 py-2 text-sm font-mono font-black text-indigo-900 border border-slate-200 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan / Alasan Transfer
              </label>
              <input
                type="text"
                placeholder="Contoh: Drop dana kas operasional pos timbang harian"
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20"
              >
                Jalankan Transfer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
