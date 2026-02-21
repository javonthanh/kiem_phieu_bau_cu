"use client";

import { db, decrypt } from "@/lib/db";
import { saveAs } from "file-saver";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import expressions from "angular-expressions";
// --- HÀM TRỢ GIÚP ---
// const loadFile = (url: string): Promise<ArrayBuffer> => {
//   return new Promise((resolve, reject) => {
//     const xhr = new XMLHttpRequest();
//     xhr.open("GET", url, true);
//     xhr.responseType = "arraybuffer";
//     xhr.onload = () => {
//       if (xhr.status === 200) resolve(xhr.response);
//       else reject(new Error(`Không thể tải file mẫu tại: ${url}`));
//     };
//     xhr.send();
//   });
// };

expressions.filters.upper = function (input) {
  if (!input) return "";
  return input.toUpperCase();
};

function angularParser(tag: string) {
  const expr = expressions.compile(tag.replace(/(’|“|”|‘)/g, "'"));
  return {
    get: (scope: any) => {
      // Chạy biểu thức với dữ liệu truyền vào
      return expr(scope);
    },
  };
}

const loadFile = async (url: string): Promise<ArrayBuffer> => {
  try {
    // Luôn đảm bảo có dấu / ở đầu để fetch từ gốc (public)
    const fetchUrl = url.startsWith("/") ? url : `/${url}`;
    // alert(fetchUrl);
    console.log("Đang tải từ Root:", fetchUrl);

    const response = await fetch(fetchUrl);

    if (!response.ok) {
      throw new Error(
        `Không tìm thấy file mẫu tại ${fetchUrl}. Hãy đảm bảo file nằm trong public/templates/`
      );
    }
    return await response.arrayBuffer();
  } catch (err) {
    console.error("Lỗi loadFile:", err);
    throw err;
  }
};

/**
 * HÀM LÕI XỬ LÝ DỮ LIỆU CHUNG CHO TẤT CẢ CÁC MẪU
 * @param templatePath Đường dẫn file .docx trong thư mục public
 * @param fileName Tên file xuất ra
 */
