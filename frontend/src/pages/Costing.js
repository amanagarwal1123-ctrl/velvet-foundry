import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, Trash2 } from 'lucide-react';
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
  const { t, L, metal, workspace } = useApp();
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [karigars, setKarigars] = useState([]);
  const [bags, setBags] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, e, p, k, b, st] = await Promise.all([
        api.get('/costing/summary', { params: { workspace, metal } }),
        api.get('/expenses', { params: { workspace, metal } }),
        api.get('/payments', { params: { workspace, metal } }),
        api.get('/karigars', { params: { workspace, metal } }),
        api.get('/bags', { params: { workspace, metal } }),
        api.get('/settings', { params: { workspace } }),
      ]);
      setSummary(s.data);
      setExpenses(e.data || []);
      setPayments(p.data || []);
      setKarigars(k.data || []);
      setBags(b.data || []);
      setCategories(st.data?.expense_categories || []);
    } catch (err) { toast.error(apiError(err)); } finally { setLoading(false); }
  }, [workspace, metal]);

  useEffect(() => { load(); }, [load]);

  const karigarName = (id) => karigars.find((k) => k.id === id)?.name || '-';
  const bagNo = (id) => bags.find((b) => b.id === id)?.bag_no;

  if (loading || !summary) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  const totals = summary.totals;

  return (
    <div className="space-y-6" data-testid="costing-page">
      <PageHeader title={t('costing')} subtitle={`${t(metal)} · ${fmtRs(summary.labour_rate_per_kg)}/kg`} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <MetricTile k="labour" labelEn="Labour" value={fmtRs(totals.labour_amount)} />
        <MetricTile labelHi="खर्च" labelEn="Expenses" value={fmtRs(totals.expenses_total)} />
        <MetricTile labelHi="बिना बैग खर्च" labelEn="Unallocated" value={fmtRs(totals.unallocated_expenses)} tone="info" testId="costing-unallocated" />
        <MetricTile labelHi="कारीगर भुगतान" labelEn="Karigar Pay" value={fmtRs(totals.karigar_payments)} />
        <MetricTile labelHi="कुल" labelEn="Grand Total" value={fmtRs(totals.grand_total)} tone="primary" testId="costing-grand-total" />
      </div>
      <p className="text-xs text-muted-foreground">{L('लेबर पोस्ट की गई डिलीवरी की दर पर तय होती है और बाद में दर बदलने से नहीं बदलती।', 'Labour is fixed at each delivery\u2019s posted rate and does not change if the rate is edited later.')}</p>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary" data-testid="tab-summary">{L('सारांश', 'Summary')}</TabsTrigger>
          <TabsTrigger value="expenses" data-testid="tab-cost-expenses">{L('खर्च', 'Expenses')}</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">{L('भुगतान', 'Payments')}</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4 space-y-4">
          <Card className="p-4">
            <p className="mb-2 font-semibold">{t('per_bag')}</p>
            <Table>
              <TableHeader><TableRow><TableHead>{L('बैग', 'Bag')}</TableHead><TableHead>{L('डिज़ाइन', 'Design')}</TableHead><TableHead className="text-right">{L('ग्रॉस', 'Gross')}</TableHead><TableHead className="text-right">{L('लेबर', 'Labour')}</TableHead><TableHead className="text-right">{L('खर्च', 'Expenses')}</TableHead><TableHead className="text-right">{L('कुल', 'Total')}</TableHead><TableHead className="text-right">/{L('पीस', 'Item')}</TableHead></TableRow></TableHeader>
              <TableBody>
                {summary.per_bag.map((r) => (
                  <TableRow key={r.bag_id}>
                    <TableCell className="font-medium">{r.bag_no}{r.needs_review ? <span className="ml-1 text-xs text-[hsl(var(--warning))]">{L('(जाँचें)', '(review)')}</span> : null}</TableCell>
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
            {totals.unallocated_expenses > 0 ? (
              <p className="mt-3 rounded-lg bg-[hsl(var(--info))]/10 p-2 text-sm" data-testid="costing-unallocated-note">{L('फैक्टरी-स्तर (बिना बैग) खर्च', 'Factory-level (unallocated) expenses')}: <span className="font-num font-semibold">{fmtRs(totals.unallocated_expenses)}</span> — {L('किसी बैग से नहीं जुड़ा, कुल में एक बार गिना गया।', 'not tied to any bag, counted once in the total.')}</p>
            ) : null}
          </Card>
          <Card className="p-4">
            <p className="mb-2 font-semibold">{t('per_design')}</p>
            <Table>
              <TableHeader><TableRow><TableHead>{L('डिज़ाइन', 'Design')}</TableHead><TableHead className="text-right">{L('बैग', 'Bags')}</TableHead><TableHead className="text-right">{L('लेबर', 'Labour')}</TableHead><TableHead className="text-right">{L('खर्च', 'Expenses')}</TableHead><TableHead className="text-right">{L('कुल', 'Total')}</TableHead></TableRow></TableHeader>
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
            <div className="mb-3 flex items-center justify-between"><p className="font-semibold">{L('खर्च', 'Expenses')}</p><ExpenseDialog categories={categories} bags={bags} onDone={load} /></div>
            {expenses.length === 0 ? <p className="text-sm text-muted-foreground">{t('no_data')}</p> : (
              <ul className="space-y-2">{expenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                  <span>{e.category} {e.note ? `· ${e.note}` : ''} <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-xs">{e.bag_id ? (bagNo(e.bag_id) || L('बैग', 'bag')) : L('फैक्टरी', 'Factory')}</span><span className="ml-2 text-xs text-muted-foreground">{fmtDateTime(e.created_at)}</span></span>
                  <span className="flex items-center gap-2"><span className="font-num font-semibold">{fmtRs(e.amount)}</span><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => { await api.delete(`/expenses/${e.id}`); load(); }} data-testid={`expense-del-${e.id}`}><Trash2 className="h-4 w-4" /></Button></span>
                </li>
              ))}</ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card className="p-4">
            <p className="mb-3 font-semibold">{L('कारीगर भुगतान', 'Karigar Payments')} · {t(metal)}</p>
            <p className="mb-3 text-xs text-muted-foreground">{L('भुगतान "कारीगर" पेज से दर्ज करें। हर भुगतान उसी धातु में गिना जाता है।', 'Record payments from the Karigars page. Each payment counts only within its metal.')}</p>
            {payments.length === 0 ? <p className="text-sm text-muted-foreground">{t('no_data')}</p> : (
              <ul className="space-y-2">{payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                  <span>{karigarName(p.karigar_id)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.salary_amount > 0 ? `${L('वेतन', 'Salary')} ${fmtRs(p.salary_amount)}` : ''}
                      {p.commission_amount > 0 ? ` ${p.salary_amount > 0 ? '+' : ''} ${L('कमीशन', 'Comm')} ${fmtRs(p.commission_amount)}` : ''}
                      {p.period ? ` · ${p.period}` : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-2"><span className="font-num font-semibold">{fmtRs(p.amount)}</span><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => { await api.delete(`/payments/${p.id}`); load(); }} data-testid={`payment-del-${p.id}`}><Trash2 className="h-4 w-4" /></Button></span>
                </li>
              ))}</ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExpenseDialog({ categories, bags, onDone }) {
  const { t, L, metal, workspace } = useApp();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [bagId, setBagId] = useState('factory');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!category || !amount) { toast.error(L('श्रेणी और राशि ज़रूरी', 'Category and amount required')); return; }
    setBusy(true);
    try { await api.post('/expenses', { category, amount: Number(amount), bag_id: bagId === 'factory' ? null : bagId, note }, { params: { workspace, metal } }); toast.success(L('खर्च जुड़ा', 'Expense added')); setOpen(false); setAmount(''); setNote(''); setBagId('factory'); onDone(); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-10" data-testid="add-expense-btn"><Plus className="mr-2 h-4 w-4" />{t('add_expense')}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('add_expense')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label><BilingualLabel k="category" /></Label>
            <Select value={category} onValueChange={setCategory}><SelectTrigger data-testid="expense-category"><SelectValue placeholder={L('चुनें', 'Select')} /></SelectTrigger>
              <SelectContent>{categories.map((c, i) => <SelectItem key={i} value={c.en}>{L(c.hi, c.en)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>{L('राशि (₹)', 'Amount (₹)')}</Label><Input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11" data-testid="expense-amount" /></div>
          <div className="space-y-2"><Label>{L('किस बैग से जोड़ें', 'Attach to bag')}</Label>
            <Select value={bagId} onValueChange={setBagId}><SelectTrigger data-testid="expense-bag"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="factory">{L('फैक्टरी-स्तर (बिना बैग)', 'Factory-level (no bag)')}</SelectItem>
                {bags.map((b) => <SelectItem key={b.id} value={b.id}>{b.bag_no} · {b.design_name}</SelectItem>)}
              </SelectContent></Select></div>
          <div className="space-y-2"><Label><BilingualLabel k="note" /></Label><Input value={note} onChange={(e) => setNote(e.target.value)} className="h-11" /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy} data-testid="expense-save">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
