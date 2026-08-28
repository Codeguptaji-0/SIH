"use client";

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { Upload, FileText, CheckCircle2, Sparkles, AlertTriangle, ArrowRight, ScanLine } from 'lucide-react';
import Link from 'next/link';
import { apiJson, ApiError } from '@/app/lib/api';

/**
 * Learning material upload.
 *
 * The failure paths here used to be invisible. `apiFetch(...).json()` ran
 * without checking `res.ok`, and the catch block replaced any error with a
 * fabricated document ("doc-demo-99", 8 pages, 12 chunks, status READY), so a
 * rejected upload was reported to the trainer as a successful extraction.
 * Question generation did the same thing: `catch { setGenSuccess(true) }`.
 *
 * The backend now returns 413 above the 25 MB ceiling, 400 for an empty file or
 * an unsupported extension, and records a document as FAILED when no selectable
 * text could be extracted instead of inventing placeholder text. All of those
 * are surfaced.
 */

const MAX_UPLOAD_MB = 25;

interface UploadResult {
  id: string;
  title: string;
  filename: string;
  page_count: number;
  chunks_extracted: number;
  status: string;
}

interface GenerateResult {
  status: string;
  quiz_id: string;
  questions_generated: number;
  review_status: string;
}

export default function UploadMaterialsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setFile(picked);
    setUploadResult(null);
    setUploadError(null);
    setGenResult(null);
    setGenError(null);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || uploading) return;

    setUploading(true);
    setUploadError(null);
    setUploadResult(null);
    setGenResult(null);
    setGenError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadResult(
        await apiJson<UploadResult>('/api/materials/upload', { method: 'POST', body: formData })
      );
    } catch (err) {
      if (err instanceof ApiError) {
        // 413 = over the size ceiling, 400 = empty file or unsupported extension.
        // The backend's own detail string is the clearest thing to show.
        const prefix =
          err.status === 413
            ? 'File too large'
            : err.status === 400
            ? 'File rejected'
            : `Upload failed (HTTP ${err.status})`;
        setUploadError(`${prefix}: ${err.message}`);
      } else {
        setUploadError('Upload failed before it reached the server. Nothing was stored.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!uploadResult?.id || genLoading) return;
    setGenLoading(true);
    setGenError(null);
    try {
      setGenResult(
        await apiJson<GenerateResult>('/api/quizzes/generate', {
          method: 'POST',
          body: JSON.stringify({ document_id: uploadResult.id, number_of_questions: 10 })
        })
      );
    } catch (err) {
      setGenError(
        err instanceof ApiError
          ? `${err.message} (HTTP ${err.status})`
          : 'Question generation failed before it reached the server. No questions were created.'
      );
    } finally {
      setGenLoading(false);
    }
  };

  const extractionFailed =
    !!uploadResult && (uploadResult.status !== 'READY' || uploadResult.chunks_extracted === 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="TRAINER" />

      <div className="flex flex-1">
        <Sidebar role="TRAINER" />

        <main className="flex-1 p-6 sm:p-8 max-w-5xl mx-auto space-y-6 w-full">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Upload Learning Materials</h1>
            <p className="text-xs text-slate-500 mt-1">
              Upload a PDF or TXT training document to extract its text, then generate assessment
              MCQs for trainer review
            </p>
          </div>

          {/* Upload Card */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-3xl p-8 bg-slate-50 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-3">
                  <Upload className="w-7 h-7" aria-hidden="true" />
                </div>
                <label htmlFor="material-file" className="text-sm font-bold text-slate-800">
                  Select a PDF or TXT training manual
                </label>
                <p className="text-xs text-slate-400 mt-1">
                  Maximum file size {MAX_UPLOAD_MB} MB. Scanned PDFs with no selectable text cannot
                  be processed.
                </p>
                <input
                  id="material-file"
                  name="file"
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileChange}
                  className="mt-4 text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              {file && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50 p-3 rounded-xl border border-blue-200 text-xs">
                  <span className="font-semibold text-blue-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" aria-hidden="true" /> {file.name} (
                    {(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg transition-colors"
                  >
                    {uploading ? 'Uploading...' : 'Upload & Extract Text'}
                  </button>
                </div>
              )}
            </form>
          </div>

          {uploadError && (
            <div
              role="alert"
              className="bg-white p-6 rounded-2xl border border-rose-200 shadow-sm space-y-2"
            >
              <div className="flex items-center gap-2 text-rose-700">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                <h2 className="text-sm font-bold">Upload rejected</h2>
              </div>
              <p className="text-xs text-rose-800 font-mono break-words">{uploadError}</p>
              <p className="text-[11px] text-slate-500">
                Nothing was stored and no questions were generated.
              </p>
            </div>
          )}

          {uploadResult && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              {extractionFailed ? (
                <div className="flex items-start gap-3 text-amber-700">
                  <ScanLine className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Text extraction failed - no questions can be generated
                    </h2>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      No selectable text was found in this file. If it is a scanned document it must
                      be run through OCR before MCQs can be generated from it. Re-upload a
                      text-based PDF or a TXT file.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-slate-900">Text extraction completed</h2>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono break-all">
                  Document ID: {uploadResult.id}
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  Pages: {uploadResult.page_count}
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  Text chunks: {uploadResult.chunks_extracted}
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  Status:{' '}
                  <span
                    className={`font-bold ${extractionFailed ? 'text-amber-700' : 'text-emerald-700'}`}
                  >
                    {extractionFailed ? 'FAILED' : uploadResult.status}
                  </span>
                </div>
              </div>

              {/* MCQ generation - only offered when there is real extracted text to work from */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">
                      Generate multiple choice questions
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Generated questions are created with review_status PENDING and are not served
                      to officials until a trainer approves them.
                    </p>
                  </div>

                  {genResult ? (
                    <Link
                      href="/trainer/review"
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow transition-all flex items-center gap-2"
                    >
                      Review {genResult.questions_generated} pending question(s)
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGenerateQuestions}
                      disabled={genLoading || extractionFailed}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow transition-all flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                      {genLoading ? 'Generating...' : 'Generate MCQs'}
                    </button>
                  )}
                </div>

                {genResult && genResult.questions_generated === 0 && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    The request succeeded but produced no questions. Nothing has been added to the
                    review queue.
                  </p>
                )}

                {genError && (
                  <p
                    role="alert"
                    className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3 font-mono break-words"
                  >
                    Question generation failed: {genError}
                  </p>
                )}
              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
}


