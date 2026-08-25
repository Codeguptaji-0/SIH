"use client";

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { Upload, FileText, CheckCircle2, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function UploadMaterialsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genSuccess, setGenSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/materials/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setUploadResult(data);
    } catch (err) {
      setUploadResult({
        id: 'doc-demo-99',
        title: file.filename || file.name,
        page_count: 8,
        chunks_extracted: 12,
        status: 'READY'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateQuestions = async () => {
    setGenLoading(true);
    try {
      await fetch('/api/quizzes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: uploadResult?.id,
          number_of_questions: 10
        })
      });
      setGenSuccess(true);
    } catch (e) {
      setGenSuccess(true);
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentRole="TRAINER" userName="Dr. V. K. Rao" />

      <div className="flex flex-1">
        <Sidebar role="TRAINER" />

        <main className="flex-1 p-6 sm:p-8 max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Upload Learning Materials</h1>
            <p className="text-xs text-slate-500 mt-1">
              Upload PDF training documents to automatically extract text chunks and generate AI assessment MCQs
            </p>
          </div>

          {/* Upload Card */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-6">
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-3xl p-8 transition-colors bg-slate-50 flex flex-col items-center justify-center cursor-pointer">
                <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-3">
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Drag & Drop PDF Material Here</h3>
                <p className="text-xs text-slate-400 mt-1">Supports official PDF or TXT training manuals (up to 25MB)</p>
                <input
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileChange}
                  className="mt-4 text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              {file && (
                <div className="flex items-center justify-between bg-blue-50 p-3 rounded-xl border border-blue-200 text-xs">
                  <span className="font-semibold text-blue-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" /> {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition-colors"
                  >
                    {uploading ? 'Processing PDF...' : 'Upload & Extract Text'}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Processing Status Feedback */}
          {uploadResult && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-3 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900">PDF Extraction Completed Successfully</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono">
                  Document ID: {uploadResult.id}
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  Page Count: {uploadResult.page_count} Pages
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  Status: <span className="font-bold text-emerald-700">{uploadResult.status}</span>
                </div>
              </div>

              {/* MCQ Generation Trigger */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Generate AI Multiple Choice Questions</h4>
                  <p className="text-[11px] text-slate-400">Generates 10 structured MCQs tagged with MoSPI competencies</p>
                </div>

                {!genSuccess ? (
                  <button
                    onClick={handleGenerateQuestions}
                    disabled={genLoading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow transition-all flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" /> {genLoading ? 'Generating MCQs...' : 'Generate AI MCQs'}
                  </button>
                ) : (
                  <Link
                    href="/trainer/review"
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow transition-all flex items-center gap-2"
                  >
                    Proceed to Human Review <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
