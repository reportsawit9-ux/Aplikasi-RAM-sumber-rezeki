import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Lock,
  Printer,
  Download,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Calendar,
  Layers,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { UserProfile, FactorySale, WeighingTicket, Shipment, CashTransaction, CashAccount, LoanDebt } from '../types';
import { storage } from '../lib/storage';

interface ReportsSectionProps {
  currentUser: UserProfile;
}

export const ReportsSection: React.FC<ReportsSectionProps> = ({ currentUser }) => {
  const isOwner = currentUser.role === 'OWNER';
  const [reportTab, setReportTab] = useState<'laba_rugi' | 'neraca' | 'susut_pks'>('laba_rugi');

  const [sales, setSales] = useState<FactorySale[]>([]);
  const [tickets, setTickets] = useState<WeighingTicket[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [stockSummary, setStockSummary] = useState<any>({});
  const [loans, setLoans] = useState<LoanDebt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOwner) return;
    const load = async () => {
      setLoading(true);
      try {
        const [sl, tk, sh, tx, ca, st, ln] = await Promise.all([
          storage.getFactorySales(),
          storage.getTickets(),
          storage.getShipments(),
          storage.getCashTransactions(),
          storage.getCashAccounts(),
          storage.getStockSummary(),
          storage.getLoans(),
        ]);
        setSales(sl || []);
        setTickets(tk || []);
        setShipments(sh || []);
        setTransactions(tx || []);
        setCashAccounts(ca || []);
        setStockSummary(st || {});
        setLoans(ln || []);
      } catch (e) {
        console.error('Error loading reports data:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOwner]);

  if (!isOwner) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-2xl mx-auto my-8 shadow-sm">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          Laporan Keuangan Terproteksi (Owner Only)
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
          Berdasarkan pembatasan hak akses sistem RAM Sumber Rezeki, Laporan Laba Rugi,
          Neraca, dan Analisis Keuangan Keseluruhan hanya berhak dibuka oleh Owner.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Memuat Laporan Keuangan...</p>
        </div>
      </div>
    );
  }

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  // 1. LABA RUGI CALCULATIONS
  // Revenue from Factory Sales
  const totalPendapatanPenjualan = sales.reduce((acc, s) => acc + s.totalNetSale, 0);

  // HPP of sold goods
  const totalHppPembelian = sales.reduce((acc, s) => acc + s.actualHpp, 0);
  
  // Costs that move to HPP (Direct Costs)
  const totalOngkosKirim = sales.reduce((acc, s) => acc + (s.shippingCost || 0), 0);
  
  const totalUpahMuat = sales.reduce((acc, s) => acc + (s.loadingCost || 0), 0);

  const totalKomisiAffiliate = transactions
    .filter((tx) => tx.type === 'KOMISI_AFFILIATE')
    .reduce((acc, tx) => acc + tx.amount, 0);

  const totalHpp = totalHppPembelian + totalOngkosKirim + totalUpahMuat + totalKomisiAffiliate;

  // Laba Kotor
  const labaKotor = totalPendapatanPenjualan - totalHpp;

  // Beban Operasional (Expenses) - Excluding the ones moved to HPP
  const operationalExpenses = transactions.filter(
    (tx) => 
      tx.type === 'PENGELUARAN_OPERASIONAL' && 
      tx.category !== 'Ongkos Angkut Truk PKS' && 
      tx.category !== 'Upah Muat Truk'
  );
  
  const totalBebanOperasional = operationalExpenses.reduce(
    (acc, tx) => acc + tx.amount,
    0
  );

  // Laba Bersih Operasional
  const labaBersih = labaKotor - totalBebanOperasional;

  // 2. NERACA CALCULATIONS
  // Assets
  const totalKas = cashAccounts.reduce((acc, a) => acc + a.balance, 0);
  const totalPiutangKasbon = loans
    .filter((l) => l.type !== 'MODAL_OWNER' && l.status === 'AKTIF')
    .reduce((acc, l) => acc + l.remainingAmount, 0);
  const totalNilaiStokRAM: number = (Object.values(stockSummary) as any[]).reduce(
    (acc: number, s: any) => acc + (s?.stockValue || 0),
    0
  );
  const totalStokDalamPerjalanan = shipments
    .filter((s) => s.status === 'DALAM_PERJALANAN')
    .reduce((acc, s) => acc + s.totalEstimatedHpp, 0);

  const totalAktiva =
    totalKas + totalPiutangKasbon + totalNilaiStokRAM + totalStokDalamPerjalanan;

  // Liabilities & Equity
  const totalUtangModalOwner = loans
    .filter((l) => l.type === 'MODAL_OWNER' && l.status === 'AKTIF')
    .reduce((acc, l) => acc + l.remainingAmount, 0);

  const totalUtangPetani = tickets
    .filter((t) => t.paymentStatus === 'BELUM_LUNAS')
    .reduce((acc, t) => acc + t.farmerPayment, 0);

  const totalKewajiban = totalUtangModalOwner + totalUtangPetani;
  const modalAwalEkuitas = 100000000; // Capital benchmark
  const totalEkuitas = totalAktiva - totalKewajiban;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-3.5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
              OWNER FINANCIAL REPORT
            </span>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              Laporan Keuangan RAM Sumber Rezeki
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Laba rugi otomatis, neraca aktiva-pasiva, dan analisis susut penimbangan
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
          >
            <Printer className="w-4 h-4" />
            Cetak Laporan
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-xs font-bold">
        <button
          onClick={() => setReportTab('laba_rugi')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            reportTab === 'laba_rugi'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Laporan Laba Rugi Komprehensif
        </button>
        <button
          onClick={() => setReportTab('neraca')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            reportTab === 'neraca'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Neraca Saldo Sederhana
        </button>
        <button
          onClick={() => setReportTab('susut_pks')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            reportTab === 'susut_pks'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale className="w-4 h-4" />
          Analisis Susut Timbang PKS
        </button>
      </div>

      {/* 1. Laba Rugi Tab Content */}
      {reportTab === 'laba_rugi' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4">
          <div className="text-center pb-4 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-900 text-lg">
              LAPORAN LABA RUGI OPERASIONAL
            </h3>
            <p className="text-xs text-slate-500">
              RAM SUMBER REZEKI • Periode Berjalan (Tahun 2026)
            </p>
          </div>

          <div className="space-y-4 max-w-3xl mx-auto text-xs">
            {/* Section A: Pendapatan */}
            <div className="space-y-2">
              <div className="flex justify-between items-center font-bold text-slate-900 text-sm bg-slate-50 p-2.5 rounded-xl">
                <span>1. PENDAPATAN OPERASIONAL</span>
                <span className="font-mono">{formatRupiah(totalPendapatanPenjualan)}</span>
              </div>
              <div className="pl-4 pr-2 space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Hasil Penjualan Sawit ke Pabrik (PKS)</span>
                  <span className="font-mono">{formatRupiah(totalPendapatanPenjualan)}</span>
                </div>
              </div>
            </div>

            {/* Section B: HPP */}
            <div className="space-y-2">
              <div className="flex justify-between items-center font-bold text-slate-900 text-sm bg-slate-50 p-2.5 rounded-xl">
                <span>2. HARGA POKOK PENJUALAN (HPP)</span>
                <span className="font-mono text-rose-600">({formatRupiah(totalHpp)})</span>
              </div>
              <div className="pl-4 pr-2 space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Pembelian Buah Terjual (TBS dari Petani)</span>
                  <span className="font-mono">{formatRupiah(totalHppPembelian)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ongkos Angkut Truk Ekspedisi ke PKS</span>
                  <span className="font-mono">{formatRupiah(totalOngkosKirim)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Upah Muat Truk</span>
                  <span className="font-mono">{formatRupiah(totalUpahMuat)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Komisi Rombongan / Affiliate</span>
                  <span className="font-mono">{formatRupiah(totalKomisiAffiliate)}</span>
                </div>
              </div>
            </div>

            {/* Laba Kotor Subtotal */}
            <div className="flex justify-between items-center p-3 rounded-xl bg-indigo-50/80 border border-indigo-100 font-bold text-indigo-950 text-sm">
              <span>LABA KOTOR (GROSS MARGIN):</span>
              <span className="font-mono text-base font-black text-indigo-800">
                {formatRupiah(labaKotor)}
              </span>
            </div>

            {/* Section C: Beban Operasional */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center font-bold text-slate-900 text-sm bg-slate-50 p-2.5 rounded-xl">
                <span>3. BEBAN OPERASIONAL</span>
                <span className="font-mono text-rose-600">
                  ({formatRupiah(totalBebanOperasional)})
                </span>
              </div>
              <div className="pl-4 pr-2 space-y-1 text-slate-600">
                {operationalExpenses.map((exp) => (
                  <div key={exp.id} className="flex justify-between">
                    <span>{exp.category} ({exp.description})</span>
                    <span className="font-mono">{formatRupiah(exp.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Final Net Profit */}
            <div className="pt-4 border-t-2 border-slate-900">
              <div className="flex justify-between items-center p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                    LABA BERSIH OPERASIONAL (NET PROFIT)
                  </span>
                  <p className="text-[11px] text-emerald-600">
                    Pendapatan Penjualan - HPP - Seluruh Biaya Operasional
                  </p>
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700">
                  {formatRupiah(labaBersih)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Neraca Tab Content */}
      {reportTab === 'neraca' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="text-center pb-4 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-900 text-lg">
              NERACA KEUANGAN SEDERHANA
            </h3>
            <p className="text-xs text-slate-500">
              RAM SUMBER REZEKI • Posisi Aset, Kewajiban, dan Modal
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
            {/* AKTIVA (ASSETS) */}
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-indigo-900 border-b pb-2 flex items-center justify-between">
                <span>AKTIVA (ASET RAM)</span>
                <span className="font-mono">{formatRupiah(totalAktiva)}</span>
              </h4>

              <div className="space-y-2">
                <span className="font-bold text-slate-700 block">Aset Lancar:</span>
                <div className="pl-3 space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>Kas & Bank (Owner, Admin, Petty Cash)</span>
                    <span className="font-mono font-bold text-slate-900">{formatRupiah(totalKas)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Piutang Kasbon Petani & Sopir</span>
                    <span className="font-mono font-bold text-slate-900">{formatRupiah(totalPiutangKasbon)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Persediaan Buah di RAM Fisik</span>
                    <span className="font-mono font-bold text-slate-900">{formatRupiah(totalNilaiStokRAM)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Persediaan Dalam Perjalanan (Truk PKS)</span>
                    <span className="font-mono font-bold text-slate-900">{formatRupiah(totalStokDalamPerjalanan)}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-indigo-50 rounded-xl font-bold flex justify-between text-indigo-950">
                <span>TOTAL AKTIVA</span>
                <span className="font-mono text-sm">{formatRupiah(totalAktiva)}</span>
              </div>
            </div>

            {/* PASIVA (LIABILITIES & EQUITY) */}
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-slate-900 border-b pb-2 flex items-center justify-between">
                <span>PASIVA (KEWAJIBAN & MODAL)</span>
                <span className="font-mono">{formatRupiah(totalKewajiban + totalEkuitas)}</span>
              </h4>

              <div className="space-y-2">
                <span className="font-bold text-slate-700 block">Kewajiban / Utang:</span>
                <div className="pl-3 space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>Pinjaman Modal dari Owner</span>
                    <span className="font-mono font-bold text-rose-600">{formatRupiah(totalUtangModalOwner)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hutang Pembayaran Petani (Belum Lunas)</span>
                    <span className="font-mono font-bold text-rose-600">{formatRupiah(totalUtangPetani)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-700 block">Ekuitas & Modal:</span>
                <div className="pl-3 space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>Ekuitas Berjalan & Laba Ditahan</span>
                    <span className="font-mono font-bold text-emerald-700">{formatRupiah(totalEkuitas)}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-100 rounded-xl font-bold flex justify-between text-slate-900">
                <span>TOTAL PASIVA</span>
                <span className="font-mono text-sm">{formatRupiah(totalKewajiban + totalEkuitas)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Susut Timbang Tab Content */}
      {reportTab === 'susut_pks' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Analisis Susut Timbang Pengiriman Pabrik (RAM vs PKS)
              </h3>
              <p className="text-xs text-slate-500">
                Evaluasi selisih timbangan armada antara pos RAM dengan slip timbangan pabrik
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Surat Jalan</th>
                  <th className="py-3 px-4">Pabrik PKS</th>
                  <th className="py-3 px-4 text-right">Netto RAM (kg)</th>
                  <th className="py-3 px-4 text-right">Netto 1 PKS (kg)</th>
                  <th className="py-3 px-4 text-right">Susut Muatan (kg)</th>
                  <th className="py-3 px-4 text-right">Persentase Susut</th>
                  <th className="py-3 px-4 text-center">Evaluasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {s.shipmentNumber}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {s.factoryName}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {s.ramNettoKg.toLocaleString('id-ID')} kg
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-indigo-950 font-bold">
                      {s.factoryNetto1.toLocaleString('id-ID')} kg
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-rose-600">
                      {s.shrinkageKg} kg
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-rose-600">
                      {s.shrinkagePct}%
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          s.shrinkagePct <= 0.5
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {s.shrinkagePct <= 0.5 ? 'Normal Sesuai Standar' : 'Perlu Evaluasi Timbangan'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
