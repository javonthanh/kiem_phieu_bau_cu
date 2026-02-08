"use client";

import React, { useRef, useEffect, useState, createRef } from "react";
import { db, encrypt, decrypt } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import Draggable from "react-draggable";
import {
  Settings2,
  Save,
  MoveDiagonal2,
  AlertCircle,
  LayoutGrid,
  Hash,
  CheckSquare,
  ArrowLeft,
  Camera,
  Video,
  VideoOff,
  Maximize,
  ArrowsUpFromLine,
  Pencil,
  X,
  Target,
  Settings,
  Upload,
  Database,
  Users,
} from "lucide-react";
import Link from "next/link";
import * as tf from "@tensorflow/tfjs"; // Thư viện TensorFlow.js
import VoteHistoryPanel from "./components/VoteHistoryPanel";
import AiDebugPanel from "./components/AidebugPanel";
const hexToRGBA = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

declare global {
  interface Window {
    electronAPI: {
      saveDataBackup: (data: any) => void;
    };
  }
}

export default function TallyPage() {
  const [model, setModel] = useState<tf.LayersModel | null>(null);
  const [curentGroup, setCurentGroup] = useState(0);
  // const [recentVotes, setRecentVotes] = useState(0);
  const [editingVoteId, setEditingVoteId] = useState<number | null>(null);
  const [tempStates, setTempStates] = useState<Record<number, boolean>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [isEditVideo, setIsEditVideo] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState("");
  const [isBackedUp, setIsBackedUp] = useState([true, "Đang chờ..."]);
  const [aiThreshold, setAiThreshold] = useState(0.85);
  const [resizingId, setResizingId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [showCurrentVotePanel, setShowCurrentVotePanel] = useState(true);
  const nodeRefs = useRef<Map<number, React.RefObject<HTMLDivElement>>>(
    new Map(),
  );
  const confirmBtnRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentVotePanelRef = useRef(null);
  const historyRef = useRef(null);
  const historyRefDebug = useRef(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const config = useLiveQuery(() => db.config.toCollection().first());
  const candidates = useLiveQuery(() => db.candidates.toArray());

  const targetGroupSize = config?.groupSize || 0;

  // 1. Số lượng người đang được chọn hiện tại trên màn hình
  const selectedCount = candidates?.filter((c) => !tempStates[c.id!]).length || 0;
  const isVoteValid = targetGroupSize > 0 
  ? selectedCount === targetGroupSize  // Nếu bầu đúng N: phải bằng N
  : (selectedCount > 0 && selectedCount <= (config?.seats || 99)); // Nếu tự do: 1 <= chọn <= seats
  // 2. Query đếm số lượng phiếu
  const votesInCurrentGroupType = useLiveQuery(async () => {
    // Xác định xem chúng ta đang muốn đếm loại phiếu nào
    // Nếu config là bầu cố định (1,2,3) -> đếm phiếu có groupNumber đó
    // Nếu config là bầu tự do (0) -> đếm phiếu có groupNumber trùng với số người đang chọn
    const groupToFilter = targetGroupSize > 0 ? targetGroupSize : selectedCount;

    // Nếu chưa chọn ai ở chế độ tự do, có thể trả về 0 hoặc tổng số phiếu tự do tùy bạn
    if (targetGroupSize === 0 && selectedCount === 0) return 0;

    return await db.votes
      .where("groupNumber")
      .equals(groupToFilter)
      .count();
  }, [targetGroupSize, selectedCount]) ?? 0;

  const groupStats = useLiveQuery(async () => {
    const allVotes = await db.votes.toArray();
    // Trả về object: { 1: số_phiếu, 2: số_phiếu, ... }
    return allVotes.reduce((acc: Record<number, number>, vote) => {
      acc[vote.groupNumber] = (acc[vote.groupNumber] || 0) + 1;
      return acc;
    }, {});
  }, [targetGroupSize,selectedCount]) ?? {};

  const votesAll = useLiveQuery(async () => {
    return await db.votes
      .count();
  }, [targetGroupSize, selectedCount]) ?? 0;

  // 3. Query lấy lịch sử (recentVotes)
  const recentVotes = useLiveQuery(async () => {

    let groupToFilter: number;

    if (targetGroupSize > 0) {
      // Chế độ cố định: Luôn hiện theo target
      groupToFilter = targetGroupSize;
    } else {
      groupToFilter = isVoteValid ? selectedCount : curentGroup;
    }
    
    if (groupToFilter === 0) return [];

    return await db.votes
      .where("groupNumber")
      .equals(groupToFilter)
      .reverse() // Mới nhất lên đầu
      .limit(10) // Lấy 10 phiếu
      .toArray();
  }, [targetGroupSize, selectedCount, curentGroup]);

    

  // Định nghĩa danh sách phím tắt mở rộng
  const extendedKeys = ["A", "S", "D", "F", "G", "H", "J", "K", "L"];

  // Hàm lấy nhãn phím tắt dựa trên index
  const getShortcutKey = (index: number) => {
    if (index < 9) return (index + 1).toString(); // 1-9
    const extendedIndex = index - 9;
    return extendedKeys[extendedIndex] || ""; // A, S, D...
  };

  const toggleScanning = () => {
    setIsScanning((prev) => !prev);
  };

  // Lắng nghe phím P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toUpperCase() === "P") {
        toggleScanning();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  useEffect(() => {
    const loadModel = async () => {
      try {
        const loadedModel = await tf.loadLayersModel("/model/model.json"); // Đường dẫn model của bạn
        setModel(loadedModel);
        console.log("AI Model Loaded!");
      } catch (e) {
        console.error("Failed to load model", e);
      }
    };
    loadModel();
  }, []);

  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const fileArray = Array.from(files);

      // 1. Tìm đúng tệp model.json (tệp chứa cấu trúc model)
      // Loại bỏ metadata.json nếu người dùng lỡ chọn nhầm
      const modelJsonFile = fileArray.find(
        (f) =>
          f.name.toLowerCase().endsWith(".json") &&
          !f.name.toLowerCase().includes("metadata"),
      );

      // 2. Lấy tất cả các tệp .bin (trọng số)
      const weightFiles = fileArray.filter((f) =>
        f.name.toLowerCase().endsWith(".bin"),
      );

      if (!modelJsonFile) {
        alert(
          "Không tìm thấy tệp cấu trúc model (model.json). Hãy đảm bảo bạn không chọn nhầm tệp metadata.json.",
        );
        return;
      }

      if (weightFiles.length === 0) {
        alert("Vui lòng chọn kèm các tệp trọng số (.bin).");
        return;
      }

      // 3. Nạp model: Tệp JSON phải đứng đầu mảng
      const uploadedModel = await tf.loadLayersModel(
        tf.io.browserFiles([modelJsonFile, ...weightFiles]),
      );

      // 4. Cập nhật state
      setModel(uploadedModel);

      console.log("Cập nhật model thành công!");
      alert("AI đã được cập nhật model mới!");
    } catch (error) {
      console.error("Lỗi nạp model:", error);
      alert("Lỗi: Tệp JSON không hợp lệ hoặc thiếu modelTopology.");
    }
  };

  const playSuccessSound = () => {
    const audio = new Audio("/amthanh/Beep.mp3"); // Âm thanh "Beep" thành công
    audio.volume = 0.5; // Chỉnh âm lượng 50%
    audio
      .play()
      .catch((err) => console.log("Chặn phát âm thanh tự động:", err));
  };

  const playErrorSound = () => {
    // Âm thanh "Buzzer" trầm hoặc tiếng "Error"
    const audio = new Audio("/amthanh/Error.mp3");
    audio.volume = 0.4;
    audio.play();
  };

  const runInference = async () => {
    if (!model || !videoRef.current || isEditMode || !isScanning) return;

    const video = videoRef.current;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const displayRect = video.getBoundingClientRect();

    const videoRatio = videoWidth / videoHeight;
    const displayRatio = displayRect.width / displayRect.height;

    let actualWidth,
      actualHeight,
      offsetX = 0,
      offsetY = 0;

    if (displayRatio > videoRatio) {
      actualWidth = displayRect.width;
      actualHeight = displayRect.width / videoRatio;
      offsetY = (actualHeight - displayRect.height) / 2;
    } else {
      actualHeight = displayRect.height;
      actualWidth = displayRect.height * videoRatio;
      offsetX = (actualWidth - displayRect.width) / 2;
    }

    const scale = videoWidth / actualWidth;

    const newStates: Record<number, boolean> = { ...tempStates };
    let hasChanged = false;

    tf.tidy(() => {
      for (const can of candidates || []) {
        const node = nodeRefs.current.get(can.id!)?.current;
        if (!node) continue;

        const rect = node.getBoundingClientRect();

        const sx = (rect.left - displayRect.left + offsetX) * scale;
        const sy = (rect.top - displayRect.top + offsetY) * scale;
        const sw = rect.width * scale;
        const sh = rect.height * scale;

        // --- LOGIC QUÉT 3 HÌNH (TRÁI - GIỮA - PHẢI) ---
        const windowSize = sh; // Kích thước vuông lấy theo chiều cao
        const centerX = sx + sw / 2 - windowSize / 2;

        // Tính toán 3 vị trí X: Trái, Giữa, Phải
        // Sử dụng Math.max/min để đảm bảo không cắt ra ngoài vùng sw
        const positions = [
          sx + windowSize,
          sx, // Trái
          centerX, // Giữa
          sx + sw - windowSize, // Phải
          sx + sw - windowSize * 2,
        ];

        let sumProbability = 0;

        // Tạo canvas tạm để vẽ và hiển thị debug
        const canvas = document.createElement("canvas");
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

          // Hiển thị Debug chính
          let debugCanvas = document.getElementById(
            `debug-canvas-${can.id}`,
          ) as HTMLCanvasElement;
          if (!debugCanvas) {
            debugCanvas = document.createElement("canvas");
            debugCanvas.id = `debug-canvas-${can.id}`;
            debugCanvas.style.border = "2px solid lime";
            debugCanvas.style.width = "250px";
            document
              .getElementById("ai-debug-container")
              ?.appendChild(debugCanvas);
          }
          debugCanvas.width = sw;
          debugCanvas.height = sh;
          const dCtx = debugCanvas.getContext("2d");
          dCtx?.drawImage(canvas, 0, 0);

          // Quét qua 3 vị trí
          for (const posX of positions) {
            const cropCanvas = document.createElement("canvas");
            cropCanvas.width = 224;
            cropCanvas.height = 224;
            const cCtx = cropCanvas.getContext("2d");

            if (cCtx) {
              cCtx.imageSmoothingEnabled = false;
              // Cắt từ video tại vị trí posX, kích thước vuông windowSize x windowSize
              cCtx.drawImage(
                video,
                posX,
                sy,
                windowSize,
                windowSize,
                0,
                0,
                224,
                224,
              );

              const input = tf.browser
                .fromPixels(cropCanvas)
                .toFloat()
                .div(255)
                .expandDims(0);

              const prediction = model.predict(input) as tf.Tensor;
              const scores = prediction.dataSync();

              // Lấy kết quả từ scores[0] (vì model của bạn có 1 class)
              sumProbability += scores[0];
            }
          }

          // Tính trung bình 3 tấm
          const averageProbability = sumProbability / 3;
          // nhưng thông thường nên dùng > 0.85 để nhạy hơn)
          const isDetected = averageProbability >= aiThreshold;

          if (newStates[can.id!] !== isDetected) {
            newStates[can.id!] = isDetected;
            hasChanged = true;
          }
        }
      }
    });

    if (hasChanged) {
      setTempStates(newStates);
    }

// 1. Tính toán số lượng đã chọn
const _selectedCount = candidates?.filter((c) => !newStates[c.id!]).length || 0;

// 2. Xác định tính hợp lệ dựa trên targetGroupSize
const _isVoteValid = targetGroupSize > 0 
  ? _selectedCount === targetGroupSize 
  : (_selectedCount > 0 && _selectedCount <= (config?.seats || 99));

// 3. Xử lý âm thanh và Reset trạng thái
if (_isVoteValid) {
  playSuccessSound();
} else {
  // Chỉ thực hiện reset nếu không hợp lệ
  playErrorSound();

  const isReverse = config?.tallyMethod === "Ngược";
  const resetStates: Record<number, boolean> = {};
  
  candidates?.forEach((c) => {
    resetStates[c.id!] = isReverse;
  });

  setTempStates(resetStates);
}

  };

  const updateAiThreshold = async (value: number) => {
    setAiThreshold(value); // Cập nhật State để UI mượt mà

    if (config?.id) {
      try {
        await db.config.update(config.id, { aiThreshold: value });
      } catch (error) {
        console.error("Lỗi lưu ngưỡng AI:", error);
      }
    }
  };

  useEffect(() => {
    if (config && config.aiThreshold !== undefined) {
      setAiThreshold(config.aiThreshold);
    }
  }, [config]);

  useEffect(() => {
    if (config?.isCameraOn !== false && !isEditMode && model && isScanning) {
      runInference();

      setIsScanning(false);
    } else {
      setError("Chưa bật camera hoặc tắt chế độ chỉnh sửa để quét phiếu!");
      setIsScanning(false);
    }
  }, [config?.isCameraOn, isEditMode, model, isScanning]);

  // Tải danh sách thiết bị
  useEffect(() => {
    const getDevices = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(
          (device) => device.kind === "videoinput",
        );
        setDevices(videoDevices);
        if (videoDevices.length > 0 && !selectedCamera) {
          const backCam =
            videoDevices.find((d) => d.label.toLowerCase().includes("back")) ||
            videoDevices[0];
          setSelectedCamera(backCam.deviceId);
        }
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.error("Lỗi truy cập camera:", err);
      }
    };
    getDevices();
  }, [selectedCamera]);

  // Điều khiển luồng Video và Lưu cấu hình Camera
  useEffect(() => {
    let currentStream: MediaStream | null = null;
    const cameraActive = config?.isCameraOn !== false;

    if (selectedCamera && cameraActive) {
      const constraints = {
        video: {
          deviceId: { exact: selectedCamera },
          width: { ideal: 1024 },
          height: { ideal: 768 },
        },
      };
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          currentStream = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch((err) =>
          console.error("Không thể khởi động camera đã chọn:", err),
        );
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [selectedCamera, config?.isCameraOn]);

  useEffect(() => {
    if (config && candidates) {
      const initial: Record<number, boolean> = {};
      candidates.forEach((c) => {
        initial[c.id!] = config.tallyMethod === "Ngược";
      });
      setTempStates(initial);
    }
  }, [config?.tallyMethod, candidates]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingId === null) return;
      const node = nodeRefs.current.get(resizingId)?.current;
      if (node) {
        const rect = node.getBoundingClientRect();
        node.style.width = `${Math.max(80, e.clientX - rect.left)}px`;
        node.style.height = `${Math.max(30, e.clientY - rect.top)}px`;
      }
    };
    const handleMouseUp = async () => {
      if (resizingId !== null) {
        const node = nodeRefs.current.get(resizingId)?.current;
        if (node) {
          await db.candidates.update(resizingId, {
            width: node.offsetWidth,
            height: node.offsetHeight,
          });
        }
        setResizingId(null);
      }
    };
    if (resizingId !== null) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingId]);

  const selectedCandidateNames =
    candidates?.filter((c) => !tempStates[c.id!]).map((c) => c.name) || [];

  const updateStyle = async (id: number, updates: any) => {
    await db.candidates.update(id, updates);
  };

  const updateGlobalConfig = async (updates: any) => {
    if (config?.id) await db.config.update(config.id, updates);
  };

  const updateHistoryPos = async (x: number, y: number) => {
    if (config?.id)
      await db.config.update(config.id, {
        historyX: x,
        historyY: y,
      } as any);
  };

  const updateHistoryPosDebug = async (x: number, y: number) => {
    if (config?.id)
      await db.config.update(config.id, {
        historyXDebug: x,
        historyYDebug: y,
      } as any);
  };

  const updateCurrentVotePos = async (x: number, y: number) => {
    if (config?.id)
      await db.config.update(config.id, {
        currentVoteX: x,
        currentVoteY: y,
      } as any);
  };

  const startEditVote = (vote: Vote) => {
    try {
      const selectedIds = decrypt(vote.candidateIds);
      const selectedIdNumbers = Array.isArray(selectedIds)
        ? selectedIds.map(Number)
        : [];

      // Chuyển trạng thái tempStates về đúng như phiếu đã lưu
      const editStates: Record<number, boolean> = {};
      candidates?.forEach((can) => {
        // Logic: Nếu ID nằm trong danh sách chọn (không gạch) thì false, ngược lại true
        editStates[can.id!] = !selectedIdNumbers.includes(can.id!);
      });

      setTempStates(editStates);
      setEditingVoteId(vote.id!); // Đánh dấu ID đang sửa

      // Cuộn lên đầu hoặc thông báo cho người dùng
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Lỗi khi nạp dữ liệu sửa:", error);
    }
  };

  const renderFullCandidateList = (vote: Vote) => {
    try {
      if (!vote.candidateIds || !candidates) return null;

      // Giải mã danh sách ID người được chọn
      const selectedIds = decrypt(vote.candidateIds);
      const selectedIdNumbers = Array.isArray(selectedIds)
        ? selectedIds.map(Number)
        : [];

      return (
        <div className="flex flex-col gap-0.5 mt-2 ml-1">
          {candidates.map((can) => {
            const isSelected = selectedIdNumbers.includes(Number(can.id));

            return (
              <div
                key={can.id}
                className={`text-[14px] flex items-center gap-2 transition-all ${
                  isSelected
                    ? "text-white font-bold opacity-100"
                    : "text-zinc-600 line-through decoration-zinc-700 decoration-[1px] opacity-100"
                }`}
              >
                {/* Icon nhỏ để phân biệt nhanh */}
                <span
                  className={`w-1 h-1 rounded-full ${isSelected ? "bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" : "bg-transparent border border-zinc-800"}`}
                />

                <span className="truncate">{can.name}</span>
              </div>
            );
          })}
        </div>
      );
    } catch (error) {
      return (
        <span className="text-[10px] text-red-400 italic">
          Lỗi giải mã dữ liệu
        </span>
      );
    }
  };
  const applyToAll = async (sourceCan: any) => {
    if (!candidates) return;

    // 1. Định nghĩa các thuộc tính style dùng chung
    const sharedStyle = {
      fontSize: sourceCan.fontSize,
      color: sourceCan.color,
      bgColor: sourceCan.bgColor,
      strikeColor: (sourceCan as any).strikeColor || "#ef4444", // Thêm dòng này
      shortcutSize: (sourceCan as any).shortcutSize || 25,
      shortcutColor: (sourceCan as any).shortcutColor || "#facc15",
      opacity: (sourceCan as any).opacity ?? 1,
      width: sourceCan.width,
      height: sourceCan.height,
      x: sourceCan.x, // Tất cả thẳng hàng dọc
    };

    // 2. Tạo danh sách các promises cập nhật
    // Chúng ta sẽ duyệt qua danh sách candidates để tính toán vị trí Y nối tiếp
    const updatePromises = candidates.map((c, index) => {
      // Tính toán Y: Vị trí bắt đầu (của ô đầu tiên) + (thứ tự * chiều cao ô mẫu)
      // Nếu bạn muốn có khoảng cách nhỏ giữa các ô, hãy cộng thêm ví dụ: index * (sourceCan.height + 5)
      const newY = sourceCan.y + index * sourceCan.height;

      return db.candidates.update(c.id!, {
        ...sharedStyle,
        y: newY,
      });
    });

    await Promise.all(updatePromises);
  };
  const updateConfirmBtnPos = async (x: number, y: number) => {
    if (config?.id)
      await db.config.update(config.id, {
        confirmBtnX: x,
        confirmBtnY: y,
      } as any);
  };

  const handleConfirmVote = async () => {
    
    if (!candidates || isEditMode || !isVoteValid) {
      playErrorSound();
      return;
    }

    const selectedIds = candidates
      .filter((c) => !tempStates[c.id!])
      .map((c) => c.id!);

    try {
      const encryptedData = encrypt(selectedIds);

      if (editingVoteId) {
        // TRƯỜNG HỢP: CẬP NHẬT PHIẾU CŨ
        await db.votes.update(editingVoteId, {
          candidateIds: encryptedData as any,
          groupNumber: selectedIds.length
          // timestamp: Date.now(), // Cập nhật lại thời gian sửa
        });
        setEditingVoteId(null); // Thoát chế độ sửa
      } else {
        // TRƯỜNG HỢP: THÊM MỚI NHƯ CŨ
        
        await db.votes.add({
          candidateIds: encryptedData as any,
          timestamp: Date.now(),
          groupNumber: selectedIds.length,
          voteNumberInGroup: votesInCurrentGroupType + 1,
        });
      }
      setCurentGroup(selectedIds.length);

      // 2. BACKUP TOÀN BỘ DỮ LIỆU QUA ELECTRON
      // Việc này giúp bạn có 1 file JSON trên máy chứa mọi thứ để khôi phục
      if (window.electronAPI) {
        const allVotes = await db.votes.toArray();
        const allCandidates = await db.candidates.toArray();
        const currentConfig = await db.config.toCollection().first();

      const electionLevel = localStorage.getItem("selected_election_slug") || "xa";

      const result = await window.electronAPI.saveDataBackup({
        app: "BauCu2026",
        version: 1,

        meta: {
          exportDate: new Date().toLocaleString("vi-VN"),
          electionLevel, // xa | tinh | qh
          dbName: `BauCu2026_DB_${electionLevel}`,
        },

        payload: {
          votes: allVotes,
          candidates: allCandidates,
          config: currentConfig,
        },
      });



       if (result.success) {
          setIsBackedUp([true, result.filePath]);
        } else {
          alert(`Backup thất bại:\n${result.error}`);
          setIsBackedUp([false, result.error]);
        }

      }

      playSuccessSound();
      // Reset trạng thái sau khi lưu
      const resetStates: Record<number, boolean> = {};
      candidates.forEach((c) => {
        resetStates[c.id!] = config?.tallyMethod === "Ngược";
      });
      setTempStates(resetStates);
    } catch (error) {
      console.error("Lỗi lưu phiếu:", error);
    }
  };

  // const isVoteValid = selectedCount === targetGroupSize;
  // Lắng nghe sự kiện bàn phím (Đã cập nhật để xử lý phím chữ cái)
 // 1. Dùng useRef để giữ logic mới nhất mà không làm chạy lại useEffect
