"use client";

import React, { useEffect, useState } from "react";
import {
  Settings,
  ClipboardCheck,
  BarChart3,
  ShieldCheck,
  ChevronRight,
  Landmark,
  Building2,
  Map,
  Phone,
} from "lucide-react";
import { Vote } from "lucide-react";

export default function Home() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("selected_election_slug");
    if (saved) setSelectedSlug(saved);
  }, []);

  const handleSelectElection = (type: string, slug: string) => {
    localStorage.setItem("selected_election_slug", slug);
    localStorage.setItem("selected_election_name", type);
    window.location.href = "./admin";
  };

  const electionTypes = [
    {
      name: "Đại biểu Quốc hội",
      slug: "quoc-hoi",
      icon: <Landmark className="w-8 h-8" />,
      color: "hover:border-red-500 hover:bg-red-50/50",
      iconBg: "bg-red-100 text-red-600",
    },
    {
      name: "HĐND Tỉnh/Thành phố",
      slug: "tinh",
      icon: <Building2 className="w-8 h-8" />,
      color: "hover:border-blue-500 hover:bg-blue-50/50",
      iconBg: "bg-blue-100 text-blue-600",
    },
    {
      name: "HĐND Xã/Phường",
      slug: "xa",
      icon: <Map className="w-8 h-8" />,
      color: "hover:border-emerald-500 hover:bg-emerald-50/50",
      iconBg: "bg-emerald-100 text-emerald-600",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6 py-4">
      <main className="w-full max-w-4xl text-center">
        {/* Header Section - Đã tinh chỉnh nội dung gọn hơn */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-6 p-4 bg-zinc-900 dark:bg-zinc-50 rounded-3xl text-white dark:text-zinc-900 shadow-xl">
            <Vote size={40} />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50 sm:text-6xl uppercase italic">
            Hệ thống kiểm phiếu
          </h1>
          <div className="mt-6 w-full max-w-5xl">
            <ul className="space-y-1 text-sm leading-snug text-left">
  <li className="flex items-start gap-2 rounded bg-blue-50 dark:bg-blue-950/30 px-2 py-1.5 text-blue-800 dark:text-blue-300">
    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
    <span>
      Giải pháp soi phiếu bằng camera, tích hợp AI nhận diện phiếu bầu
    </span>
  </li>

  <li className="flex items-start gap-2 rounded bg-indigo-50 dark:bg-indigo-950/30 px-2 py-1.5 text-indigo-800 dark:text-indigo-300">
    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
    <span>
      Hỗ trợ kiểm đếm nhanh và tổng hợp kết quả chính xác, xuất báo cáo theo đúng
      mẫu quy định.
    </span>
  </li>

  <li className="flex items-start gap-2 rounded bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1.5 text-emerald-800 dark:text-emerald-300">
    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
    <span>
      Hoạt động <span className="font-medium">KHÔNG kết nối Internet</span>, đảm
      bảo an toàn dữ liệu.
    </span>
  </li>

  <li className="flex items-start gap-2 rounded bg-amber-50 dark:bg-amber-950/30 px-2 py-1.5 text-amber-800 dark:text-amber-300">
    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
    <span>KHÔNG cần đầu tư thiết bị chuyên dụng.</span>
  </li>
</ul>

          </div>
        </div>

        {/* Election Type Selection */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
          {electionTypes.map((type) => (
            <button
              key={type.slug}
              onClick={() => handleSelectElection(type.name, type.slug)}
              className={`group relative flex flex-col items-center p-8 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] transition-all active:scale-95 shadow-sm ${type.color} ${selectedSlug === type.slug ? "ring-2 ring-offset-4 ring-zinc-900 border-transparent" : ""}`}
            >
              <div
                className={`mb-4 p-4 rounded-2xl transition-transform group-hover:scale-110 ${type.iconBg}`}
              >
                {type.icon}
              </div>
              <h3 className="font-black text-zinc-900 dark:text-zinc-50 uppercase text-xs tracking-wider">
                {type.name}
              </h3>
              <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight size={20} className="text-zinc-400" />
              </div>
            </button>
          ))}
        </div>

        {/* Footer - Đã tinh chỉnh gọn và đẹp hơn */}
        <footer className="mt-5 flex flex-col items-center gap-4 text-[10px] font-bold  tracking-[0.15em] text-zinc-400">
          <div className="flex flex-col items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400 text-center">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="font-medium text-zinc-800 dark:text-zinc-200 uppercase">
                Phiên bản 1.0.0 (Tích hợp AI)
              </span>
            </div>

            <div className="leading-snug max-w-3xl text-italic">
              Phiên bản này được phát triển dựa trên phiên bản AddIns Excell
              3.2.0 (đã có hơn 100 đơn vị sử dụng có hiệu quả ở kỳ bầu cử 2021)
            </div>
          </div>

          <div className="h-px w-12 bg-zinc-200 dark:bg-zinc-800" />

          <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="opacity-60">Phát triển bởi</span>
              <span className="text-zinc-900 dark:text-zinc-100">
                CÔNG TY TNHH NITSOFT VIỆT NAM
              </span>
            </div>
            <div className="hidden sm:block opacity-30">•Mã số thuế:</div>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-900 dark:text-zinc-100">
                4001135328
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="hidden sm:block opacity-30">•Liên hệ:</div>
              <span className="text-zinc-900 dark:text-zinc-100">
                0932 556 662
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
