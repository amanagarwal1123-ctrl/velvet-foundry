import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, IndianRupee } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api, apiError } from '@/lib/api';
import { fmtG, fmtRs, fmtDateTime } from '@/lib/format';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { MetricTile } from '@/components/common/KpiTile';
import { BilingualLabel } from '@/components/common/BilingualLabel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

export default function Costing() {
  const { t, metal, workspace } = useApp();
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [karigars, setKarigars] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, e, p, k, st] = await Promise.all([
        api.get('/costing/summary', { params: { workspace, metal } }),
        api.get('/expenses', { params: { workspace, metal } }),
        api.get('/payments', { params: { workspace } }),
        api.get('/karigars', { params: { workspace } }),
        api.get('/settings', { params: { workspace } }),
      ]);
      setSummary(s.data);
      setExpenses(e.data || []);
      setPayments(p.data || []);
      setKarigars(k.data || []);
      setCategories(st.data?.expense_categories || []);
    } catch (err) { toast.error(apiError(err)); } finally { setLoading(false); }
  }, [workspace, metal]);

  useEffect(() => { load(); }, [load]);

  const karigarName = (id) => karigars.find((k) => k.id === id)?.name || '-';

  if (loading || !summary) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  const totals = summary.totals;

  return (
    <div className="space-y-6" data-testid="costing-page">
      <PageHeader titleHi={t('costing')} titleEn="Costing" subtitle={`${t(metal)} · ₹${summary.labour_rate_per_kg}/kg`} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricTile k="labour" labelEn="Labour" value={fmtRs(totals.labour_amount)} />
        <MetricTile labelHi="खर्च" labelEn="Expenses" value={fmtRs(totals.expenses_total)} />
        <MetricTile labelHi="कारीगर भुगतान" labelEn="Karigar Pay" value={fmtRs(totals.karigar_payments)} />
        <MetricTile labelHi="कुल" labelEn="Grand Total" value={fmtRs(totals.grand_total)} tone="primary" testId="costing-grand-total" />
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary" data-testid="tab-summary">सारांश</TabsTrigger>
          <TabsTrigger value="expenses" data-testid="tab-cost-expenses">खर्च</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">भुगतान</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4 space-y-4">
          <Card className="p-4">
            <p className="mb-2 font-semibold">{t('per_bag')}</p>
            <Table>
              <TableHeader><TableRow><TableHead>Bag</TableHead><TableHead>Design</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Labour</TableHead><TableHead className="text-right">Expenses</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">/Item</TableHead></TableRow></TableHeader>
              <TableBody>
                {summary.per_bag.map((r) => (
                  <TableRow key={r.bag_id}>
                    <TableCell className="font-medium">{r.bag_no}</TableCell>
                    <TableCell>{r.design_name}</TableCell>
                    <TableCell className="font-num text-right">{fmtG(r.gross_finished_g)}</TableCell>
                    <TableCell className="font-num text-right">{fmtRs(r.labour_amount)}</TableCell>
                    <TableCell className="font-num text-right">{fmtRs(r.expenses_total)}</TableCell>
                    <TableCell className="font-num text-right font-semibold">{fmtRs(r.total_cost)}</TableCell>
                    <TableCell className="font-num text-right">{fmtRs(r.cost_per_item)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Card className="p-4">
            <p className="mb-2 font-semibold">{t('per_design')}</p>
            <Table>
              <TableHeader><TableRow><TableHead>Design</TableHead><TableHead className="text-right">Bags</TableHead><TableHead className="text-right">Labour</TableHead><TableHead className="text-right">Expenses</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {summary.per_design.map((r) => (
                  <TableRow key={r.design_name}>
                    <TableCell className="font-medium">{r.design_name}</TableCell>
                    <TableCell className="text-right">{r.bags}</TableCell>
                    <TableCell className="font-num text-right">{fmtRs(r.labour_amount)}</TableCell>
                    <TableCell className="font-num text-right">{fmtRs(r.expenses_total)}</TableCell>
                    <TableCell className="font-num text-right font-semibold">{fmtRs(r.total_cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between"><p className="font-semibold">खर्च / Expenses</p><ExpenseDialog categories={categories} onDone={load} /></div>
            {expenses.length === 0 ? <p className="text-sm text-muted-foreground">{t('no_data')}</p> : (
              <ul className="space-y-2">{expenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                  <span>{e.category} {e.note ? `· ${e.note}` : ''}<span className="ml-2 text-xs text-muted-foreground">{fmtDateTime(e.created_at)}</span></span>
                  <span className="flex items-center gap-2"><span className="font-num font-semibold">{fmtRs(e.amount)}</span><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => { await api.delete(`/expenses/${e.id}`); load(); }}><Trash2 className="h-4 w-4" /></Button></span>
                </li>
              ))}</ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between"><p className="font-semibold">कारीगर भुगतान / Karigar Payments</p><PaymentDialog karigars={karigars} onDone={load} /></div>
            {payments.length === 0 ? <p className="text-sm text-muted-foreground">{t('no_data')}</p> : (
              <ul className="space-y-2">{payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                  <span>{karigarName(p.karigar_id)} <span className="rounded-full bg-accent px-2 py-0.5 text-xs capitalize">{p.mode.replace('_', ' ')}</span> {p.period ? `· ${p.period}` : ''}</span>
                  <span className="flex items-center gap-2"><span className="font-num font-semibold">{fmtRs(p.amount)}</span><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => { await api.delete(`/payments/${p.id}`); load(); }}><Trash2 className="h-4 w-4" /></Button></span>
                </li>
              ))}</ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExpenseDialog({ categories, onDone }) {
  const { t, metal, workspace } = useApp();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!category || !amount) { toast.error('Category and amount required'); return; }
    setBusy(true);
    try { await api.post('/expenses', { category, amount: Number(amount), note }, { params: { workspace, metal } }); toast.success('खर्च जुड़ा / Added'); setOpen(false); setAmount(''); setNote(''); onDone(); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-10" data-testid="add-expense-btn"><Plus className="mr-2 h-4 w-4" />{t('add_expense')}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('add_expense')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label><BilingualLabel k="category" /></Label>
            <Select value={category} onValueChange={setCategory}><SelectTrigger data-testid="expense-category"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{categories.map((c, i) => <SelectItem key={i} value={c.en}>{c.hi} / {c.en}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label><BilingualLabel k="amount" en="Amount (₹)" /></Label><Input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11" data-testid="expense-amount" /></div>
          <div className="space-y-2"><Label><BilingualLabel k="note" /></Label><Input value={note} onChange={(e) => setNote(e.target.value)} className="h-11" /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} data-testid="expense-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ karigars, onDone }) {
  const { t, workspace } = useApp();
  const [open, setOpen] = useState(false);
  const [karigar, setKarigar] = useState('');
  const [mode, setMode] = useState('salary');
  const [rate, setRate] = useState('');
  const [quantity, setQuantity] = useState('');
  const [weight, setWeight] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!karigar) { toast.error('Select karigar'); return; }
    setBusy(true);
    try {
      await api.post('/payments', {
        karigar_id: karigar, mode,
        rate: Number(rate || 0), quantity: Number(quantity || 0), weight_g: Number(weight || 0),
        amount: mode === 'salary' ? Number(amount || 0) : undefined, period,
      }, { params: { workspace } });
      toast.success('भुगतान जुड़ा / Added'); setOpen(false); onDone();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-10" data-testid="add-payment-btn"><IndianRupee className="mr-2 h-4 w-4" />{t('add_payment')}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('add_payment')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label><BilingualLabel k="karigar" /></Label>
            <Select value={karigar} onValueChange={setKarigar}><SelectTrigger data-testid="payment-karigar"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{karigars.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label><BilingualLabel hi="प्रकार" en="Payment mode" /></Label>
            <Select value={mode} onValueChange={setMode}><SelectTrigger data-testid="payment-mode"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="salary">Salary / वेतन</SelectItem><SelectItem value="per_piece">Per Piece / प्रति पीस</SelectItem><SelectItem value="per_weight">Per Weight / प्रति ग्राम</SelectItem></SelectContent></Select></div>
          {mode === 'salary' ? (
            <div className="space-y-2"><Label><BilingualLabel k="amount" en="Salary (₹)" /></Label><Input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11" data-testid="payment-amount" /></div>
          ) : mode === 'per_piece' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label><BilingualLabel k="rate" en="₹/piece" /></Label><Input type="number" step="any" value={rate} onChange={(e) => setRate(e.target.value)} className="h-11" data-testid="payment-rate" /></div>
              <div className="space-y-2"><Label><BilingualLabel k="pieces" /></Label><Input type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-11" data-testid="payment-qty" /></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label><BilingualLabel k="rate" en="₹/gram" /></Label><Input type="number" step="any" value={rate} onChange={(e) => setRate(e.target.value)} className="h-11" data-testid="payment-rate" /></div>
              <div className="space-y-2"><Label><BilingualLabel k="weight" en="Weight (g)" /></Label><Input type="number" step="any" value={weight} onChange={(e) => setWeight(e.target.value)} className="h-11" data-testid="payment-weight" /></div>
            </div>
          )}
          <div className="space-y-2"><Label><BilingualLabel hi="अवधि" en="Period" /></Label><Input value={period} onChange={(e) => setPeriod(e.target.value)} className="h-11" placeholder="Nov 2026" /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} data-testid="payment-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
