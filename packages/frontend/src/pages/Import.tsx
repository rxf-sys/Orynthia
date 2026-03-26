import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { accountsApi, importApi } from '@/lib/api';
import { Upload, FileText, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function ImportPage() {
  const [bankAccountId, setBankAccountId] = useState('');
  const [format, setFormat] = useState<'csv' | 'mt940'>('csv');
  const [delimiter, setDelimiter] = useState(';');
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');

  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.getAll().then(r => r.data) });

  const importMutation = useMutation({
    mutationFn: () => {
      if (format === 'csv') {
        return importApi.importCsv(bankAccountId, fileContent, delimiter);
      }
      return importApi.importMt940(bankAccountId, fileContent);
    },
    onSuccess: (res) => {
      const data = res.data as { imported: number; total: number; skipped: number };
      toast.success(`${data.imported} von ${data.total} Transaktionen importiert`);
      setFileContent('');
      setFileName('');
    },
    onError: () => toast.error('Import fehlgeschlagen'),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFileContent(ev.target?.result as string);
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Upload className="h-6 w-6 text-brand-400" /> Daten-Import
      </h1>

      <div className="card p-6 space-y-4 max-w-2xl">
        <div>
          <label className="label">Konto auswählen</label>
          <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className="input" required>
            <option value="">Konto wählen...</option>
            {accountsQuery.data?.map((a) => (
              <option key={a.id} value={a.id}>{a.accountName} ({a.bankName})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Format</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-surface-300 cursor-pointer">
              <input type="radio" checked={format === 'csv'} onChange={() => setFormat('csv')} className="text-brand-500" />
              CSV
            </label>
            <label className="flex items-center gap-2 text-surface-300 cursor-pointer">
              <input type="radio" checked={format === 'mt940'} onChange={() => setFormat('mt940')} className="text-brand-500" />
              MT940 / SWIFT
            </label>
          </div>
        </div>

        {format === 'csv' && (
          <div>
            <label className="label">Trennzeichen</label>
            <select value={delimiter} onChange={(e) => setDelimiter(e.target.value)} className="input w-32">
              <option value=";">Semikolon (;)</option>
              <option value=",">Komma (,)</option>
              <option value="\t">Tab</option>
            </select>
          </div>
        )}

        <div>
          <label className="label">Datei hochladen</label>
          <div className="border-2 border-dashed border-surface-700 rounded-xl p-8 text-center">
            <input type="file" accept=".csv,.sta,.mt940,.txt" onChange={handleFile} className="hidden" id="import-file" />
            <label htmlFor="import-file" className="cursor-pointer">
              {fileName ? (
                <div className="flex items-center justify-center gap-2 text-brand-400">
                  <FileText className="h-5 w-5" />
                  <span>{fileName}</span>
                  <CheckCircle className="h-4 w-4 text-green-400" />
                </div>
              ) : (
                <div className="text-surface-400">
                  <Upload className="h-8 w-8 mx-auto mb-2" />
                  <p>Klicke oder ziehe eine Datei hierher</p>
                  <p className="text-xs text-surface-500 mt-1">.csv, .sta, .mt940, .txt</p>
                </div>
              )}
            </label>
          </div>
        </div>

        {format === 'csv' && (
          <div className="text-xs text-surface-500 space-y-1">
            <p>Die CSV wird automatisch erkannt. Erwartete Spalten (Reihenfolge egal):</p>
            <p>Datum, Betrag, Verwendungszweck, Empfänger/Auftraggeber, IBAN</p>
            <p>Deutsche Formate (DD.MM.YYYY, 1.234,56) werden unterstützt.</p>
          </div>
        )}

        <button
          onClick={() => importMutation.mutate()}
          disabled={!bankAccountId || !fileContent || importMutation.isPending}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Importieren
        </button>
      </div>
    </div>
  );
}
