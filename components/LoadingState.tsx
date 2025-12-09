import React from 'react';

interface LoadingStateProps {
  message?: string;
}

const LoadingState: React.FC<LoadingStateProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 space-y-6 text-center animate-fade-in bg-gradient-to-b from-emerald-50 to-white">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 border-4 border-emerald-200 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-emerald-600 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-emerald-800">Searching the Atlas</h3>
        <p className="text-emerald-700 font-medium animate-pulse">{message || "Connecting to PubMed API..."}</p>
        <p className="text-sm text-emerald-600">Scanning for Nigerian Ethnomedicine, Botany & Pharmacology</p>
      </div>
    </div>
  );
};

export default LoadingState;