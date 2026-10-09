import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Shield,
  FileText,
  Hash,
  ArrowRight,
  HardDrive,
} from 'lucide-react';
import { api } from '../services/api';
import { Case } from '../types';
import { HashDisplay } from '../components/common/HashDisplay';

interface EvidenceUploadProps {
  onNavigate: (page: string, params?: any) => void;
}

export const EvidenceUpload: React.FC<EvidenceUploadProps> = ({ onNavigate }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [itemNumber, setItemNumber] = useState('');
  const [evidenceType, setEvidenceType] = useState('FORENSIC_IMAGE');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<any | null>(null);

  useEffect(() => {
    api.cases.list()
      .then((res) => {
        setCases(res.cases || []);
        if (res.cases && res.cases.length > 0) {
          setSelectedCaseId(res.cases[0].id);
          const autoItem = `ITEM-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`;
          setItemNumber(autoItem);
        }
      })
      .catch(() => {
        setCases([]);
      });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setUploadResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select an evidence file to ingest.');
      return;
    }
    if (!selectedCaseId || !itemNumber) {
      setError('Case Docket and Item ID are mandatory.');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('caseId', selectedCaseId);
    formData.append('itemNumber', itemNumber);
    formData.append('evidenceType', evidenceType);
    formData.append('notes', notes);

    try {
      const response = await api.evidence.upload(formData);
      setUploadResult(response.evidence);
    } catch (err: any) {
      setError(err.message || 'Evidence intake failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-cyan-400" />
          <h1 className="text-xl font-bold text-slate-100 font-mono">
            Staged Evidence Intake Vault
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Secure multi-stage intake. Calculates authoritative FIPS 180-4 SHA-256 over chunked raw bitstream before committing to private storage.
        </p>
      </div>

      {uploadResult ? (
        <div className="p-8 rounded-2xl bg-slate-900 border border-emerald-500/40 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-500/60 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Evidence Ingested & Genesis Block Initialized
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Bitstream committed to private storage. Initial hash anchor recorded in database.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono">
            <div>
              <span className="text-slate-500 block">Item ID:</span>
              <span className="font-bold text-cyan-300">{uploadResult.itemNumber}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Original Filename:</span>
              <span className="text-slate-200">{uploadResult.originalFilename}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Bitstream Size:</span>
              <span className="text-slate-200">
                {(uploadResult.fileSizeBytes / 1024).toFixed(2)} KB ({uploadResult.fileSizeBytes} bytes)
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Private Storage Key:</span>
              <span className="text-slate-400 truncate block">{uploadResult.storageKey}</span>
            </div>
            <div className="md:col-span-2 pt-2 border-t border-slate-800/80">
              <span className="text-slate-500 block mb-1">Authoritative Genesis SHA-256:</span>
              <HashDisplay hash={uploadResult.originalSha256} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => onNavigate('evidence-details', { id: uploadResult.id })}
              className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2"
            >
              Inspect Evidence Record
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('custody-timeline', { evidenceId: uploadResult.id })}
              className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors"
            >
              View Genesis Custody Chain
            </button>
            <button
              onClick={() => {
                setUploadResult(null);
                setFile(null);
                setItemNumber(`ITEM-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`);
              }}
              className="px-5 py-2.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors"
            >
              Ingest Another Item
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* File Dropzone */}
          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-2">
              Select or Drop Digital Evidence File
            </label>
            <div className="relative border-2 border-dashed border-slate-700 hover:border-cyan-500/80 rounded-xl p-8 text-center bg-slate-950/60 transition-colors">
              <input
                type="file"
                required
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 flex items-center justify-center">
                  <HardDrive className="w-6 h-6" />
                </div>
                {file ? (
                  <div>
                    <span className="font-semibold text-slate-200 text-sm font-mono block">
                      {file.name}
                    </span>
                    <span className="text-xs text-cyan-400 font-mono mt-0.5 block">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB ({file.size} bytes)
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs text-slate-300 font-medium block">
                      Click to browse or drag evidence file here
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">
                      Supports disk dumps (.raw, .dd, .e01), PCAPs, logs, documents, photos, video (max 100MB)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                Associated Investigation Docket *
              </label>
              <select
                required
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} — {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                Evidence Item ID *
              </label>
              <input
                type="text"
                required
                value={itemNumber}
                onChange={(e) => setItemNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
                placeholder="ITEM-2026-001"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                Evidence Category *
              </label>
              <select
                value={evidenceType}
                onChange={(e) => setEvidenceType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
              >
                <option value="FORENSIC_IMAGE">Forensic Disk / Memory Image (.raw, .dd, .e01)</option>
                <option value="NETWORK_CAPTURE">Network Packet Capture (.pcap, .pcapng)</option>
                <option value="DOCUMENT">Evidentiary Document / Report (.pdf, .txt, .csv)</option>
                <option value="IMAGE">Forensic Digital Photograph (.jpg, .png, .tiff)</option>
                <option value="VIDEO">Surveillance / Body-Worn Video (.mp4, .mov)</option>
                <option value="OTHER">Other Binary Artifact (.bin, .dat)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                Acquisition Notes & Extraction Chain
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
                placeholder="Tableau write-blocker serial, physical seizure location, etc."
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-mono">
              Never trusts client filename for filesystem storage path.
            </span>
            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2 shadow-md shadow-cyan-950"
            >
              {uploading ? 'Calculating Chunked SHA-256...' : 'Commit to Vault & Create Chain'}
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
