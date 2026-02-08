"use client";
import { db, decrypt } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function DetailedStatistics() {
  const votes = useLiveQuery(() => db.votes.toArray());
  const candidates = useLiveQuery(() => db.candidates.toArray());
if (!votes || !candidates) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-lg font-medium text-gray-600">
          Đang tính toán dữ liệu...
        </div>
        <Link prefetch={false}
          href="/admin"
          className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm border border-zinc-200 rounded-xl shadow-md font-bold text-sm text-black hover:bg-white transition-all active:scale-95"
        >
          <ArrowLeft size={16} />
          {/* <span className="uppercase">Quay lại quản trị</span> */}
        </Link>
      </div>
    );
  }

  // 1. Thống kê tổng hợp (Số phiếu mỗi người)
  const candidateStats = candidates.map(c => ({
    name: c.name,
    count: votes.filter(v => v.candidateIds.includes(c.id!)).length
  }));

  // 2. Thống kê theo nhóm (Bầu 1, Bầu 2, Bầu 3...)
  const groupStats: Record<number, number> = {};
  votes.forEach(v => {
    const numSelected = v.candidateIds.length;
    groupStats[numSelected] = (groupStats[numSelected] || 0) + 1;
  });

  return (
    <div className="space-y-8 p-6 bg-gray-50 rounded-xl">
      <section>
        <h3 className="text-xl font-bold mb-4 text-blue-800">1. Thống kê theo nhóm phiếu</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(groupStats).map(([num, count]) => (
            <div key={num} className="bg-white p-4 rounded shadow border-l-4 border-blue-500">
              <p className="text-sm text-gray-500">Phiếu bầu {num} người</p>
              <p className="text-2xl font-bold">{count} phiếu</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xl font-bold mb-4 text-green-800">2. Kết quả tổng hợp ứng cử viên</h3>
        <div className="bg-white overflow-hidden rounded-lg shadow">
          <table className="w-full text-left">
            <thead className="bg-green-600 text-white">
              <tr>
                <th className="p-3">Họ và tên</th>
                <th className="p-3">Số phiếu đồng ý</th>
                <th className="p-3">Tỷ lệ (%)</th>
              </tr>
            </thead>
            <tbody>
              {candidateStats.map((s, i) => (
                <tr key={i} className="border-b hover:bg-green-50">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3">{s.count}</td>
                  <td className="p-3 text-sm text-gray-600">
                    {((s.count / votes.length) * 100 || 0).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}