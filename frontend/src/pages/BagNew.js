import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Info } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api, apiError } from '@/lib/api';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { BilingualLabel } from '@/components/common/BilingualLabel';
import { PhotoUploader } from '@/components/common/PhotoUploader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const uuid = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const emptyForm = { design_name: '', purity: '', issued_metal_g: '', issued_stones_count: '', issued_stones_weight_g: '', karigar_id: '', notes: '' };

export default function BagNew() {
  const { t, L, metal, workspace, user } = useApp();
  const navigate = useNavigate();
  const draftKey = `fa_bag_draft:${user?.id || 'anon'}:${workspace}:${metal}`;

  const [karigars, setKarigars] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [photos, setPhotos] = useState([]);
  const [token, setToken] = useState('');
  const [newKarigar, setNewKarigar] = useState('');
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const hydrated = useRef(false);

  // Restore any draft left behind (e.g. after a session timeout redirect).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.form && (d.form.design_name || d.form.issued_metal_g || (d.photos || []).length)) {
          setForm({ ...emptyForm, ...d.form });
          setPhotos(d.photos || []);
          setToken(d.token || uuid());
          setRestored(true);
        } else { setToken(uuid()); }
      } else { setToken(uuid()); }
    } catch { setToken(uuid()); }
    hydrated.current = true;
  }, [draftKey]);

  // Persist the draft as the user types so nothing is lost if the session ends.
  useEffect(() => {
    if (!hydrated.current) return;
    const hasContent = form.design_name || form.issued_metal_g || photos.length;
    if (hasContent) localStorage.setItem(draftKey, JSON.stringify({ form, photos, token }));
  }, [form, photos, token, draftKey]);

  const loadKarigars = useCallback(async () => {
    try { const { data } = await api.get('/karigars', { params: { workspace, metal } }); setKarigars(data || []); } catch { /* */ }
  }, [workspace, metal]);
  useEffect(() => { loadKarigars(); }, [loadKarigars]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const clearDraft = () => { localStorage.removeItem(draftKey); setForm(emptyForm); setPhotos([]); setToken(uuid()); setRestored(false); };

  const addKarigar = async () => {
    if (!newKarigar.trim()) return;
    try {
      const { data } = await api.post('/karigars', { name: newKarigar.trim() }, { params: { workspace, metal } });
      setNewKarigar('');
      await loadKarigars();
      set('karigar_id', data.id);
      toast.success(L('कारीगर जुड़ा', 'Karigar added'));
    } catch (e) { toast.error(apiError(e)); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.design_name.trim() || !form.purity.trim() || !form.issued_metal_g) { toast.error(L('डिज़ाइन, शुद्धता और धातु ज़रूरी', 'Design, purity and metal are required')); return; }
    setBusy(true);
    try {
      const body = {
        metal,
        purity: form.purity.trim(),
        design_name: form.design_name.trim(),
        photos,
        issued_metal_g: Number(form.issued_metal_g),
        issued_stones_count: Number(form.issued_stones_count || 0),
        issued_stones_weight_g: Number(form.issued_stones_weight_g || 0),
        karigar_id: form.karigar_id || null,
        notes: form.notes,
        client_token: token, // same token on retry => at most one bag
      };
      const { data } = await api.post('/bags', body, { params: { workspace } });
      localStorage.removeItem(draftKey);
      toast.success(L('बैग खुल गया', 'Bag opened'));
      navigate(`/bags/${data.id}`);
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6" data-testid="bag-new-page">
      <PageHeader title={t('new_bag')} subtitle={`${t(metal)} · ${t(workspace)}`}
        actions={<Button variant="outline" onClick={() => navigate('/bags')} className="h-11"><ArrowLeft className="mr-2 h-4 w-4" />{t('back')}</Button>} />

      {restored ? (
        <Card className="flex flex-wrap items-center justify-between gap-2 border-[hsl(var(--info))]/40 bg-[hsl(var(--info))]/10 p-3" data-testid="draft-restored-banner">
          <span className="flex items-center gap-2 text-sm"><Info className="h-4 w-4 text-[hsl(var(--info))]" />{L('पहले भरा अधूरा फ़ॉर्म वापस लाया गया।', 'Restored your unsaved draft.')}</span>
          <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={clearDraft} data-testid="draft-clear">{L('हटाएं', 'Discard')}</Button>
        </Card>
      ) : null}

      <form onSubmit={submit} className="space-y-6">
        <Card className="p-5">
          <p className="mb-3 font-semibold">{L('डिज़ाइन फोटो', 'Design Photos')}</p>
          <PhotoUploader value={photos} onChange={setPhotos} testId="bag-photos" />
        </Card>

        <Card className="grid gap-5 p-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label><BilingualLabel k="design_name" /></Label>
            <Input value={form.design_name} onChange={(e) => set('design_name', e.target.value)} className="h-11" placeholder={L('जैसे झुमका', 'e.g. Jhumka')} data-testid="bag-design" />
          </div>
          <div className="space-y-2">
            <Label><BilingualLabel k="purity" /></Label>
            <Input value={form.purity} onChange={(e) => set('purity', e.target.value)} className="h-11" placeholder={metal === 'gold' ? '22K' : '92.5'} data-testid="bag-purity" />
          </div>
          <div className="space-y-2">
            <Label><BilingualLabel k="metal_issued" en="Metal Issued (g)" /></Label>
            <Input type="number" step="any" value={form.issued_metal_g} onChange={(e) => set('issued_metal_g', e.target.value)} className="h-11" data-testid="bag-metal" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label><BilingualLabel k="stones_count" /></Label>
              <Input type="number" step="any" value={form.issued_stones_count} onChange={(e) => set('issued_stones_count', e.target.value)} className="h-11" data-testid="bag-stones-count" />
            </div>
            <div className="space-y-2">
              <Label><BilingualLabel k="stones_weight" en="Stones (g)" /></Label>
              <Input type="number" step="any" value={form.issued_stones_weight_g} onChange={(e) => set('issued_stones_weight_g', e.target.value)} className="h-11" data-testid="bag-stones-weight" />
            </div>
          </div>
          <div className="space-y-2">
            <Label><BilingualLabel k="karigar" /></Label>
            <div className="flex gap-2">
              <Select value={form.karigar_id} onValueChange={(v) => set('karigar_id', v)}>
                <SelectTrigger className="h-11" data-testid="bag-karigar"><SelectValue placeholder={L('चुनें', 'Select')} /></SelectTrigger>
                <SelectContent>{karigars.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Input value={newKarigar} onChange={(e) => setNewKarigar(e.target.value)} placeholder={L('नया कारीगर', 'New karigar')} className="h-10" data-testid="bag-new-karigar" />
              <Button type="button" variant="outline" className="h-10" onClick={addKarigar} data-testid="bag-add-karigar"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label><BilingualLabel k="note" /></Label>
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} data-testid="bag-notes" />
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/bags')} className="h-11">{t('cancel')}</Button>
          <Button type="submit" className="h-11 px-8" disabled={busy} data-testid="bag-submit">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t('save')}</Button>
        </div>
      </form>
    </div>
  );
}
