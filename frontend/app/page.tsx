"use client";

import React from 'react';
import Link from 'next/link';
import { Shield, Sparkles, ArrowRight, BookOpen, Award, CheckCircle, BarChart3, AlertTriangle } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                SkillSetu <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2.5 py-0.5 rounded font-mono">SIH26101</span>
              </span>
              <span className="text-xs text-slate-400 block font-medium">Ministry of Statistics & Programme Implementation (MoSPI)</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/login" className="text-xs font-semibold text-slate-300 hover:text-white px-4 py-2 rounded-lg transition-colors">
              Official Sign In
            </Link>
            <Link href="/dashboard" className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2">
              Launch Demo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center flex-1 flex flex-col justify-center items-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-300 px-4 py-1.5 rounded-full text-xs font-mono mb-6">
          <Sparkles className="w-4 h-4 text-blue-400" /> Smart India Hackathon 2026 • Problem Statement SIH26101
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-4xl">
          SkillSetu — AI-Powered Competency Bridge for <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">Government Officials</span>
        </h1>
        
        <p className="text-lg text-slate-300 max-w-2xl mt-6 leading-relaxed">
          Identify competency gaps. Personalize learning through iGOT Karmayogi & NSSTA TPAC ecosystems. Strengthen capacity building in India’s Official Statistical System.
        </p>

        <div className="flex flex-wrap justify-center gap-4 mt-8">
          <Link href="/dashboard" className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-xl shadow-blue-600/30 transition-all text-sm flex items-center gap-2">
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/login" className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-8 py-3.5 rounded-xl border border-slate-700 transition-all text-sm">
            View Personas Demo
          </Link>
        </div>

        {/* Visual Process Flow */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 max-w-5xl w-full mt-16 text-left">
          {[
            { step: '01', title: 'Competency Profile', desc: '4 MoSPI domains mapped to designation', icon: Shield },
            { step: '02', title: 'Adaptive AI Quiz', desc: 'Auto MCQ gen from official PDFs', icon: Award },
            { step: '03', title: 'Gap Analysis', desc: 'Transparent & explainable feedback', icon: BarChart3 },
            { step: '04', title: 'Personalized Path', desc: 'iGOT Karmayogi + NSSTA recommendations', icon: BookOpen },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="bg-slate-800/60 border border-slate-700/80 p-5 rounded-2xl relative overflow-hidden group hover:border-blue-500/50 transition-all">
                <div className="text-xs font-mono font-bold text-blue-400 mb-2">{item.step}</div>
                <Icon className="w-6 h-6 text-slate-300 mb-2 group-hover:text-blue-400 transition-colors" />
                <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
                <p className="text-xs text-slate-400">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* AI Safety Disclaimer Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span>
            <strong>AI Safety Disclaimer:</strong> AI-generated assessments and recommendations are intended to support capacity building and learning personalization, subject to human-in-the-loop trainer verification.
          </span>
        </div>
      </footer>
    </div>
  );
}
