"use client";
import React, { useState, useEffect, useRef } from "react";
import { db, decrypt, getConfig } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { exportElectionReport } from "@/lib/exportWord";
import { exportReportWordKPQH,exportReportWordXDKQQH,exportReportWordKPTinh,exportReportWordXDKQTinh,exportReportWordKPXa, exportReportWordXDKQXa } from "@/lib/exportWordTemplate";
import Link from "next/link";
import {
  Users,
  Settings,
  Plus,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  ChevronRight,
  Table as TableIcon,
  ArrowLeft,
  ClipboardCheck,
  Trophy,
  HomeIcon,
  RefreshCcw,
  X,
  Edit3,
  Check,
  Upload,
  FileText,
  ArrowRight,
} from "lucide-react";
import { exportVotesToExcel } from "@/lib/exportExcel";

declare global {
  interface Window {
    electronAPI: {
      getMachineId: () => string;
      saveDataBackup: (data: any) => void;
      restoreData: () => Promise<any>; // Thêm dòng này cho hàm restore
    };
  }
}

export default function AdminPage() {
  const config = useLiveQuery(() => db.config.toCollection().first());
  const candidates = useLiveQuery(() => db.candidates.toArray());
  const votes = useLiveQuery(() => db.votes.toArray());
  const inputRef = useRef<HTMLInputElement>(null);
  const isLocked = (votes?.length || 0) > 0;
  const [newName, setNewName] = useState("");
  const [defaultElectionType, setDefaultElectionType] =
    useState<string>("Quốc hội");
   const [defaultElectionSlug, setDefaultElectionSlug] =
    useState<string>("quoc-hoi");

  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [requiredPin, setRequiredPin] = useState<string>("");

  // State mới cho việc sửa ứng viên
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const REPORT_TEMPLATES_QH = [
  {
    name: "mau18-bb-kiemphieu-qh",
    subtitle: "Mẫu 18",
    title: "BIÊN BẢN KẾT QUẢ KIỂM PHIẾU BẦU CỬ ĐẠI BIỂU QUỐC HỘI",
    action: exportReportWordKPQH, // Hàm bạn đã viết
  },
  {
    name: "mau19-xd-kq-qh",
    subtitle: "Mẫu 19",
    title: "BIÊN BẢN XÁC ĐỊNH KẾT QUẢ BẦU CỬ ĐẠI BIỂU QUỐC HỘI",
    action: exportReportWordXDKQQH, 
  }
]
  const REPORT_TEMPLATES_TINH = [
  {
    name: "mau23-bb-kiemphieu-hdnd",
    subtitle: "Mẫu 23",
    title: "BIÊN BẢN KẾT QUẢ KIỂM PHIẾU BẦU CỬ ĐẠI BIỂU HĐND TỈNH/THÀNH PHỐ",
    action: exportReportWordKPTinh, // Hàm bạn đã viết
  },
  {
    name: "mau24-xd-kq-hdnd",
    subtitle: "Mẫu 24",
    title: "BIÊN BẢN XÁC ĐỊNH KẾT QUẢ BẦU CỬ ĐẠI BIỂU HĐND TỈNH/THÀNH PHỐ",
    action: exportReportWordXDKQTinh, 
  }
]

const REPORT_TEMPLATES_XA = [
  {
    name: "mau23-bb-kiemphieu-hdnd",
    title: "BIÊN BẢN KẾT QUẢ KIỂM PHIẾU BẦU CỬ ĐẠI BIỂU HĐND XÃ/PHƯỜNG",
    action: exportReportWordKPXa, // Hàm bạn đã viết
  },
  {
    name: "mau24-xd-kq-hdnd",
    title: "BIÊN BẢN XÁC ĐỊNH KẾT QUẢ BẦU CỬ ĐẠI BIỂU HĐND XÃ/PHƯỜNG",
    action: exportReportWordXDKQXa, 
  }
]
  //Thông tin
  const [electionDetails, setElectionDetails] = useState({
    province: "",
    district: "",
    unitName: "",
    totalVoters: 0,
    actualVoters: 0,
    issuedVotes: 0,
    receivedVotes: 0,
    invalidVotes: 0,
    validVotes: 0,
    headOfBoard: "", // Tổ trưởng
    secretary: "", // Thư ký
    boardMembers: "", // Thành viên tổ bầu cử
    witnessesOpening: "", // 2 Cử tri chứng kiến mở thùng phiếu
    witnessesCounting: "", // 2 Cử tri chứng kiến kiểm phiếu
  });
  const handleRestore = async () => {
    if (!window.electronAPI) {
      alert("Chức năng khôi phục chỉ khả dụng trong ứng dụng Electron.");
      return;
    }

    const confirmRestore = confirm(
      "CẢNH BÁO: Hành động này sẽ XÓA TOÀN BỘ dữ liệu hiện tại và thay thế bằng dữ liệu từ file backup. Bạn có chắc chắn không?",
    );
    if (!confirmRestore) return;

    try {
      const backup = await window.electronAPI.restoreData();

      if (!backup || backup.error) {
        if (!backup) console.log("Hủy restore");
        else alert("Lỗi: " + backup.error);
        return;
      }

      // ===============================
      // 1️⃣ KIỂM TRA CẤU TRÚC BACKUP
      // ===============================
      if (
        backup.app !== "BauCu2026" ||
        backup.version !== 1 ||
        !backup.meta ||
        !backup.payload
      ) {
        alert("File backup không hợp lệ hoặc không đúng ứng dụng!");
        return;
      }

      const { meta, payload } = backup;

      if (!payload.votes || !payload.candidates) {
        alert("File backup thiếu dữ liệu votes hoặc candidates!");
        return;
      }

      // ===============================
      // 2️⃣ KIỂM TRA ĐÚNG CẤP BẦU CỬ
      // ===============================
      const currentElectionLevel =
        localStorage.getItem("selected_election_slug") || "xa";

      if (meta.electionLevel !== currentElectionLevel) {
        alert(
          `File backup thuộc cấp "${meta.electionLevel.toUpperCase()}", không khớp với cấp hiện tại "${currentElectionLevel.toUpperCase()}".`,
        );
        return;
      }

      // ===============================
      // 3️⃣ XÓA & RESTORE DỮ LIỆU
      // ===============================
      await db.transaction(
        "rw",
        [db.votes, db.candidates, db.config],
        async () => {
          await db.votes.clear();
          await db.candidates.clear();
          await db.config.clear();

          await db.votes.bulkAdd(payload.votes);
          await db.candidates.bulkAdd(payload.candidates);

          if (payload.config) {
            await db.config.add(payload.config);
          }
        },
      );

      alert(
        `Khôi phục dữ liệu thành công!\nCấp: ${meta.electionLevel.toUpperCase()}\nThời điểm backup: ${meta.exportDate}`,
      );

      window.location.reload();
    } catch (error) {
      console.error("Lỗi Restore:", error);
      alert("Khôi phục thất bại. Vui lòng kiểm tra lại file backup.");
    }
  };

  useEffect(() => {
    const savedName = localStorage.getItem("selected_election_name");
    const slugName = localStorage.getItem("selected_election_slug");
    if (savedName) setDefaultElectionType(savedName);
    if (slugName) setDefaultElectionSlug(slugName);
  }, []);

  const openResetModal = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    setRequiredPin(randomPin);
    setShowResetModal(true);
  };

  // Load dữ liệu cũ từ config khi trang web tải xong
  useEffect(() => {
    if (config) {
      setElectionDetails({
        province: config.province,//Thành phố
        district: config.district,//Xã
        secretary: config.secretary,//Thư ký
        witnessesOpening: config.witnessesOpening,//Chứng kiến mở
        witnessesCounting: config.witnessesCounting,//Chứng kiến kiểm
        unitName: config.unitName || "",//Đơn vị bầu cử
        totalVoters: config.totalVoters || 0,//Tổng số cử tri
        actualVoters: config.actualVoters || 0,//Cử tri đi bầu
        issuedVotes: config.issuedVotes || 0,//Phiếu phát ra
        receivedVotes: config.receivedVotes || 0,//Phiếu thu vào
        invalidVotes: config.invalidVotes || 0,//Phiếu không hợp lệ
        validVotes: config.validVotes || 0,//Phiếu hợp lệ
        headOfBoard: config.headOfBoard || "",//Tổ trưởng tổ bầu cử
        boardMembers: config.boardMembers || "",//Thành viên tổ bầu cử
        witnesses: config.witnesses || "",
      });
      console.log(config)
    }
  }, [config]);

  const saveConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLocked) return alert("❌ Dữ liệu đã khóa!");

    const formData = new FormData(e.currentTarget);
    const candidateLimit = Number(formData.get("candidateLimit"));
    const seats = Number(formData.get("seats"));

    if (seats > candidateLimit) {
      return alert("❌ Lỗi logic! Số người bầu không được lớn hơn số ứng viên");
    }
    try {
      // 1️⃣ LẤY config hiện tại (auto merge default nếu thiếu)
      const currentConfig = await getConfig();

      // 2️⃣ PATCH những field liên quan form
      const updatedConfig = {
        ...currentConfig,
        type: defaultElectionType as any,
        slug: defaultElectionSlug as any,
        candidateLimit,
        seats,
        candidateCount: candidateLimit,
        groupSize: seats,
        tallyMethod: "Xuôi",
      };

      // 3️⃣ GHI ĐÈ LẠI (KHÔNG clear)
      await db.config.put(updatedConfig);

      alert("✅ Đã lưu thông tin tổng hợp thành công!");
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (e) {
      alert(e);
    }
  };

  // const saveElectionDetails = async () => {
  //   try {
  //     // 1️⃣ Kiểm tra xem đã có bản ghi config chưa (thường ID là 1)
  //     const currentConfig = await db.config.toCollection().first();

  //     if (currentConfig) {
  //       // 2️⃣ Cập nhật chỉ các trường liên quan đến thông tin tổng hợp
  //       await db.config.update(currentConfig.id, {
  //         ...electionDetails,
  //         slug: defaultElectionSlug
  //       });
  //     } else {
  //       // 3️⃣ Nếu chưa có config thì tạo mới với id mặc định là 1
  //       await db.config.add({
  //         id: 1,
  //         ...electionDetails,
  //       });
  //     }
  //     alert("✅ Đã lưu thông tin tổng hợp thành công!");
  //   } catch (error) {
  //     console.error("Lỗi khi lưu:", error);
  //     alert("❌ Không thể lưu thông tin. Vui lòng kiểm tra lại.");
  //   }
  // };

  const saveElectionDetails = async () => {
  try {
    const { 
      totalVoters, actualVoters, issuedVotes, 
      receivedVotes, invalidVotes, validVotes 
    } = electionDetails;

    // --- 1️⃣ Kiểm tra logic dữ liệu ---
    const errors = [];

    if (issuedVotes > totalVoters) {
      errors.push("Số phiếu phát ra không thể lớn hơn tổng số cử tri.");
    }
    if (receivedVotes > issuedVotes) {
      errors.push("Số phiếu thu vào không thể lớn hơn số phiếu phát ra.");
    }
    if (Number(validVotes) + Number(invalidVotes) !== Number(receivedVotes)) {
      errors.push("Tổng phiếu hợp lệ và không hợp lệ phải bằng số phiếu thu vào.");
    }
    if (actualVoters > totalVoters) {
      errors.push("Số cử tri đi bầu thực tế không thể lớn hơn tổng số cử tri.");
    }

    // Nếu có lỗi, thông báo và dừng việc lưu
    if (errors.length > 0) {
      alert("❌ Dữ liệu không hợp lệ:\n- " + errors.join("\n- "));
      return;
    }

    // --- 2️⃣ Tiến hành lưu vào Database ---
    const currentConfig = await db.config.toCollection().first();

    if (currentConfig) {
      await db.config.update(currentConfig.id, {
        ...electionDetails,
        slug: defaultElectionSlug
      });
    } else {
      await db.config.add({
        id: 1,
        ...electionDetails,
        slug: defaultElectionSlug
      });
    }

    alert("✅ Đã lưu thông tin tổng hợp thành công!");
  } catch (error) {
    console.error("Lỗi khi lưu:", error);
    alert("❌ Không thể lưu thông tin. Vui lòng kiểm tra lại.");
  }
};
  const addCandidate = async () => {
    if (isLocked || !newName.trim()) {
      alert("Nhập họ tên ứng cử viên trước khi lưu");
      return;
    }
    const limit = config?.candidateLimit || 0;
    if ((candidates?.length || 0) >= limit) return alert("❌ Đã đủ số lượng!");
    await db.candidates.add({
      name: newName.trim(),
      x: 50,
      y: 50,
      width: 220,
      height: 60,
      fontSize: 20,
      color: "#000000",
      bgColor: "rgba(255,255,255,0.7)",
      opacity: 0.7,
    } as any);
    setNewName("");
  };

  // Hàm lưu tên sau khi sửa
  const updateCandidateName = async (id: number) => {
    if (isLocked || !editingName.trim()) return;
    await db.candidates.update(id, { name: editingName.trim() });
    setEditingId(null);
    setEditingName("");
  };

  const deleteCandidate = async (id: number) => {
    if (isLocked) return;
    if (confirm("⚠️ Xóa ứng cử viên?")) await db.candidates.delete(id);
  };

  const handleResetData = async () => {
    if (confirmCode !== requiredPin) {
      alert(`❌ Mã xác nhận không chính xác!`);
      return;
    }

    const doubleCheck = confirm(
      `🔥 XÁC NHẬN RESET: ${requiredPin}\nToàn bộ dữ liệu sẽ bị xóa sạch. Tiếp tục?`,
    );

    if (doubleCheck) {
      try {
        await Promise.all([
          db.votes.clear(),
          db.candidates.clear(),
          db.config.clear(),
        ]);

        // localStorage.removeItem("selected_election_name");
        setShowResetModal(false);
        setConfirmCode("");
        alert("✅ Hệ thống đã được đưa về trạng thái mặc định.");
        window.location.reload();
      } catch (error) {
        console.error("Lỗi khi reset:", error);
        alert("❌ Có lỗi xảy ra khi xóa dữ liệu.");
      }
    }
  };

  const getStats = () => {
    if (!votes || !candidates) return [];
    const statsMap: Record<number, number> = {};
    votes.forEach((v) => {
      try {
        const selectedIds: number[] = decrypt(v.candidateIds as any);
        selectedIds.forEach((id) => {
          statsMap[id] = (statsMap[id] || 0) + 1;
        });
      } catch (e) {}
    });
    return candidates.map((c) => ({
      ...c,
      voteCount: statsMap[c.id!] || 0,
      percentage:
        votes.length > 0
          ? (((statsMap[c.id!] || 0) / votes.length) * 100).toFixed(1)
          : 0,
    }));
  };

  const statsData = getStats();
  const isCandidateLimitReached =
    (candidates?.length || 0) >= (config?.candidateLimit || 0);
  const canStartTally =
    config &&
    config.candidateLimit > 0 &&
    candidates?.length === config.candidateLimit;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 bg-zinc-50 min-h-screen">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-zinc-200">
        <div className="flex flex-col">
          <h1 className="text-xl font-black text-zinc-900 flex items-center gap-2 uppercase tracking-tighter">
            <Settings className="text-blue-600 w-6 h-6" /> {defaultElectionType}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Link
              prefetch={false}
              href="/train/"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors font-medium"
            >
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            </Link>

            <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest bg-zinc-100 px-2 py-0.5 rounded">
              Hệ thống đang hoạt động
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            prefetch={false}
            href="/"
            className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-blue-600 transition-all"
          >
            <HomeIcon size={16} /> Về trang chủ
          </Link>
        </div>
      </div>

      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-2 text-amber-800 text-xs shadow-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span>
            <b>Dữ liệu đã khóa:</b> Đã có {votes?.length || 0} phiếu. Cần Reset
            dữ liệu để bắt đầu cuộc bầu cử mới.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CẤU HÌNH & NHẬP LIỆU */}
        <section
          className={`lg:col-span-12 bg-white p-6 rounded-3xl shadow-sm border border-zinc-200 flex flex-col transition-opacity ${isLocked ? "opacity-75" : ""}`}
        >
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-6 pb-6 border-b">
            <div className="flex items-center gap-4">
              <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
                <Users size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-zinc-800 uppercase leading-none">
                  Cài đặt ứng viên
                </h2>
                <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-widest">
                  Tiến độ: {candidates?.length}/{config?.candidateLimit || 0}
                </p>
              </div>
            </div>

            <form
              onSubmit={saveConfig}
              className="flex items-center gap-3 bg-zinc-50 p-1.5 rounded-xl border"
            >
              <div className="flex items-center gap-2 px-2 border-r">
                <span className="text-[10px] font-black text-zinc-400 uppercase">
                  Ứng cử:
                </span>
                <input
                  name="candidateLimit"
                  type="number"
                  defaultValue={config?.candidateLimit}
                  disabled={isLocked}
                  className="w-12 bg-transparent font-black text-center text-sm outline-none"
                  required
                />
              </div>
              <div className="flex items-center gap-2 px-2">
                <span className="text-[10px] font-black text-zinc-400 uppercase">
                  Bầu:
                </span>
                <input
                  name="seats"
                  type="number"
                  defaultValue={config?.seats}
                  disabled={isLocked}
                  className="w-12 bg-transparent font-black text-center text-sm outline-none"
                  required
                />
              </div>
              {!isLocked && (
                <button
                  type="submit"
                  className="bg-zinc-900 text-white px-3 py-1.5 rounded-lg font-black text-[10px] hover:bg-black transition-all"
                >
                  LƯU
                </button>
              )}
            </form>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-4">
              <div className="p-4 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                <input
                  ref={inputRef}
                  value={newName || ""}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={isLocked || isCandidateLimitReached}
                  placeholder={
                    isCandidateLimitReached ? "Đã đủ..." : "Nhập họ tên..."
                  }
                  className="w-full border-zinc-200 border p-3 rounded-xl outline-none focus:border-blue-500 font-bold text-sm mb-2 shadow-sm"
                  onKeyDown={(e) => {
                    // Chỉ cho phép Enter nếu name không trống
                    if (e.key === "Enter" && newName.trim() !== "") {
                      addCandidate();
                    }
                  }}
                />

                <button
                  onClick={addCandidate}
                  // Nút bị mờ nếu: Đã khóa HOẶC Đủ số lượng HOẶC Tên đang trống
                  disabled={
                    isLocked || isCandidateLimitReached || newName.trim() === ""
                  }
                  className={`w-full py-3 rounded-xl text-white font-black text-xs transition-all flex items-center justify-center gap-2 
      ${
        isLocked || isCandidateLimitReached || newName.trim() === ""
          ? "bg-zinc-200 cursor-not-allowed opacity-70" // Style khi bị mờ
          : "bg-blue-600 hover:bg-blue-700 shadow-md active:scale-95" // Style khi sẵn sàng
      }`}
                >
                  <Plus size={16} /> THÊM VÀO DANH SÁCH
                </button>
              </div>

              {canStartTally && (
                <Link
                  prefetch={false}
                  href="/tally"
                  className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-4 rounded-2xl font-black hover:bg-green-700 shadow-lg transition-all animate-bounce text-center"
                >
                  <ClipboardCheck size={20} /> BẮT ĐẦU KIỂM PHIẾU
                </Link>
              )}
            </div>

            <div className="lg:col-span-8">
              <h3 className="text-[10px] font-black text-zinc-400 uppercase mb-3 tracking-tighter flex items-center gap-1">
                <TableIcon size={12} /> Danh sách ứng viên ({candidates?.length}
                )
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 overflow-y-auto max-h-[280px] pr-2 custom-scrollbar">
                {candidates?.map((c, index) => (
                  <div
                    key={c.id}
                    className="flex justify-between items-center p-2.5 bg-white border border-zinc-100 rounded-xl hover:border-blue-300 transition-all shadow-sm group"
                  >
                    <div className="flex items-center gap-2 truncate flex-1">
                      <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center bg-zinc-100 rounded text-[9px] font-black text-zinc-500 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        {index + 1}
                      </span>
                      {editingId === c.id ? (
                        <input
                          autoFocus
                          value={editingName || ""}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && updateCandidateName(c.id!)
                          }
                          onBlur={() => setEditingId(null)}
                          className="font-bold text-zinc-700 uppercase text-[11px] outline-none border-b border-blue-500 w-full bg-blue-50/50"
                        />
                      ) : (
                        <span className="font-bold text-zinc-700 uppercase text-[11px] truncate">
                          {c.name}
                        </span>
                      )}
                    </div>
                    {!isLocked && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {editingId === c.id ? (
                          <button
                            onClick={() => updateCandidateName(c.id!)}
                            className="text-green-500 hover:text-green-700 p-1"
                          >
                            <Check size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingId(c.id!);
                              setEditingName(c.name);
                            }}
                            className="text-zinc-400 hover:text-blue-500 p-1"
                          >
                            <Edit3 size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteCandidate(c.id!)}
                          className="text-zinc-300 hover:text-red-500 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* BÁO CÁO */}
        <section className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

  {/* CỘT TRÁI – BÁO CÁO NHANH */}
  <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex flex-col justify-between">
    
    <div>
      <h2 className="text-sm font-black text-zinc-800 uppercase mb-6 flex items-center gap-2">
        <BarChart3 size={18} className="text-purple-500" />
        Báo cáo nhanh
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 bg-purple-50 rounded-2xl border border-purple-100">
          <p className="text-[10px] font-black text-purple-400 uppercase mb-2">
            Tổng số phiếu
          </p>
          <p className="text-4xl font-black text-purple-900 leading-none">
            {votes?.length || 0}
          </p>
        </div>

        <div className="p-5 bg-zinc-900 rounded-2xl">
          <p className="text-[10px] font-black text-zinc-400 uppercase mb-2">
            Ứng viên
          </p>
          <p className="text-4xl font-black text-white leading-none">
            {candidates?.length || 0}
          </p>
        </div>
      </div>
    </div>

    {/* ACTION */}
    <div className="mt-6 space-y-3">
      <button
        onClick={() =>
          exportVotesToExcel(
            candidates || [],
            votes || [],
            defaultElectionType
          )
        }
        disabled={!votes?.length}
        className="w-full bg-green-700 text-white py-3.5 rounded-xl font-black text-[11px] uppercase hover:bg-green-800 disabled:bg-zinc-100 disabled:text-zinc-400 transition-all flex items-center justify-center gap-2 shadow-sm"
      >
        <TableIcon size={14} />
        Xuất Excel
      </button>
    </div>
  </div>

  {/* CỘT PHẢI – TOP KẾT QUẢ */}
  <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex flex-col">
    
    <h4 className="text-[11px] font-black text-zinc-400 uppercase mb-6 tracking-widest flex items-center gap-2">
      <Trophy size={14} className="text-amber-500" />
      Top kết quả bầu cử
    </h4>

    <div className="space-y-5 overflow-y-auto max-h-[420px] pr-2 custom-scrollbar">
      {statsData
        .sort((a, b) => b.voteCount - a.voteCount)
        .slice(0, 20)
        .map((s, idx) => (
          <div key={s.id} className="group">
            
            <div className="flex justify-between items-center text-[11px] font-bold mb-2 uppercase">
              <span className="text-zinc-600 truncate max-w-[260px] group-hover:text-zinc-900 transition-colors">
                {idx === 0 && "🥇 "}
                {idx === 1 && "🥈 "}
                {idx === 2 && "🥉 "}
                {s.name}
              </span>
              <span className="text-zinc-900 bg-zinc-100 px-3 py-1 rounded-lg">
                {s.voteCount} phiếu
              </span>
            </div>

            <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  idx === 0
                    ? "bg-blue-600"
                    : idx === 1
                    ? "bg-emerald-500"
                    : idx === 2
                    ? "bg-amber-500"
                    : "bg-zinc-400"
                }`}
                style={{ width: `${s.percentage}%` }}
              />
            </div>
          </div>
        ))}
    </div>
  </div>
</section>

      <section className="lg:col-span-12 bg-white/90 backdrop-blur p-6 lg:p-10 rounded-[32px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12)] border border-zinc-200/80">
  {/* HEADER */}
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 pb-6 border-b border-dashed border-zinc-200">
    <div className="flex items-center gap-4">
      <div className="bg-gradient-to-br from-amber-100 to-amber-50 p-3.5 rounded-2xl text-amber-600 shadow-sm border border-amber-200/50">
        <ClipboardCheck size={28} />
      </div>
      <div>
        <h2 className="text-xl lg:text-2xl font-black text-zinc-800 uppercase tracking-tight">
          Thông tin tổng hợp
        </h2>
        <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-[0.2em]">
          Phục vụ xuất biên bản báo cáo hệ thống
        </p>
      </div>
    </div>

    <button
      onClick={saveElectionDetails}
      className="flex items-center gap-2 bg-zinc-900 hover:bg-black text-white px-8 py-3.5 rounded-2xl font-black text-xs shadow-xl shadow-zinc-200 transition-all active:scale-95 uppercase tracking-widest"
    >
      <Check size={18} strokeWidth={3} /> Lưu thông tin
    </button>
  </div>

 <div className="grid grid-cols-1 gap-8">
  {/* HÀNG 1: ĐỊA ĐIỂM & SỐ LIỆU (Tất cả trên 1 dòng ở màn hình lớn) */}
  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
    
    {/* CỘT TRÁI: ĐƠN VỊ (Chiếm 7/12 không gian) */}
    <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-zinc-50/50 p-5 rounded-[24px] border border-zinc-100">
      <div className="sm:col-span-1">
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider ml-1 mb-1.5 block">Tỉnh/Thành phố</label>
        <input
          type="text"
          value={electionDetails.province || ""}
          onChange={(e) => setElectionDetails({ ...electionDetails, province: e.target.value })}
          className="w-full border border-zinc-200 bg-white p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-bold text-sm transition-all"
        />
      </div>
      <div className="sm:col-span-1">
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider ml-1 mb-1.5 block">Xã/Phường</label>
        <input
          type="text"
          value={electionDetails.district || ""}
          onChange={(e) => setElectionDetails({ ...electionDetails, district: e.target.value })}
          className="w-full border border-zinc-200 bg-white p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-bold text-sm transition-all"
        />
      </div>
      <div className="sm:col-span-1">
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider ml-1 mb-1.5 block">Tên đơn vị bầu cử</label>
        <input
          type="text"
          placeholder="Tổ số 1..."
          value={electionDetails.unitName || ""}
          onChange={(e) => setElectionDetails({ ...electionDetails, unitName: e.target.value })}
          className="w-full border border-zinc-200 bg-white p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-bold text-sm transition-all"
        />
      </div>
    </div>

    {/* CỘT PHẢI: SỐ LIỆU CỬ TRI (Chiếm 5/12 không gian) */}
    <div className="xl:col-span-5 grid grid-cols-3 gap-4 items-end bg-zinc-50/50 p-5 rounded-[24px] border border-zinc-100">
      <div className="col-span-1">
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider ml-1 mb-1.5 block">Tổng số cử tri</label>
        <input
          type="number"
          value={electionDetails.totalVoters || 0}
          onChange={(e) => setElectionDetails({ ...electionDetails, totalVoters: Number(e.target.value) })}
          className="w-full border border-zinc-200 bg-white p-3.5 rounded-xl outline-none focus:border-zinc-900 font-black text-sm transition-all"
        />
      </div>
      <div className="col-span-1">
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider ml-1 mb-1.5 block">Cử tri đi bầu</label>
        <input
          type="number"
          value={electionDetails.actualVoters || 0}
          onChange={(e) => setElectionDetails({ ...electionDetails, actualVoters: Number(e.target.value) })}
          className="w-full border border-zinc-200 bg-white p-3.5 rounded-xl outline-none focus:border-zinc-900 font-black text-sm transition-all"
        />
      </div>
      
      {/* TỈ LỆ ĐI BẦU (Đưa lên cùng hàng với Input) */}
      <div className="col-span-1 h-[46px] flex flex-col justify-center items-center bg-amber-500 rounded-xl border border-amber-600 shadow-sm shadow-amber-200">
        <span className="text-[8px] font-black text-amber-100 uppercase tracking-tighter leading-none mb-1">Tỉ lệ đi bầu</span>
        <div className="text-sm font-black text-white leading-none">
          {electionDetails.totalVoters > 0 ? ((electionDetails.actualVoters / electionDetails.totalVoters) * 100).toFixed(1) : 0}%
        </div>
      </div>
    </div>

  </div>


    {/* HÀNG 2: QUẢN LÝ PHIẾU */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-zinc-900 rounded-[24px] shadow-inner">
      <div className="col-span-2 lg:col-span-4 mb-2">
        <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Kiểm soát phiếu bầu</h3>
      </div>
      <div>
        <label className="text-[10px] font-black text-zinc-400 uppercase ml-1 mb-1.5 block">Phiếu phát ra</label>
        <input
          type="number"
          value={electionDetails.issuedVotes || 0}
          onChange={(e) => setElectionDetails({ ...electionDetails, issuedVotes: Number(e.target.value) })}
          className="w-full bg-zinc-800 border border-zinc-700 text-white p-3.5 rounded-xl outline-none focus:border-amber-500 font-black text-sm"
        />
      </div>
      <div>
        <label className="text-[10px] font-black text-zinc-400 uppercase ml-1 mb-1.5 block">Phiếu thu vào</label>
        <input
          type="number"
          value={electionDetails.receivedVotes || 0}
          onChange={(e) => setElectionDetails({ ...electionDetails, receivedVotes: Number(e.target.value) })}
          className="w-full bg-zinc-800 border border-zinc-700 text-white p-3.5 rounded-xl outline-none focus:border-amber-500 font-black text-sm"
        />
      </div>
      <div>
        <label className="text-[10px] font-black text-green-500 uppercase ml-1 mb-1.5 block">Phiếu hợp lệ</label>
        <input
          type="number"
          value={electionDetails.validVotes || 0}
          onChange={(e) => setElectionDetails({ ...electionDetails, validVotes: Number(e.target.value) })}
          className="w-full bg-green-500/10 border border-green-500/50 text-green-400 p-3.5 rounded-xl outline-none focus:border-green-500 font-black text-sm"
        />
      </div>
      <div>
        <label className="text-[10px] font-black text-red-500 uppercase ml-1 mb-1.5 block">Phiếu không hợp lệ</label>
        <input
          type="number"
          value={electionDetails.invalidVotes || 0}
          onChange={(e) => setElectionDetails({ ...electionDetails, invalidVotes: Number(e.target.value) })}
          className="w-full bg-red-500/10 border border-red-500/50 text-red-400 p-3.5 rounded-xl outline-none focus:border-red-500 font-black text-sm"
        />
      </div>
    </div>

    {/* HÀNG 3: NHÂN SỰ & CHỨNG KIẾN */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* NHÂN SỰ */}
      <div className="space-y-4">
        <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
          Thành phần tổ bầu cử
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 mb-1.5 block">Tổ trưởng</label>
            <input
              type="text"
              value={electionDetails.headOfBoard || ""}
              onChange={(e) => setElectionDetails({ ...electionDetails, headOfBoard: e.target.value })}
              className="w-full border border-zinc-200 p-3.5 rounded-xl outline-none focus:border-blue-500 font-bold text-sm bg-zinc-50/30"
            />
          </div>
          <div className="col-span-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 mb-1.5 block">Thư ký</label>
            <input
              type="text"
              value={electionDetails.secretary || ""}
              onChange={(e) => setElectionDetails({ ...electionDetails, secretary: e.target.value })}
              className="w-full border border-zinc-200 p-3.5 rounded-xl outline-none focus:border-blue-500 font-bold text-sm bg-zinc-50/30"
            />
          </div>
        </div>
        <div className="bg-blue-50/50 p-4 rounded-[20px] border border-blue-100 shadow-sm">
          <label className="text-[10px] font-black text-blue-600 uppercase ml-1 mb-2 block">Các thành viên khác</label>
          <textarea
            value={electionDetails.boardMembers || ""}
            onChange={(e) => setElectionDetails({ ...electionDetails, boardMembers: e.target.value })}
            className="w-full bg-white/80 border border-blue-200/50 p-3 rounded-xl outline-none font-bold text-sm h-[80px] resize-none text-blue-900 focus:bg-white transition-all shadow-inner"
            placeholder="Danh sách thành viên..."
          />
        </div>
      </div>

      {/* CHỨNG KIẾN */}
      <div className="space-y-4">
        <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
          Cử tri chứng kiến
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-zinc-50/80 p-4 rounded-[20px] border border-zinc-200/60 shadow-sm">
            <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 mb-2 block">Mở thùng phiếu (02 người)</label>
            <textarea
              value={electionDetails.witnessesOpening || ""}
              onChange={(e) => setElectionDetails({ ...electionDetails, witnessesOpening: e.target.value })}
              className="w-full bg-white border border-zinc-200 p-3 rounded-xl outline-none font-bold text-sm h-[60px] resize-none text-zinc-800 focus:border-amber-500 transition-all shadow-inner"
            />
          </div>
          <div className="bg-zinc-50/80 p-4 rounded-[20px] border border-zinc-200/60 shadow-sm">
            <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 mb-2 block">Kiểm phiếu (02 người)</label>
            <textarea
              value={electionDetails.witnessesCounting || ""}
              onChange={(e) => setElectionDetails({ ...electionDetails, witnessesCounting: e.target.value })}
              className="w-full bg-white border border-zinc-200 p-3 rounded-xl outline-none font-bold text-sm h-[60px] resize-none text-zinc-800 focus:border-amber-500 transition-all shadow-inner"
            />
          </div>
        </div>
         <Link
        href="/admin/detailed-stats"
        prefetch={false}
        className="w-full bg-green-700 text-white py-3.5 rounded-xl font-black text-[11px] uppercase hover:bg-green-800 disabled:bg-zinc-100 disabled:text-zinc-400 transition-all flex items-center justify-center gap-2 shadow-sm"
      >
        Xem thống kê chi tiết
      </Link>
      </div>
     
    </div>
  </div>
</section>
      <section
          className="
    lg:col-span-12
    bg-white/90 backdrop-blur
    p-6 lg:p-8
    rounded-[28px]
    shadow-[0_10px_30px_-12px_rgba(0,0,0,0.15)]
    border border-zinc-200/70
  "
        >
  <h2 className="text-lg font-extrabold text-slate-800 mb-6 uppercase tracking-wide flex items-center gap-2">
    <div className="w-1 h-6 bg-blue-600 rounded-full" />
    Danh sách biểu mẫu biên bản
  </h2>

  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
    {config?.slug =='quoc-hoi' && REPORT_TEMPLATES_QH.map((report) => (
      <button
        key={report.name}
        onClick={() => report.action()} // Gọi hàm xử lý tương ứng
        className="
          group relative p-5 rounded-2xl border border-slate-200 bg-white
          text-left transition-all duration-300
          hover:border-blue-500 hover:shadow-xl hover:-translate-y-1.5
          active:scale-[0.96] flex flex-col justify-between min-h-[140px]
        "
      >
        {/* Số mẫu Badge */}
        <div className="absolute top-4 right-4 px-2 py-1 bg-slate-100 rounded-md text-[10px] font-black text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
          MẪU {report.subtitle}
        </div>

        {/* Nội dung chính */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <FileText size={16} />
            </div>
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">
              Báo cáo Word
            </div>
          </div>

          <div className="text-sm font-black text-slate-800 leading-tight group-hover:text-blue-700 line-clamp-2">
            {report.title}
          </div>
        </div>
      </button>
    ))}
  </div>
</section>

        <section className="lg:col-span-12 flex justify-end">
          <div className="flex items-center gap-4">
            <button
              onClick={openResetModal}
              className="flex items-center gap-2 text-[10px] font-black text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all border border-transparent hover:border-red-100"
            >
              <RefreshCcw size={14} /> RESET DỮ LIỆU
            </button>

            <button
              onClick={handleRestore}
              className="flex items-center gap-2 text-[10px] font-black text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all border border-transparent hover:border-red-100"
            >
              <Upload size={14} /> KHÔI PHỤC
            </button>
          </div>
        </section>
      </div>

      {/* MODAL RESET */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-red-100 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <div className="bg-red-50 p-2 rounded-xl text-red-600">
                <RefreshCcw size={24} />
              </div>
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setConfirmCode("");
                }}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <h3 className="text-xl font-black text-zinc-900 uppercase leading-tight mb-2">
              Xác nhận Reset
            </h3>
            <p className="text-zinc-500 text-[10px] font-bold leading-relaxed mb-6 uppercase">
              Vui lòng nhập mã số dưới đây để xác nhận xóa toàn bộ dữ liệu. Chú
              ý: Mọi số liệu sẽ bị xóa vĩnh viễn.
            </p>

            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={confirmCode || ""}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  placeholder="Nhập mã xác nhận"
                  className="w-full bg-zinc-50 border-2 border-zinc-100 p-4 rounded-2xl text-center text-2xl font-black tracking-widest outline-none focus:border-red-500 transition-all uppercase"
                />
                <div className="mt-2 text-[9px] text-center font-bold text-zinc-400 bg-zinc-100 py-1 rounded">
                  <span className="text-red-600 text-sm">{requiredPin}</span>
                </div>
              </div>
              <button
                onClick={handleResetData}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-sm uppercase shadow-lg shadow-red-200 hover:bg-red-700 transition-all"
              >
                Xác nhận xóa sạch dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
