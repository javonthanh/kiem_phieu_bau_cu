import Dexie, { type Table } from 'dexie';
import CryptoJS from 'crypto-js';

const SECRET_KEY = "46458546ffsfsdf"; 

// Hàm mã hóa/giải mã
export const encrypt = (data: any) => CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
export const decrypt = (cipher: string) => {
  const bytes = CryptoJS.AES.decrypt(cipher, SECRET_KEY);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
};

// 1. Hàm xác định tên DB dựa trên lựa chọn của người dùng
const getDatabaseName = () => {
  if (typeof window !== 'undefined') {
    // Lấy slug từ localStorage, ví dụ: 'quoc-hoi', 'tinh', 'xa'
    const slug = localStorage.getItem('selected_election_slug') || 'default';
    return `ElectionDB_${slug}`;
  }
  return 'ElectionDB_default';
};

export interface Candidate {
  id?: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  bgColor: string;
}

export interface ElectionConfig {
  id?: number;
  type: 'Quốc hội' | 'Tỉnh' | 'Xã';
  candidateCount: number;
  seats: number; 
  aiThreshold: number;
  candidateLimit: number; 
  tallyMethod: 'Xuôi' | 'Ngược';
  groupSize: number;
}

export interface Vote {
  id?: number;
  candidateIds: any; // Lưu chuỗi đã mã hóa AES
  timestamp: number;
  // --- BỔ SUNG CÁC TRƯỜNG MỚI ---
  groupNumber: number;        // Ví dụ: Nhóm 1, Nhóm 2...
  voteNumberInGroup: number;  // Ví dụ: Phiếu số 1, 2... trong nhóm đó
}

export interface ElectionConfig {
  id?: number;
  // --- CAMERA / VIDEO ---
  isCameraOn: boolean;
  videoX: number;
  videoY: number;
  videoWidth: number;
  videoHeight: number;

  // --- VỊ TRÍ UI ---
  historyX: number;
  historyY: number;
  historyXDebug: number;
  historyYDebug: number;
  currentVoteX: number;
  currentVoteY: number;
  confirmBtnX: number;
  confirmBtnY: number;
}

export const DEFAULT_CONFIG: ElectionConfig = {
  id:1,
  confirmBtnX:545,
  confirmBtnY:499,
  currentVoteX:547,
  currentVoteY:8,
  historyX:1254,
  historyXDebug:890,
  historyY:90,
  historyYDebug:11,
  videoHeight:96,
  videoWidth:33,
  videoX:19,
  videoY:16,
};

export const getConfig = async (): Promise<ElectionConfig> => {
  const stored = await db.config.get(1);

  if (!stored) {
    await db.config.put(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  // MERGE: field mới lấy default, field cũ giữ nguyên
  const merged = { ...DEFAULT_CONFIG, ...stored };

  // Nếu có field mới → update lại DB
  await db.config.put(merged);

  return merged;
};


export class ElectionDB extends Dexie {
  candidates!: Table<Candidate>;
  config!: Table<ElectionConfig>;
  votes!: Table<Vote>;

  constructor() {
    super(getDatabaseName());
    
    this.version(2).stores({ // Nâng version lên 2 vì thay đổi cấu trúc store
      candidates: '++id, name',
      config: 'id',
      // Thêm groupNumber vào index để truy vấn nhanh theo nhóm nếu cần
      votes: '++id, timestamp, groupNumber' 
    });
  }
}

export const db = new ElectionDB();