const generateVotingReport = async (templatePath: string, fileName: string) => {
  try {
    const config = await db.config.toCollection().first();
    const candidates = await db.candidates.toArray();
    const votes = await db.votes.toArray();

    if (!config) {
      alert("Chưa có dữ liệu cấu hình!");
      return;
    }

    // --- 1. THỐNG KÊ PHIẾU THỰC TẾ TỪ DATABASE ---
    let totalActualValidVotesCount = 0; // Tổng số phiếu hợp lệ thực tế trong DB
    const statsMap: Record<number, number> = {};

    votes.forEach((v) => {
      try {
        const selectedIds: number[] = decrypt(v.candidateIds as any);
        if (selectedIds && selectedIds.length > 0) {
          totalActualValidVotesCount++; // Mỗi bản ghi trong bảng votes là 1 phiếu hợp lệ
          selectedIds.forEach((id) => {
            statsMap[id] = (statsMap[id] || 0) + 1;
          });
        }
      } catch (e) {
        console.error("Lỗi giải mã phiếu:", e);
      }
    });

    // --- 2. LẤY SỐ LIỆU TỪ CẤU HÌNH (USER NHẬP) ---
    const totalV = Number(config.totalVoters || 0);
    const actualV = Number(config.actualVoters || 0);
    const issuedV = Number(config.issuedVotes || 0);
    const receivedV = Number(config.receivedVotes || 0);
    const validV = Number(config.validVotes || 0);
    const invalidV = Number(config.invalidVotes || 0);

    // --- 3. KIỂM TRA TÍNH HỢP LỆ (VALIDATION) ---
    const errors: string[] = [];

    // Ràng buộc số dương
    if (totalV <= 0) errors.push("- LỖI: Tổng số cử tri phải lớn hơn 0.");
    if (actualV <= 0) errors.push("- LỖI: Số cử tri đi bầu phải lớn hơn 0.");
    if (issuedV <= 0) errors.push("- LỖI: Số phiếu phát ra phải lớn hơn 0.");
    if (receivedV <= 0) errors.push("- LỖI: Số phiếu thu vào phải lớn hơn 0.");
    if (validV <= 0) errors.push("- LỖI: Số phiếu hợp lệ phải lớn hơn 0.");

    // Ràng buộc logic toán học (User nhập)
    if (actualV > totalV)
      errors.push(
        `- LỖI: Số cử tri đi bầu (${actualV}) > Tổng số cử tri (${totalV}).`
      );
    if (receivedV > issuedV)
      errors.push(
        `- LỖI: Số phiếu thu vào (${receivedV}) > Số phiếu phát ra (${issuedV}).`
      );
    if (validV + invalidV !== receivedV) {
      errors.push(
        `- LỖI KHỚP SỐ: Tổng phiếu hợp lệ + không hợp lệ (${
          validV + invalidV
        }) khác số phiếu thu vào (${receivedV}).`
      );
    }

    // --- RÀNG BUỘC KIỂM PHIẾU (QUAN TRỌNG NHẤT) ---
    if (validV !== totalActualValidVotesCount) {
      errors.push(
        `- LỖI KIỂM PHIẾU: Số phiếu hợp lệ đã nhập (${validV}) KHÔNG KHỚP với số phiếu thực tế đã quét/kiểm (${totalActualValidVotesCount}).`
      );
    }

    // --- XỬ LÝ XUẤT FILE LỖI NẾU SAI ---
    if (errors.length > 0) {
      const errorHeader =
        `THÔNG BÁO LỖI DỮ LIỆU KIỂM PHIẾU\nTổ bầu cử: ${
          config.unitName || ""
        }\nNgày: ${new Date().toLocaleString()}\n` +
        "=".repeat(50) +
        "\n\n";
      const errorContent =
        errorHeader +
        errors.join("\n") +
        "\n\n" +
        "=".repeat(50) +
        "\nKết quả kiểm phiếu thực tế phải khớp với số liệu tổng hợp mới có thể xuất bản Word.";

      const errorBlob = new Blob([errorContent], {
        type: "text/plain;charset=utf-8",
      });
      saveAs(errorBlob, `CANH_BAO_LOI_${config.unitName || "BaoCao"}.txt`);

      alert(
        "Dữ liệu sai lệch! Hệ thống đã xuất file LOI_...txt. Vui lòng kiểm tra lại số phiếu."
      );
      return;
    }

    // --- 4. CHUẨN BỊ DỮ LIỆU ĐỂ RENDER WORD (CHỈ KHI HỢP LỆ) ---
    const boardMembersArray = (config.boardMembers || "")
      .split("\n")
      .filter((n) => n.trim())
      .map((name, index) => ({
        stt: index + 3,
        name: name.trim(),
      }));

    const data = {
      province: config.province || ".................",
      district: config.district || "..................",
      unitName: config.unitName || "................",
      headOfBoard: config.headOfBoard || "................",
      secretary: config.secretary || "................",
      boardMembers: boardMembersArray,
      candidateLimit: config.candidateLimit || "0",
      seats: config.seats || "0",
      witnessesOpening: (config.witnessesOpening || "")
        .split("\n")
        .filter((n) => n.trim())
        .map((n, i) => ({ stt: i + 1, name: n.trim() })),
      witnessesCounting: (config.witnessesCounting || "")
        .split("\n")
        .filter((n) => n.trim())
        .map((n, i) => ({ stt: i + 1, name: n.trim() })),
      totalVoters: totalV,
      actualVoters: actualV,
      participationRate: ((actualV / totalV) * 100).toFixed(2),
      issuedVotes: issuedV,
      receivedVotes: receivedV,
      validVotes: validV,
      validRate: ((validV / receivedV) * 100).toFixed(2),
      invalidVotes: invalidV,
      invalidRate: ((invalidV / receivedV) * 100).toFixed(2),
      candidates: candidates.map((c, index) => ({
        stt: index + 1,
        name: c.name,
        voteCount: statsMap[c.id!] || 0,
        rate:
          validV > 0
            ? (((statsMap[c.id!] || 0) / validV) * 100).toFixed(2)
            : "0",
      })),
      day: new Date().getDate(),
      month: new Date().getMonth() + 1,
      year: 2026,
    };

    const content = await loadFile(templatePath);
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      parser: angularParser,
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.setData(data);
    doc.render();

    const out = doc.getZip().generate({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    saveAs(out, `${fileName}_ToBauCu_${config.unitName || "Export"}.docx`);
  } catch (error: any) {
    alert("Lỗi hệ thống: " + error.message);
  }
};
// --- CÁC HÀM EXPORT CỤ THỂ ---

// 1. Kết quả bầu cử Quốc hội (Mẫu 18)
export const exportReportWordKPQH = () =>
  generateVotingReport(
    "/templates/mau18-bb-kiemphieu-qh.docx",
    "Ket_Qua_Bau_Cu_QH"
  );

// 2. Xác định kết quả Quốc hội (Ví dụ mẫu 19)
export const exportReportWordXDKQQH = () =>
  generateVotingReport("templates/mau19-xd-kq-qh.docx", "Xac_Dinh_Ket_Qua_QH");

// 3. Kết quả bầu cử cấp Tỉnh
export const exportReportWordKPTinh = () =>
  generateVotingReport(
    "/templates/mau23-bb-kiemphieu-hdnd-tinh.docx",
    "Ket_Qua_Bau_Cu_Tinh"
  );

// 4. Xác định kết quả cấp Tỉnh
export const exportReportWordXDKQTinh = () =>
  generateVotingReport(
    "/templates/mau24-xd-kq-hdnd.docx",
    "Xac_Dinh_Ket_Qua_Tinh"
  );

// 5. Kết quả bầu cử cấp Xã
export const exportReportWordKPXa = () =>
  generateVotingReport(
    "/templates/mau23-bb-kiemphieu-hdnd-xa.docx",
    "Ket_Qua_Bau_Cu_Xa"
  );

// 6. Xác định kết quả cấp Xã
export const exportReportWordXDKQXa = () =>
  generateVotingReport(
    "/templates/mau24-xd-kq-hdnd.docx",
    "Xac_Dinh_Ket_Qua_Xa"
  );
