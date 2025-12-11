'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { ArrowLeft, BarChart3, FileText, Layers, PieChart } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Stats {
  totalUploads: number;
  totalSections: number;
  typeDistribution: Record<string, number>;
}

export default function Reports() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API_URL}/stats`);
        setStats(res.data);
      } catch (error) {
        console.error('Failed to fetch stats', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-500">Loading statistics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <p className="text-gray-500">Failed to load statistics.</p>
        <Link href="/" className="text-blue-600 hover:underline">Go back home</Link>
      </div>
    );
  }

  // Calculate percentages for the distribution bars
  const totalTypes = Object.values(stats.typeDistribution).reduce((a, b) => a + b, 0);
  const sortedDistribution = Object.entries(stats.typeDistribution)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6 transition-colors">
          <ArrowLeft size={18} />
          Back to Dashboard
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Reports</h1>
          <p className="text-gray-500 mt-1">Overview of document processing statistics</p>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4 mb-2">
              <div className="bg-blue-50 p-3 rounded-lg">
                <FileText className="text-blue-600" size={24} />
              </div>
              <span className="text-gray-500 font-medium">Total Uploads</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalUploads}</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4 mb-2">
              <div className="bg-purple-50 p-3 rounded-lg">
                <Layers className="text-purple-600" size={24} />
              </div>
              <span className="text-gray-500 font-medium">Total Sections Extracted</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalSections}</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4 mb-2">
              <div className="bg-green-50 p-3 rounded-lg">
                <BarChart3 className="text-green-600" size={24} />
              </div>
              <span className="text-gray-500 font-medium">Avg Sections / Doc</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.totalUploads > 0 ? (stats.totalSections / stats.totalUploads).toFixed(1) : 0}
            </p>
          </div>
        </div>

        {/* Distribution Chart */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <PieChart size={24} className="text-gray-700" />
            Document Type Distribution
          </h2>
          
          <div className="space-y-6">
            {sortedDistribution.map(([type, count]) => {
              const percentage = totalTypes > 0 ? (count / totalTypes) * 100 : 0;
              return (
                <div key={type}>
                  <div className="flex justify-between items-end mb-2">
                    <span className="font-medium text-gray-700">{type}</span>
                    <span className="text-sm text-gray-500">{count} ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            
            {sortedDistribution.length === 0 && (
              <p className="text-gray-400 text-center py-8">No data available yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
