"use client";

import React, { useMemo } from 'react';
import { db, decrypt } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3, ArrowLeft, CheckCircle, Calculator, Settings, AlertTriangle, Users, FileStack, ClipboardCheck, Vote, FileText } from 'lucide-react';
import Link from 'next/link';

export default function DetailedStatsPage() {
  const config = useLiveQuery(() => db.config.toCollection().first());
  const candidates = useLiveQuery(() => db.candidates.toArray());
  const votes = useLiveQuery(() => db.votes.toArray());

  const reportData = useMemo(() => {
    if (!config || !candidates || !votes) return null;

    const totalSeats = config.seats || 1;
    const totalCandidatesCount = candidates.length;
    const totalValidVotesCount = votes.length; 

    // --- BỔ SUNG: KIỂM TRA TÍNH TOÀN VẸN THÔNG SỐ ---
    const integrity = {
      voters: (config.actualVoters || 0) <= (config.totalVoters || 0) && (config.actualVoters > 0),
      votesFlow: (config.receivedVotes || 0) <= (config.issuedVotes || 0) && (config.receivedVotes > 0),
      logic: (config.validVotes || 0) + (config.invalidVotes || 0) === (config.receivedVotes || 0),
      dbMatch: (config.validVotes || 0) === totalValidVotesCount,
      dbMatchCheck: totalValidVotesCount - config.validVotes === 0,
      balanceCheck: config.validVotes === config.receivedVotes,
      voteFlowCheck: config.issuedVotes === config.receivedVotes
    };
    
    // 1. Khởi tạo ma trận động (Giữ nguyên)
    const statsMatrix: Record<number, Record<number, number>> = {};
    candidates.forEach(c => {
      statsMatrix[c.id!] = {};
      for (let i = 1; i <= totalSeats; i++) statsMatrix[c.id!][i] = 0;
    });

    // 2. Phân loại phiếu (Giữ nguyên)
    votes.forEach(v => {
      try {
        const selectedIds: number[] = decrypt(v.candidateIds as any);
        const groupSize = selectedIds.length;
        if (groupSize > 0 && groupSize <= totalSeats) {
          selectedIds.forEach(id => {
            if (statsMatrix[id]) statsMatrix[id][groupSize]++;
          });
        }
      } catch (e) { console.error(e); }
    });

    // 3. Tính toán các hàng tổng (Giữ nguyên)
    const groupStats = Array.from({ length: totalSeats }, (_, i) => {
      const gSize = i + 1;
      const actualVotesInGroup = candidates.reduce((sum, c) => sum + statsMatrix[c.id!][gSize], 0);
      const groupVoteCount = gSize > 0 ? actualVotesInGroup / gSize : 0;
      const missingVotesInGroup = (groupVoteCount * totalCandidatesCount) - actualVotesInGroup;
      const totalWithMissing = actualVotesInGroup + missingVotesInGroup;

      return { gSize, groupVoteCount, actualVotes: actualVotesInGroup, missingVotes: missingVotesInGroup, totalWithMissing };
    });

    const grandTotalVotesPlusMissing = groupStats.reduce((sum, g) => sum + g.totalWithMissing, 0);
    const checkValue = totalCandidatesCount * totalValidVotesCount;
    const isMatched = Math.round(grandTotalVotesPlusMissing) === Math.round(checkValue);

    return {
      statsMatrix, groupStats, totalValidVotesCount, totalCandidatesCount,
      grandTotalVotesPlusMissing, checkValue, isMatched, integrity
    };
  }, [config, candidates, votes]);

  if (!config || !candidates || !reportData) return <div className="p-10 text-center font-black uppercase">Đang đối soát...</div>;

  return (
    <div className="p-4 md:p-8 max-w-[98vw] mx-auto space-y-6 bg-white min-h-screen text-zinc-900">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="p-2 hover:bg-zinc-100 rounded-full transition-colors"><ArrowLeft size={24} /></Link>
          <h1 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <Calculator className="text-blue-600" /> Chi tiết số liệu
          </h1>
        </div>
      </div>

      {/* BỔ SUNG: HÀNG THẺ KIỂM TRA THÔNG SỐ (TOP CARDS) */}
<div className="grid grid-cols-1 md:grid-cols-5 gap-4">
  {/* Cử tri */}
  <div className="bg-white p-4 rounded-2xl border shadow-sm">
    <div className="flex justify-between items-start mb-2">
      <Users className="text-zinc-400" size={20} />
      <div className="flex flex-col items-end">
        {reportData.integrity.voterCheck ? <CheckCircle size={16} className="text-green-500" /> : <AlertTriangle size={16} className="text-red-500 animate-bounce" />}
        <span className="text-2xl font-black text-zinc-900 mt-1">
          {config.totalVoters > 0 ? ((config.actualVoters / config.totalVoters) * 100).toFixed(2) : "0.00"}%
        </span>
      </div>
    </div>
    <p className="text-[10px] font-black text-zinc-400 uppercase">Cử tri đi bầu / Tổng số cử tri</p>
    <p className="text-xl font-black text-zinc-800">{config.actualVoters} / {config.totalVoters}</p>
    <div className="w-full bg-zinc-100 h-1.5 rounded-full mt-2 overflow-hidden">
      <div className="bg-zinc-800 h-full" style={{ width: `${(config.actualVoters / config.totalVoters) * 100}%` }}></div>
    </div>
  </div>

  {/* Thu vào / Phát ra */}
  <div className="bg-white p-4 rounded-2xl border shadow-sm">
    <div className="flex justify-between items-start mb-2">
      <FileText className="text-zinc-400" size={20} />
      <div className="flex flex-col items-end">
        {reportData.integrity.voteFlowCheck ? <CheckCircle size={16} className="text-green-500" /> : <AlertTriangle size={16} className="text-red-500 animate-bounce" />}
        <span className="text-2xl font-black text-zinc-900 mt-1">
          {config.issuedVotes > 0 ? ((config.receivedVotes / config.issuedVotes) * 100).toFixed(2) : "0.00"}%
        </span>
      </div>
    </div>
    <p className="text-[10px] font-black text-zinc-400 uppercase">Thu vào / Phát ra</p>
    <p className="text-xl font-black text-zinc-800">{config.receivedVotes} / {config.issuedVotes}</p>
    <p className="text-[9px] text-zinc-500 font-medium mt-1">Thất thoát: {config.issuedVotes - config.receivedVotes} phiếu</p>
  </div>

  {/* Cân bằng phiếu */}
  <div className="bg-white p-4 rounded-2xl border shadow-sm">
    <div className="flex justify-between items-start mb-2">
      <Vote className="text-zinc-400" size={20} />
      <div className="flex flex-col items-end">
        {reportData.integrity.balanceCheck ? <CheckCircle size={16} className="text-green-500" /> : <AlertTriangle size={16} className="text-red-500 animate-bounce" />}
        <span className="text-2xl font-black text-zinc-900 mt-1">
          {config.receivedVotes > 0 ? ((config.validVotes / config.receivedVotes) * 100).toFixed(2) : "0.00"}%
        </span>
      </div>
    </div>
    <p className="text-[10px] font-black text-zinc-400 uppercase">Hợp lệ / Thu vào</p>
    <p className="text-xl font-black text-zinc-800">{config.validVotes} / {config.receivedVotes}</p>
   
  </div>
   <div className="bg-white p-4 rounded-2xl border shadow-sm">
    <div className="flex justify-between items-start mb-2">
      <Vote className="text-zinc-400" size={20} />
      <div className="flex flex-col items-end">
        {reportData.integrity.balanceCheck ? <CheckCircle size={16} className="text-green-500" /> : <AlertTriangle size={16} className="text-red-500 animate-bounce" />}
        <span className="text-2xl font-black text-zinc-900 mt-1">
          {config.receivedVotes > 0 ? ((config.invalidVotes / config.receivedVotes) * 100).toFixed(2) : "0.00"}%
        </span>
      </div>
    </div>
    <p className="text-[10px] font-black text-zinc-400 uppercase">Không hợp lệ / Thu vào</p>
    <p className="text-xl font-black text-zinc-800">{config.invalidVotes} / {config.receivedVotes}</p>
    
  </div>

  {/* Khớp Database */}
  <div className={`p-4 rounded-2xl border shadow-sm transition-all ${reportData.integrity.dbMatchCheck ? 'bg-green-100' : 'bg-red-50 border-red-200'}`}>
    <div className="flex justify-between items-start mb-2">
      <Calculator className={reportData.integrity.dbMatchCheck ? "text-zinc-400" : "text-red-500"} size={20} />
      <div className="flex flex-col items-end">
        {reportData.integrity.dbMatchCheck ? <CheckCircle size={16} className="text-green-500" /> : <AlertTriangle size={16} className="text-red-500 animate-pulse" />}
        <span className={`text-2xl font-black mt-1 ${reportData.integrity.dbMatchCheck ? 'text-zinc-900' : 'text-red-600'}`}>
          {config.validVotes > 0 ? ((reportData.totalValidVotesCount / config.validVotes) * 100).toFixed(2) : "0.00"}%
        </span>
      </div>
    </div>
    <p className="text-[10px] font-black text-zinc-400 uppercase">Đã kiểm / Phiếu hợp lệ</p>
    <p className={`text-xl font-black ${reportData.integrity.dbMatchCheck ? 'text-zinc-800' : 'text-red-600'}`}>{reportData.totalValidVotesCount} / {config.validVotes}</p>
    <p className="text-[9px] text-zinc-500 font-medium mt-1">{reportData.integrity.dbMatchCheck ? 'Số liệu kiểm phiếu khớp với số phiếu hợp lệ':'Có lỗi cần kiểm tra lại'} </p>
  </div>
</div>


      {/* Dynamic Table (Giữ nguyên biểu mẫu của bạn) */}
      <div className="overflow-x-auto border rounded-xl shadow-sm">
        <table className="w-full text-sm border-collapse text-center">
          <thead className="bg-zinc-100 text-zinc-600 uppercase text-[11px] font-bold">
            <tr>
              <th className="p-3 text-left border-r sticky left-0 bg-zinc-100 z-10 w-56">Danh sách ứng cử viên</th>
              {reportData.groupStats.map(g => (
                <th key={g.gSize} className="p-3 border-r min-w-[100px]">PBầu {g.gSize}</th>
              ))}
              <th className="p-3 border-r bg-blue-50 text-blue-700">Tổng lượt bầu</th>
              <th className="p-3 bg-orange-50 text-orange-700 w-24">Tỉ lệ (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {candidates.map((c) => {
              const totalCandiVotes = reportData.groupStats.reduce((sum, g) => sum + reportData.statsMatrix[c.id!][g.gSize], 0);
              return (
                <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="p-3 text-left font-bold border-r sticky left-0 bg-white z-10">{c.name}</td>
                  {reportData.groupStats.map(g => (
                    <td key={g.gSize} className="p-3 border-r">{reportData.statsMatrix[c.id!][g.gSize]}</td>
                  ))}
                  <td className="p-3 border-r font-black bg-blue-50/20">{totalCandiVotes}</td>
                  <td className="p-3 font-black text-red-600 bg-orange-50/20">
                    {reportData.totalValidVotesCount > 0 ? ((totalCandiVotes / reportData.totalValidVotesCount) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              );
            })}

            {/* HÀNG TỔNG LƯỢT BẦU (Dòng 10) */}
            <tr className="bg-zinc-50 font-bold text-red-600">
              <td className="p-3 text-left border-r sticky left-0 bg-zinc-50">Tổng lượt bầu</td>
              {reportData.groupStats.map(g => <td key={g.gSize} className="p-3 border-r">{g.actualVotes}</td>)}
              <td className="p-3 border-r bg-blue-100">{reportData.groupStats.reduce((s, g) => s + g.actualVotes, 0)}</td>
              <td className="bg-orange-50/30"></td>
            </tr>

            {/* HÀNG THIẾU (Dòng 11) */}
            <tr className="bg-green-400/20 font-bold text-green-800">
  <td className="p-3 text-left border-r sticky left-0 bg-green-50">
    <div className="text-sm">Thiếu</div>
    <div className="text-[10px] font-medium leading-tight text-green-700">
      (Tổng lượt bầu / Số bầu) × (Số ƯV - Số bầu)
    </div>
  </td>
  {reportData.groupStats.map(g => (
    <td key={g.gSize} className="p-3 border-r">
      {Math.round(g.missingVotes)}
    </td>
  ))}
  <td className="p-3 border-r">
    {Math.round(reportData.groupStats.reduce((s, g) => s + g.missingVotes, 0))}
  </td>
  <td className="bg-orange-50/30"></td>
</tr>
            {/* HÀNG TỔNG LƯỢT BẦU + THIẾU (Dòng 12) */}
            <tr className="bg-yellow-300/40 font-bold text-zinc-800">
              <td className="p-3 text-left border-r sticky left-0 bg-yellow-50 text-[11px]">Tổng lượt bầu + thiếu</td>
              {reportData.groupStats.map(g => <td key={g.gSize} className="p-3 border-r">{Math.round(g.totalWithMissing)}</td>)}
              <td className="p-3 border-r bg-yellow-200">{Math.round(reportData.grandTotalVotesPlusMissing)}</td>
              <td className="bg-orange-50/30"></td>
            </tr>

            {/* HÀNG TỔNG SỐ PHIẾU (Dòng 13) */}
            <tr className="bg-yellow-400 font-black text-red-700">
              <td className="p-3 text-left border-r sticky left-0 bg-yellow-400">Tổng số phiếu</td>
              {reportData.groupStats.map(g => <td key={g.gSize} className="p-3 border-r">{Math.round(g.groupVoteCount)}</td>)}
              <td className="p-3 border-r">{reportData.totalValidVotesCount}</td>
              <td className=""></td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}