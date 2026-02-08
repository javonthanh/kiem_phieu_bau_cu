"use client";

import { useEffect, useState } from "react";
import "./globals.css";
import { Lock } from "lucide-react";
import { getHWID, verifyLicenseKey, checkIsActivated, setActivationStatus } from "@/lib/license";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const [hwid, setHwid] = useState("");
  const [isActivated, setIsActivated] = useState(checkIsActivated(hwid));
  const [keyInput, setKeyInput] = useState("");
  // const [load, setLoad] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 1. Khởi tạo mã máy
    const id = getHWID();
    setHwid(id);

    // 2. Kiểm tra bản quyền
    const activated = checkIsActivated(id);
    setIsActivated(activated);

    // 3. Đánh dấu đã sẵn sàng để render
    setIsReady(true);

    // 4. Đăng ký Service Worker
    // if ("serviceWorker" in navigator) {
    //   navigator.serviceWorker.register("/sw.js")
    //     .then((reg) => console.log("SW registered:", reg.scope))
    //     .catch((err) => console.error("SW failed:", err));
    // }
  }, []);

const handleActivate = () => {
  const result = verifyLicenseKey(hwid, keyInput);
  if (result.valid) {
    setActivationStatus(hwid, keyInput); 
    setIsActivated(true);
    alert("Kích hoạt thành công!");
  } else {
    alert(result.message);
  }
};



  // useEffect(() => {
  //   // Chỉ đăng ký Service Worker nếu trình duyệt hỗ trợ và đang ở môi trường Production
  //   if ("serviceWorker" in navigator) {
  //     window.addEventListener("load", () => {
  //       navigator.serviceWorker
  //         .register("/sw.js")
  //         .then((registration) => {
  //           console.log("SW registered with scope:", registration.scope);
  //         })
  //         .catch((err) => {
  //           console.error("SW registration failed:", err);
  //         });
  //     });
  //   }
  // }, []);
 if (!isReady) {
    return (
      <html lang="vi">
        <body className="bg-zinc-950 flex items-center justify-center h-screen">
           <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Đang nạp dữ liệu...</span>
           </div>
        </body>
      </html>
    );
  }
  return (
    <html lang="vi">
      <body>
        {!isActivated ? (
          /* MÀN HÌNH KHÓA TOÀN TRANG */
          <div className="fixed inset-0 z-[9999] bg-zinc-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md p-8 rounded-3xl bg-zinc-900 border border-white/5 shadow-2xl text-center relative overflow-hidden">
              {/* Hiệu ứng nền */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 blur-[100px]" />
              
              <div className="relative z-10">
                <div className="inline-flex p-4 rounded-2xl bg-red-500/10 mb-6">
                  <Lock size={40} className="text-red-500" />
                </div>
                
                <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">
                  Hệ thống đang bị khóa
                </h1>
                <p className="text-zinc-500 text-sm mb-4">
                  Vui lòng cung cấp mã bên dưới cho quản trị viên.
                </p>

                <div className="bg-black/40 rounded-xl p-2 border border-white/5 mb-6 group">
                  <code className="text-blue-400 font-mono text-lg font-bold tracking-widest select-all">
                    {hwid}
                  </code>
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nhập key mở khóa vào đây"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                  <button
                    onClick={handleActivate}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                  >
                    MỞ KHÓA
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* NẾU ĐÃ KÍCH HOẠT THÌ HIỆN NỘI DUNG TRANG WEB */
          children
        )}
      </body>
    </html>
  );
}