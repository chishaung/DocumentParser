'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Layers, Database, Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface SplittingPlanItem {
  section_name: string;
  start_page: number;
  end_page: number;
  summary: string;
}

interface Document {
  documentId: string;
  status: string;
  receivedAt: string;
  splittingPlan?: string;
  extractedData?: string;
  documentType?: string;
}

interface DocumentDetail {
  parent: Document;
  children: Document[];
}

export default function DocumentDetail() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!params.id) return;
      try {
        const res = await axios.get(`${API_URL}/documents/${params.id}`);
        setData(res.data);
      } catch (error) {
        console.error('Failed to fetch document detail', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <p className="text-gray-500">Document not found.</p>
        <Link href="/" className="text-blue-600 hover:underline">Go back home</Link>
      </div>
    );
  }

  const splittingPlan = data.parent.splittingPlan 
    ? JSON.parse(data.parent.splittingPlan).splitting_plan as SplittingPlanItem[]
    : [];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6 transition-colors">
          <ArrowLeft size={18} />
          Back to Dashboard
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 break-all">{data.parent.documentId}</h1>
          <p className="text-gray-500 mt-2 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
              {data.parent.status}
            </span>
            <span>•</span>
            <span>Uploaded on {new Date(data.parent.receivedAt).toLocaleString()}</span>
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Splitting Plan */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Layers size={20} className="text-purple-600" />
                Structure Analysis
              </h2>
              <div className="space-y-4">
                {splittingPlan.map((section, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-900">{section.section_name}</h3>
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                        Pg {section.start_page}-{section.end_page}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{section.summary}</p>
                  </div>
                ))}
                {splittingPlan.length === 0 && (
                  <p className="text-gray-400 text-sm italic">No structure analysis available yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Extracted Data */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Database size={24} className="text-blue-600" />
              Extracted Data
            </h2>
            
            {data.children.length === 0 ? (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
                No extracted data available yet. The document might still be processing.
              </div>
            ) : (
              data.children.map((child) => {
                let extractedData = {};
                try {
                  extractedData = child.extractedData ? JSON.parse(child.extractedData) : {};
                } catch (e) {
                  extractedData = { error: "Failed to parse JSON" };
                }

                return (
                  <div key={child.documentId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <FileText size={18} className="text-gray-500" />
                        {child.documentType || 'Unknown Section'}
                      </h3>
                      <span className="text-xs text-gray-400 font-mono">{child.documentId.split('/').pop()}</span>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(extractedData).map(([key, value]) => (
                          <div key={key} className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider block mb-1">
                              {key.replace(/_/g, ' ')}
                            </span>
                            <span className="text-gray-900 font-medium break-words">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
