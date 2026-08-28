"use client";

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
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
    <div className="flex min-h-screen flex-col bg-paper">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar role="TRAINER" />

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 md:px-8">
          <header className="border-b-2 border-ink pb-6">
            <p className="eyebrow">Trainer tools / learning materials</p>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tightest text-ink">
              Upload learning materials
            </h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500">
              Upload a PDF or TXT training document to extract its text, then generate assessment
              MCQs for trainer review.
            </p>
          </header>

          <div className="mt-8 space-y-8">

          <section>
            <div className="border-b border-ink pb-2.5">
              <p className="eyebrow">Source document</p>
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">
                Text is extracted from the file itself, so a scanned PDF with no selectable text
                cannot be processed.
              </p>
            </div>

            <form onSubmit={handleUpload} className="mt-4 space-y-4">
              <div className="border border-dashed border-rule-strong bg-paper-sunken px-5 py-6">
                <label htmlFor="material-file" className="eyebrow">
                  Select a PDF or TXT training manual
                </label>
                <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-500">
                  Maximum file size {MAX_UPLOAD_MB} MB. Scanned PDFs with no selectable text cannot
                  be processed.
                </p>
                <input
                  id="material-file"
                  name="file"
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileChange}
                  className="mt-4 block w-full cursor-pointer text-xs text-slate-600 file:mr-4 file:border file:border-rule-strong file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium file:text-ink"
                />
              </div>

              {file && (
                <div className="flex flex-wrap items-center justify-between gap-3 border border-rule bg-white px-4 py-3.5">
                  <p className="min-w-0 text-xs text-ink">
                    <span className="break-all font-mono text-[11px]">{file.name}</span>{' '}
                    <span className="text-slate-500 tnum">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </p>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="inline-flex h-11 shrink-0 items-center gap-2 border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700 disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Uploading
                      </>
                    ) : (
                      'Upload and extract text'
                    )}
                  </button>
                </div>
              )}
            </form>
          </section>

          {uploadError && (
            <div
              role="alert"
              className="flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3.5"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gap-600" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-ink">Upload rejected</h2>
                <p className="mt-1 break-words font-mono text-[11px] text-gap-700">{uploadError}</p>
                <p className="mt-1.5 text-xs text-gap-700">
                  Nothing was stored and no questions were generated.
                </p>
              </div>
            </div>
          )}

          {uploadResult && (
            <section className="border border-rule bg-white">
              <div className="border-b border-rule px-5 py-4">
                <p className="eyebrow">Extraction result</p>
                {extractionFailed ? (
                  <>
                    <h2 className="mt-2 font-display text-lg font-semibold tracking-tightest text-ink">
                      Text extraction failed - no questions can be generated
                    </h2>
                    <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-watch-700">
                      No selectable text was found in this file. If it is a scanned document it must
                      be run through OCR before MCQs can be generated from it. Re-upload a
                      text-based PDF or a TXT file.
                    </p>
                  </>
                ) : (
                  <h2 className="mt-2 font-display text-lg font-semibold tracking-tightest text-ink">
                    Text extraction completed
                  </h2>
                )}
              </div>

              <dl className="m-0 grid grid-cols-1 gap-px bg-rule sm:grid-cols-3">
                <div className="bg-white px-5 py-4">
                  <dt className="eyebrow">Pages</dt>
                  <dd className="m-0 mt-1.5 font-display text-3xl font-semibold text-ink tnum">
                    {uploadResult.page_count}
                  </dd>
                </div>
                <div className="bg-white px-5 py-4">
                  <dt className="eyebrow">Text chunks</dt>
                  <dd className="m-0 mt-1.5 font-display text-3xl font-semibold text-ink tnum">
                    {uploadResult.chunks_extracted}
                  </dd>
                </div>
                <div className="bg-white px-5 py-4">
                  <dt className="eyebrow">Status</dt>
                  <dd className="m-0 mt-2.5">
                    <span
                      className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow ${
                        extractionFailed
                          ? 'border-watch-200 bg-watch-50 text-watch-700'
                          : 'border-strong-200 bg-strong-50 text-strong-700'
                      }`}
                    >
                      {extractionFailed ? 'FAILED' : uploadResult.status}
                    </span>
                  </dd>
                </div>
              </dl>

              <div className="border-t border-rule px-5 py-3.5">
                <p className="eyebrow">Document ID</p>
                <p className="mt-1 break-all font-mono text-[11px] text-ink">{uploadResult.id}</p>
              </div>

              {/* MCQ generation - only offered when there is real extracted text to work from */}
              <div className="border-t border-rule px-5 py-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow">Question generation</p>
                    <h3 className="mt-2 text-sm font-medium text-ink">
                      Generate multiple choice questions
                    </h3>
                    <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-slate-500">
                      Generated questions are created with review_status PENDING and are not served
                      to officials until a trainer approves them.
                    </p>
                  </div>

                  {genResult ? (
                    <Link
                      href="/trainer/review"
                      className="inline-flex h-11 shrink-0 items-center gap-2 border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700"
                    >
                      Review {genResult.questions_generated} pending question(s)
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGenerateQuestions}
                      disabled={genLoading || extractionFailed}
                      className="inline-flex h-11 shrink-0 items-center gap-2 border border-navy-600 bg-navy-600 px-5 text-sm font-medium text-paper transition-colors hover:bg-navy-700 disabled:opacity-50"
                    >
                      {genLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Generating
                        </>
                      ) : (
                        'Generate MCQs'
                      )}
                    </button>
                  )}
                </div>

                {genResult && genResult.questions_generated === 0 && (
                  <p className="mt-3 border-l-2 border-rule-strong bg-paper-sunken px-4 py-3 text-xs leading-relaxed text-slate-500">
                    The request succeeded but produced no questions. Nothing has been added to the
                    review queue.
                  </p>
                )}

                {genError && (
                  <div
                    role="alert"
                    className="mt-3 flex items-start gap-3 border-l-2 border-gap-600 bg-gap-50 px-4 py-3.5"
                  >
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0 text-gap-600"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-ink">Question generation failed</h4>
                      <p className="mt-1 break-words font-mono text-[11px] text-gap-700">
                        {genError}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          </div>
        </main>
      </div>
    </div>
  );
}