const handleConfirmRef = useRef(handleConfirmVote);
handleConfirmRef.current = handleConfirmVote;

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (isEditMode) return;
    const key = e.key.toUpperCase();

    if (key === "ENTER") {
      // CHỐNG TRÙNG LẶP: Ngăn chặn Enter kích hoạt click vào các button đang focus
      e.preventDefault(); 
      e.stopPropagation();

      if (isVoteValid) {
        handleConfirmRef.current(); // Gọi qua Ref
      } else {
        playErrorSound();
      }
      return;
    }

    if (key === "0" && candidates) {
      e.preventDefault();
      const isReverse = config?.tallyMethod === "Ngược";
      const resetStates: Record<number, boolean> = {};
      candidates.forEach((c) => {
        resetStates[c.id!] = isReverse;
      });
      setTempStates(resetStates);
      return;
    }

    if (candidates) {
      const index = candidates.findIndex(
        (_, idx) => getShortcutKey(idx) === key
      );

      if (index !== -1) {
        e.preventDefault();
        const canId = candidates[index].id!;
        setTempStates((prev) => ({
          ...prev,
          [canId]: !prev[canId],
        }));
      }
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
  
  // 2. Chỉ quan tâm đến isEditMode và isVoteValid. 
  // Không đưa handleConfirmVote vào đây để tránh reset listener liên tục.
}, [isEditMode, isVoteValid, candidates, config?.tallyMethod]);

  if (!config || !candidates) return null;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none">
      <div
        className="absolute inset-0 pointer-events-none bg-black"
        style={{ zIndex: isEditMode && isEditVideo ? 70 : 0 }}
      >
        {config.isCameraOn !== false && (
          <Draggable
            nodeRef={videoContainerRef}
            disabled={!isEditMode}
            position={{
              x: (config as any).videoX || 0,
              y: (config as any).videoY || 0,
            }}
            handle=".video-drag-handle"
            onStop={(e, data) => {
              updateGlobalConfig({ videoX: data.x, videoY: data.y });
            }}
          >
            <div
              ref={videoContainerRef}
              className={`absolute flex items-center justify-center transition-all
                ${isEditMode ? "z-[105] ring-4 ring-blue-500 ring-dashed bg-blue-500/10 shadow-2xl" : "z-0"}`}
              style={{
                width: `${(config as any).videoWidth ?? 50}%`,
                height: `${(config as any).videoHeight ?? 50}%`,
                pointerEvents: isEditMode ? "auto" : "none",
                touchAction: "none",
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover pointer-events-none"
              />
              {isEditMode && isEditVideo && (
                <div className="video-drag-handle absolute inset-0 flex flex-col items-center justify-center cursor-move bg-transparent">
                  <div className="bg-blue-600 text-white text-xs px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2 select-none">
                    <Settings2 size={16} /> GIỮ ĐỂ DI CHUYỂN VÙNG QUÉT
                  </div>
                </div>
              )}
            </div>
          </Draggable>
        )}
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: isEditMode && isEditVideo ? 50 : 0 }}
      >
        {candidates.map((can, idx) => {
          if (!nodeRefs.current.has(can.id!)) {
            nodeRefs.current.set(
              can.id!,
              createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>,
            );
          }
          const currentRef = nodeRefs.current.get(can.id!)!;
          const bgOpacity = (can as any).opacity ?? 1;
          const backgroundColor = hexToRGBA(
            can.bgColor || "#ffffff",
            bgOpacity,
          );
          const shortcutLabel = getShortcutKey(idx);

          return (
            <Draggable
              key={can.id}
              nodeRef={currentRef}
              defaultPosition={{ x: can.x, y: can.y }}
              position={{ x: can.x, y: can.y }}
              disabled={!isEditMode || resizingId !== null}
              onStop={(e, data) => {
                updateStyle(can.id!, { x: data.x, y: data.y });
              }}
              handle=".drag-handle"
            >
              <div
                ref={currentRef}
                className={`absolute flex flex-col border-2 transition-all shadow-md
                  ${isEditMode ? "border-blue-500 shadow-xl" : "border-transparent overflow-hidden"}`}
                style={{
                  width: can.width,
                  height: can.height,
                  backgroundColor: backgroundColor,
                  color: can.color,
                  fontSize: `${can.fontSize}px`,
                  pointerEvents: "auto",
                }}
              >
                {isEditMode && (
                  <div className="absolute -top-14 left-[-2px] right-[-2px] flex items-center gap-2 bg-zinc-900 px-2 py-2 rounded-t-xl z-50 border-x border-t border-white/10">
                    <div className="drag-handle cursor-move bg-blue-600 p-1 rounded text-white">
                      <Settings2 size={12} />
                    </div>
                    <button
                      onClick={() => applyToAll(can)}
                      className="flex flex-col items-center bg-zinc-700 hover:bg-zinc-600 p-1 px-2 rounded transition-colors group"
                    >
                      <span className="text-[6px] text-white/50 group-hover:text-white">
                        ALL
                      </span>
                      <LayoutGrid size={10} className="text-white" />
                    </button>
                    <div className="flex flex-col items-center">
                      <span className="text-[7px] text-white/50">CỠ</span>
                      <input
                        type="number"
                        value={can.fontSize}
                        onChange={(e) =>
                          updateStyle(can.id!, {
                            fontSize: parseInt(e.target.value),
                          })
                        }
                        className="w-8 bg-white/10 text-white text-[10px] outline-none rounded text-center"
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[7px] text-white/50">CHỮ</span>
                      <input
                        type="color"
                        value={can.color}
                        onChange={(e) =>
                          updateStyle(can.id!, { color: e.target.value })
                        }
                        className="w-4 h-4 bg-transparent border-none p-0"
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[7px] text-white/50">NỀN</span>
                      <input
                        type="color"
                        value={can.bgColor}
                        onChange={(e) =>
                          updateStyle(can.id!, { bgColor: e.target.value })
                        }
                        className="w-4 h-4 bg-transparent border-none p-0"
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[7px] text-white/50">GẠCH</span>
                      <input
                        type="color"
                        // Giả sử field trong DB là strikeColor, nếu chưa có nó sẽ lấy mặc định là đỏ (#ef4444)
                        value={(can as any).strikeColor || "#ef4444"}
                        onChange={(e) =>
                          updateStyle(can.id!, { strikeColor: e.target.value })
                        }
                        className="w-4 h-4 bg-transparent border-none p-0"
                      />
                    </div>
                    {/* Thêm vào trong thanh config màu xám của từng Candidate */}
                    <div className="flex flex-col items-center">
                      <span className="text-[7px] text-white/50">Cỡ nhãn</span>
                      <input
                        type="number"
                        value={(can as any).shortcutSize || 25}
                        onChange={(e) =>
                          updateStyle(can.id!, {
                            shortcutSize: parseInt(e.target.value),
                          })
                        }
                        className="w-8 bg-white/10 text-white text-[10px] outline-none rounded text-center"
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[7px] text-white/50">Màu nhãn</span>
                      <input
                        type="color"
                        value={(can as any).shortcutColor || "#facc15"} // Mặc định vàng (yellow-400)
                        onChange={(e) =>
                          updateStyle(can.id!, {
                            shortcutColor: e.target.value,
                          })
                        }
                        className="w-4 h-4 bg-transparent border-none p-0 cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col flex-1">
                      <span className="text-[7px] text-white/50 text-center uppercase">
                        Độ trong nền
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={bgOpacity}
                        onChange={(e) =>
                          updateStyle(can.id!, {
                            opacity: parseFloat(e.target.value),
                          })
                        }
                        className="w-full h-1 bg-blue-500 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                <div
                  onClick={() =>
                    !isEditMode &&
                    setTempStates((p) => ({ ...p, [can.id!]: !p[can.id!] }))
                  }
                  className={`
  w-full h-full flex items-center justify-end px-4 font-bold cursor-pointer text-right transition-all relative overflow-hidden
  ${tempStates[can.id!] ? "line-through decoration-[3px] opacity-70" : ""}
  
  /* Hiệu ứng Quét AI */
  ${
    isScanning
      ? `
    before:absolute before:inset-0 before:bg-blue-500/10 before:animate-pulse
    after:absolute after:top-0 after:left-0 after:w-full after:h-[2px] 
    after:bg-gradient-to-r after:from-transparent after:via-blue-400 after:to-transparent 
    after:animate-scan after:shadow-[0_0_15px_rgba(96,165,250,0.8)]
  `
      : ""
  }
`}
                  style={{
                    // Điều khiển màu gạch của text bằng strikeColor từ DB
                    textDecorationColor: tempStates[can.id!]
                      ? (can as any).strikeColor || "#ef4444"
                      : "transparent",
                  }}
                >
                  {/* Đường gạch ngang bổ trợ (giúp nét gạch rõ hơn trên nền video) */}
                  {tempStates[can.id!] && (
                    <div
                      style={{
                        width: `${can.width}px`,
                        backgroundColor: (can as any).strikeColor || "#ef4444",
                      }}
                      className="h-1 mx-auto absolute left-0 right-0 top-1/2 transform -translate-y-1/2 pointer-events-none"
                    ></div>
                  )}

                  {!isEditMode && shortcutLabel && (
                    <span
                      className="absolute left-2 mx-auto opacity-100 font-mono bg-black/10 px-1 rounded"
                      style={{
                        fontSize: `${(can as any).shortcutSize || 25}px`,
                        color: (can as any).shortcutColor || "#facc15",
                      }}
                    >
                      {shortcutLabel}
                    </span>
                  )}

                  {can.name}
                </div>

                {isEditMode && (
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setResizingId(can.id!);
                    }}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 flex items-center justify-center cursor-nwse-resize z-[60] rounded-tl-xl"
                  >
                    <MoveDiagonal2 size={14} className="text-white" />
                  </div>
                )}
              </div>
            </Draggable>
          );
        })}
      </div>

      <div className="absolute top-4 right-4 z-[110] flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <Link
            prefetch={false}
            href="/admin"
            className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm border border-zinc-200 rounded-xl shadow-md font-bold text-sm text-black hover:bg-white transition-all active:scale-95"
          >
            <ArrowLeft size={16} />
          </Link>
          <button
            onClick={(e) => {
              setIsEditMode(!isEditMode);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl shadow-md font-semibold text-sm border transition-all duration-200 active:scale-95 ${isEditMode ? "bg-orange-500 border-orange-200 text-white" : "bg-white border-zinc-200 text-black"}`}
          >
            {isEditMode ? <Save size={16} /> : <Settings2 size={16} />}
            <span className="uppercase">
              {isEditMode ? "Lưu cấu hình" : "Cấu hình kiểm phiếu"}
            </span>
          </button>
        </div>

        <div
          className={` origin-top-right transition-all duration-300 ease-out ${isEditMode ? "opacity-100 scale-100 translate-y-0" : "pointer-events-none opacity-0 scale-95 -translate-y-2"}`}
        >
          <div className="flex flex-col gap-4 bg-zinc-900/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl min-w-[200px]">
            <div className="flex flex-col gap-3 pr-4 border-r border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-400 font-bold uppercase">
                  Trạng thái Camera
                </span>
                <button
                  onClick={() =>
                    updateGlobalConfig({
                      isCameraOn: config.isCameraOn === false,
                    })
                  }
                  className={`p-1.5 rounded-lg transition-colors ${config.isCameraOn !== false ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
                >
                  {config.isCameraOn !== false ? (
                    <Video size={16} />
                  ) : (
                    <VideoOff size={16} />
                  )}
                </button>
              </div>
              {config.isCameraOn && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase flex items-center gap-1">
                    <Camera size={10} /> Thiết bị
                  </span>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    className="bg-zinc-800 text-white text-[11px] px-2 py-1.5 rounded-lg outline-none border border-zinc-700"
                  >
                    {devices.map((device, idx) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="h-4 border-b border-white/10" />
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isEditVideo}
                    onChange={() => setIsEditVideo(!isEditVideo)}
                  />
                  <div className="w-11 h-4 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
                <span className="text-[10px] text-zinc-400 font-bold uppercase pl-1">
                  {isEditVideo
                    ? " Tắt chỉnh vùng quét"
                    : " Bật chỉnh vùng quét"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400 font-bold uppercase flex items-center gap-1">
                  <Maximize size={10} /> Chiều rộng quét (
                  {(config as any).videoWidth || 100}%)
                </span>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={(config as any).videoWidth || 50}
                  onChange={(e) =>
                    updateGlobalConfig({ videoWidth: Number(e.target.value) })
                  }
                  className="w-full h-1 bg-blue-500 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400 font-bold uppercase flex items-center gap-1">
                  <ArrowsUpFromLine size={10} /> Chiều cao quét (
                  {(config as any).videoHeight || 100}%)
                </span>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={(config as any).videoHeight || 50}
                  onChange={(e) =>
                    updateGlobalConfig({ videoHeight: Number(e.target.value) })
                  }
                  className="w-full h-1 bg-blue-500 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
            <div className="h-4 border-b border-white/10" />

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400 font-bold uppercase flex items-center gap-1">
                  <Hash size={10} /> Nhóm phiếu
                </span>
                <select
                  value={config.groupSize}
                  onChange={(e) =>
                    updateGlobalConfig({ groupSize: Number(e.target.value) })
                  }
                  className="bg-zinc-800 text-white text-[11px] px-2 py-1.5 rounded-lg outline-none border border-zinc-700"
                >
                  <option key={0} value={0}>
                      Tự do
                    </option>
                  {Array.from(
                    { length: config.seats || 1 },
                    (_, i) => i + 1,
                  ).map((n) => (
                    <option key={n} value={n}>
                      Bầu {n} người
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400 font-bold uppercase flex items-center gap-1">
                  <CheckSquare size={10} /> Cách thức kiểm
                </span>
                <select
                  value={config.tallyMethod}
                  onChange={(e) =>
                    updateGlobalConfig({ tallyMethod: e.target.value })
                  }
                  className="bg-zinc-800 text-white text-[11px] px-2 py-1.5 rounded-lg outline-none border border-zinc-700"
                >
                  <option value="Xuôi">Kiểm xuôi (mặc định)</option>
                  <option value="Ngược">Kiểm ngược (gạch sẵn)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Draggable
        nodeRef={confirmBtnRef}
        // disabled={!isEditMode}
        position={{
          x:
            (config as any).confirmBtnX ??
            (typeof window !== "undefined" ? window.innerWidth / 2 - 225 : 0),
          y:
            (config as any).confirmBtnY ??
            (typeof window !== "undefined" ? window.innerHeight - 150 : 0),
        }}
        onStop={(e, data) => {
          updateConfirmBtnPos(data.x, data.y);
        }}
      >
        <div
          ref={confirmBtnRef}
          className={`absolute z-[100] flex flex-col items-center gap-3 ${isEditMode ? "cursor-move p-6 border-2 border-dashed border-blue-400 bg-blue-500/20 rounded-3xl" : ""}`}
          style={{ pointerEvents: "auto", touchAction: "none" }}
        >
          <button
            onClick={handleConfirmVote}
            // KHÓA NÚT: Nếu phiếu không hợp lệ (sai số lượng chọn) HOẶC đang ở chế độ chỉnh sửa vị trí (isEditMode)
            // disabled={!isVoteValid || isEditMode}
            className={`px-6 py-4 w-[450px] h-[100px] rounded-3xl font-bold shadow-lg active:scale-95 flex items-center gap-6 border-2 transition-all relative overflow-hidden
        ${
          !isVoteValid || isEditMode
            ? "bg-zinc-800 text-zinc-400 border-zinc-700 cursor-not-allowed opacity-90"
            : editingVoteId
              ? "bg-amber-500 hover:bg-amber-600 text-black border-black/20 cursor-pointer" // Sáng lên khi sửa đúng số lượng
              : "bg-red-600 hover:bg-red-700 text-white border-white/30 cursor-pointer" // Sáng lên khi lưu mới đúng số lượng
        }`}
          >
            {/* CỘT TRÁI: SỐ PHIẾU */}
            <div
              className={`flex flex-col items-center justify-center border-r pr-1 min-w-[80px] ${
                editingVoteId && isVoteValid
                  ? "border-black/10"
                  : "border-white/10"
              }`}
            >
              <span className="text-[10px] uppercase opacity-60 leading-none mb-1">
                Phiếu số
              </span>
              <span className="text-5xl font-black tracking-tighter leading-none">
                
                {editingVoteId ? recentVotes?.find((v) => v.id === editingVoteId) ?.voteNumberInGroup
                  : targetGroupSize == 0 && votesInCurrentGroupType < 1? "#": votesInCurrentGroupType + 1}
              </span>
            </div>

            {/* CỘT PHẢI: NỘI DUNG */}
            <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
              {!isEditMode && !isVoteValid ? (
                // HIỂN THỊ CẢNH BÁO KHI SAI SỐ LƯỢNG (Áp dụng cho cả Lưu mới và Sửa)
                <div className="flex flex-col items-center text-center">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold shadow-md border whitespace-nowrap mb-2
              ${editingVoteId ? "bg-black text-amber-500 border-amber-500/30" : "bg-amber-500 text-white border-white/20"}`}
                  >
                    <AlertCircle size={16} />
                    <span className="uppercase">
                      {editingVoteId ? "SỬA PHIẾU: " : ""} ĐÃ CHỌN{" "}
                      {selectedCount} / {targetGroupSize}
                    </span>
                  </div>
                  <div className="flex flex-col items-center leading-tight opacity-80">
                    <span className="text-[11px] uppercase font-bold tracking-wider">
                      VUI LÒNG CHỌN ĐÚNG {targetGroupSize} ỨNG CỬ VIÊN
                    </span>
                  </div>
                </div>
              ) : editingVoteId ? (
                // GIAO DIỆN KHI ĐANG SỬA VÀ ĐÃ HỢP LỆ
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-black/10 rounded-xl">
                    <Pencil size={32} />
                  </div>
                  <div className="flex flex-col items-start text-black">
                    <span className="text-2xl uppercase tracking-tighter leading-none font-black">
                      CẬP NHẬT PHIẾU
                    </span>
                    <span className="text-[10px] opacity-80 font-bold">
                      NHẤN ENTER ĐỂ LƯU THAY ĐỔI
                    </span>
                  </div>
                </div>
              ) : (
                // GIAO DIỆN KHI SẴN SÀNG LƯU MỚI VÀ ĐÃ HỢP LỆ
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <Save size={32} />
                  </div>
                  <div className="flex flex-col items-start text-white">
                    <span className="text-2xl uppercase tracking-tighter leading-none">
                      XÁC NHẬN PHIẾU {votesInCurrentGroupType + 1}
                    </span>
                    <span className="text-[10px] opacity-60">
                      NHẤN PHÍM ENTER ĐỂ LƯU
                    </span>
                  </div>
                </div>
              )}
            </div>
          </button>

          {/* NÚT HỦY SỬA */}
          {editingVoteId && (
            <button
              onClick={() => {
                setEditingVoteId(null);
                const resetStates: Record<number, boolean> = {};
                candidates?.forEach((c) => {
                  resetStates[c.id!] = config?.tallyMethod === "Ngược";
                });
                setTempStates(resetStates);
              }}
              className="text-white text-[10px] px-4 py-2 rounded-full font-bold uppercase tracking-widest shadow-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 flex items-center gap-2 active:scale-95 transition-all"
            >
              <X size={12} />
              Hủy chế độ sửa (Quay lại phiếu {votesInCurrentGroupType + 1})
            </button>
          )}
        </div>
      </Draggable>

      <VoteHistoryPanel
        historyRef={historyRef}
        config={config}
        isEditMode={isEditMode}
        recentVotes={recentVotes}
        editingVoteId={editingVoteId}
        updateHistoryPos={updateHistoryPos}
        startEditVote={startEditVote}
        renderFullCandidateList={renderFullCandidateList}
      />

      <Draggable
        nodeRef={historyRefDebug}
        cancel=".no-drag"
        position={{
          x: (config as any).historyXDebug ?? 20,
          y: (config as any).historyYDebug ?? 100,
        }}
        onStop={(e, data) => {
          updateHistoryPosDebug(data.x, data.y);
        }}
      >
        <div
          ref={historyRefDebug}
          className={`absolute z-[150] rounded-3xl p-1 border-2 border-blue-500 transition-all duration-300 ${
            isEditMode
              ? "ring-2 ring-blue-500/60 ring-dashed p-4 bg-blue-500/5 rounded-3xl cursor-move"
              : "p-0"
          }`}
        >
          <div className="bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl min-w-[300px] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/5 bg-white/[0.03] select-none">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                <span className="text-[12px] font-black uppercase tracking-widest text-zinc-300">
                  AI nhận diện
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Nút Cấu hình mới bổ sung */}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`no-drag p-1.5 rounded-lg transition-colors ${
                    showSettings
                      ? "bg-blue-500/20 text-blue-400"
                      : "text-zinc-500 hover:text-white"
                  }`}
                  title="Cấu hình độ nhạy"
                >
                  <Settings size={14} />
                </button>

                <button
                  onClick={(e) => {
                    toggleScanning();
                    e.currentTarget.blur();
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl shadow-md font-bold text-[10px] border transition-all active:scale-95 ${
                    isScanning
                      ? "bg-red-500 border-red-400 text-white animate-pulse"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400"
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${isScanning ? "bg-white" : "bg-zinc-500"}`}
                  />
                  <span className="uppercase">
                    {isScanning ? "RUNNING" : "PAUSED"}
                  </span>
                </button>

                {/* Expand / Collapse */}
                <button
                  onClick={() => setIsExpanded((v) => !v)}
                  className="no-drag flex items-center gap-1 text-[9px] text-zinc-400 hover:text-white transition"
                >
                  <svg
                    className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Phần điều chỉnh độ chính xác - Hiển thị khi bấm nút Settings */}
            {showSettings && (
              <div className="px-4 py-4 bg-white/[0.02] border-b border-white/5 animate-in fade-in slide-in-from-top-1 flex flex-col gap-4">
                {/* Hàng 1: Nạp Model & Hiển thị độ nhạy */}
                <div className="flex justify-between items-end">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1">
                      <Database size={10} /> Model Engine
                    </span>
                    <div className="relative">
                      <input
                        type="file"
                        id="model-upload"
                        multiple
                        onChange={handleModelUpload}
                        className="hidden"
                        accept=".json,.bin"
                      />
                      <label
                        htmlFor="model-upload"
                        className="no-drag flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-white/10 hover:border-blue-500/50 hover:bg-zinc-800 rounded-lg cursor-pointer transition-all group"
                      >
                        <Upload
                          size={12}
                          className="text-zinc-500 group-hover:text-blue-400"
                        />
                        <span className="text-[10px] text-zinc-300 font-bold uppercase">
                          Cập nhật tệp
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1">
                      <Target size={10} /> Độ nhạy
                    </span>
                    <span className="text-[11px] text-blue-400 font-mono font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {Math.round(aiThreshold * 100)}%
                    </span>
                  </div>
                </div>

                {/* Hàng 2: Thanh trượt */}
                <div className="flex flex-col gap-2">
                  <input
                    type="range"
                    min="0.5"
                    max="0.99"
                    step="0.01"
                    value={aiThreshold}
                    onChange={(e) =>
                      updateAiThreshold(parseFloat(e.target.value))
                    }
                    className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500 no-drag"
                  />
                  <div className="flex justify-between">
                    <p className="text-[9px] text-zinc-500 leading-tight italic">
                      * Cao: Chính xác | Thấp: Nhạy hơn
                    </p>
                    <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-tighter">
                      Fine-tuning
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Body */}
            <div
              className={`relative text-center transition-all duration-300 ease-in-out overflow-hidden ${
                isExpanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div
                id="ai-debug-container"
                className="mx-auto my-2 rounded-md text-[10px]"
                style={{
                  zIndex: 200,
                  background: "rgba(255,0,0,0.1)",
                  width: 250,
                  minHeight: "100px",
                }}
              />
            </div>
          </div>
        </div>
      </Draggable>

      {/* BỔ SUNG: Panel hiển thị thông tin phiếu hiện tại đang chọn */}
      <Draggable
        nodeRef={currentVotePanelRef}
        position={{
          x: (config as any).currentVoteX ?? 20,
          y: (config as any).currentVoteY ?? 500,
        }}
        // disabled={!isEditMode}
        onStop={(e, data) => updateCurrentVotePos(data.x, data.y)}
      >
        <div
          ref={currentVotePanelRef}
          className={`absolute z-[120] rounded-3xl p-1 border-2 border-blue-500 transition-all duration-300 ${isEditMode ? "ring-2 ring-blue-500/60 ring-dashed p-4 bg-blue-500/5 rounded-3xl cursor-move" : ""}`}
        >
          <div className="bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl min-w-[300px] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.03]">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-blue-400" />
                <span className="text-[12px] font-black uppercase tracking-widest text-zinc-300">
                  Phiếu đang kiểm
                </span>
              </div>
              <button
                onClick={() => setShowCurrentVotePanel(!showCurrentVotePanel)}
                className="no-drag flex items-center gap-1 text-[9px] text-zinc-400 hover:text-white transition"
              >
                <svg
                  className={`w-3 h-3 transition-transform duration-200 ${showCurrentVotePanel ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Content */}
            {showCurrentVotePanel && (
              <div className="p-1 flex flex-col gap-4">
                <div className="flex items-center justify-between bg-white/5 px-3 rounded-xl border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase">
                      Bầu
                    </span>
                    <span className="text-4xl font-black text-white">
                      {targetGroupSize === 0 ? "Tự do" : targetGroupSize}
                    </span>
                  </div>
                  <div className="h-8 w-[1px] bg-white/10" />
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase">
                      Đã chọn
                    </span>
                    <span
                      className={`text-4xl font-black ${isVoteValid ? "text-green-500" : "text-orange-500"}`}
                    >
                      {selectedCount}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase">
                    Danh sách ứng viên đã chọn:
                  </span>
                  <div className="flex flex-col gap-3">
                    {selectedCandidateNames.length > 0 ? (
                      selectedCandidateNames.map((name, i) => (
                        <div
                          key={i}
                          className="px-3 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg"
                        >
                          <span className="text-lg font-bold text-blue-400 tracking-tight">
                            {name}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-sm text-zinc-600 italic">
                        Chưa chọn ai...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Draggable>
      <section className="fixed bottom-0 left-0 right-0 z-[50000] flex items-center justify-end gap-2 px-4 py-2 bg-black/70 backdrop-blur">
        <span className="text-xs text-zinc-300">
          Tổng số phiếu đã kiểm: 
        </span>

        <span
          className={`text-xs font-bold ml-0 text-green-400` }
        >
          {votesAll} 
          <span className={`text-xs font-bold ml-0 text-red-400` } >
          {" ("}
        {Object.entries(groupStats)
          .sort(([a], [b]) => Number(a) - Number(b)) // Sắp xếp theo số người bầu (1, 2, 3...)
          .map(([groupNum, count]) => (
            
                 ` ${count as number} phiếu bầu ${groupNum};  `
             
          ))}
          {")"}
          </span>
          </span>
        <span className="text-xs text-zinc-300">
          Đang kiểm loại phiếu:
        </span>

        <span className={`text-xs font-bold ml-0 text-green-400` } >
          {targetGroupSize > 0? `Bầu ${targetGroupSize}`: "Kiểm tự do   "}
        </span>
        <span className="text-xs text-zinc-300">
          Hình thức kiểm phiếu: 
        </span>

        <span
          className={`text-xs font-bold ml-0 text-green-400` }
        >
          Kiểm {config?.tallyMethod} 
        </span>

        
        <span className="text-xs text-zinc-300">
          {"     "}- Trạng thái backup:
        </span>

        <span
          className={`text-xs font-bold ml-0 ${
            isBackedUp[0] ? "text-green-400" : "text-red-400"
          }`}
        >
          Lưu tại: {isBackedUp[1]}
        </span>
      </section>

    </div>
  );
}
