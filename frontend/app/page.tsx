'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, RefreshCw, BarChart3 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Document {
  documentId: string;
  status: string;
  receivedAt: string;
  splittingPlan?: string;
}

export default function Dashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/documents`);
      setDocuments(res.data);
    } catch (error) {
      console.error('Failed to fetch documents', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      // 1. Get Presigned URL
      const { data } = await axios.get(`${API_URL}/upload-url`, {
        params: { fileName: file.name },
      });

      // 2. Upload to S3
      await axios.put(data.uploadUrl, file, {
        headers: { 'Content-Type': file.type },
      });

      alert('Upload successful! Processing started.');
      setFile(null);
      // Wait a bit for EventBridge to trigger and DynamoDB to update
      setTimeout(fetchDocuments, 2000);
    } catch (error) {
      console.error('Upload failed', error);
      alert('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Document Parser</h1>
            <p className="text-gray-500 mt-1">Upload and process your medical documents</p>
          </div>
          <div className="flex gap-2">
            <Link 
              href="/reports" 
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              <BarChart3 size={18} />
              Reports
            </Link>
            <button 
              onClick={fetchDocuments} 
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors bg-white border border-gray-200 rounded-lg"
              title="Refresh"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </header>

        {/* Upload Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Upload size={20} className="text-blue-600" />
            Upload Document
          </h2>
          <div className="flex gap-4 items-center">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? <Loader2 className="animate-spin" size={18} /> : 'Upload'}
            </button>
          </div>
        </div>

        {/* Documents List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText size={20} className="text-gray-600" />
              Recent Documents
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : documents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No documents found. Upload one to get started.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <Link 
                  key={doc.documentId} 
                  href={`/documents/${encodeURIComponent(doc.documentId)}`}
                  className="block hover:bg-gray-50 transition-colors"
                >
                  <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <FileText className="text-blue-600" size={24} />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{doc.documentId}</h3>
                        <p className="text-sm text-gray-500">
                          {new Date(doc.receivedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={doc.status} />
                      <div className="text-gray-400">→</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ANALYSIS_COMPLETE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
        <CheckCircle size={12} />
        Completed
      </span>
    );
  }
  if (status === 'TEXTRACT_IN_PROGRESS') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-100">
        <Loader2 size={12} className="animate-spin" />
        Processing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
      <AlertCircle size={12} />
      {status}
    </span>
  );
}
