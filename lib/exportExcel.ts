import * as XLSX from "xlsx-js-style";
import { decrypt } from "./db";

export const exportVotesToExcel = (
  candidates: any[],
  votes: any[],
  electionName: string
) => {
  if (!votes || votes.length === 0) return;

  const workbook = XLSX.utils.book_new();

  // --- 1. LOGIC PHÂN LOẠI PHIẾU ---
  const votesByType = votes.reduce((acc: Record<number, any[]>, vote) => {
    let selectedIds: number[] = [];
    try {
      selectedIds = decrypt(vote.candidateIds);
    } catch (e) {
      console.error("Lỗi giải mã phiếu:", vote.id);
    }
    const selectCount = selectedIds.length;
    if (selectCount > 0) {
      if (!acc[selectCount]) acc[selectCount] = [];
      acc[selectCount].push({ ...vote, decodedIds: selectedIds });
    }
    return acc;
  }, {});

  const sortedTypes = Object.keys(votesByType)
    .map(Number)
    .sort((a, b) => a - b);

  // --- STYLE DEFINITIONS ---
  const styleHeader = {
    font: { bold: true, color: { rgb: "000000" } },
    fill: { fgColor: { rgb: "EFEFEF" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    },
  };

  const styleCell = {
    border: {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    },
  };

  const styleTotalRed = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "FF0000" } }, // Màu đỏ
    alignment: { horizontal: "center" },
    border: {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    },
  };

  // --- 2. SHEET TỔNG HỢP ---
  const summaryHeaders = [
    "Danh sách ứng cử viên",
    ...sortedTypes.map((t) => `PBầu ${t}`),
    "Tổng lượt bầu",
  ];
  const summaryRows = candidates.map((candidate) => {
    const rowData: any[] = [candidate.name];
    let totalCandiVotes = 0;
    sortedTypes.forEach((type) => {
      const countInType = votesByType[type].filter((v: any) =>
        v.decodedIds.includes(candidate.id)
      ).length;
      rowData.push(countInType);
      totalCandiVotes += countInType;
    });
    rowData.push(totalCandiVotes);
    return rowData;
  });

  // Các dòng đối soát
  const actualVotesRow = [
    "Tổng lượt bầu",
    ...sortedTypes.map((t, idx) =>
      summaryRows.reduce((sum, row) => sum + row[idx + 1], 0)
    ),
  ];
  actualVotesRow.push(
    actualVotesRow.slice(1).reduce((a: any, b: any) => a + b, 0)
  );

  const missingRow = [
    "Thiếu",
    ...sortedTypes.map(
      (type, idx) =>
        votesByType[type].length * candidates.length -
        (actualVotesRow[idx + 1] as number)
    ),
    "",
  ];

  const totalWithMissingRow = [
    "Tổng lượt bầu + thiếu",
    ...sortedTypes.map(
      (_, idx) =>
        (actualVotesRow[idx + 1] as number) + (missingRow[idx + 1] as number)
    ),
  ];
  totalWithMissingRow.push(
    totalWithMissingRow.slice(1).reduce((a: any, b: any) => a + b, 0)
  );

  const finalVoteRow = [
    "Tổng số phiếu",
    ...sortedTypes.map((type) => votesByType[type].length),
    votes.length,
  ];

  // Build Sheet Data with Styles
  const aoa = [
    summaryHeaders,
    ...summaryRows,
    [],
    actualVotesRow,
    missingRow,
    totalWithMissingRow,
    finalVoteRow,
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(aoa);

  // Áp dụng định dạng cho Sheet Tổng Hợp
  const range = XLSX.utils.decode_range(summarySheet["!ref"]!);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!summarySheet[cellAddress]) continue;

      // Tiêu đề (Dòng 0)
      if (R === 0) {
        summarySheet[cellAddress].s = styleHeader;
      }
      // Vùng dữ liệu ứng viên & đối soát
      else if (R <= summaryRows.length || R >= summaryRows.length + 2) {
        summarySheet[cellAddress].s = styleCell;
        // Nếu là dòng "Tổng số phiếu" hoặc cột "Tổng" cuối cùng thì tô đỏ
        if (R === range.e.r || C === range.e.c) {
          summarySheet[cellAddress].s = styleTotalRed;
        }
      }
    }
  }

  summarySheet["!cols"] = summaryHeaders.map((_, i) => ({
    wch: i === 0 ? 30 : 15,
  }));
  XLSX.utils.book_append_sheet(workbook, summarySheet, "TỔNG HỢP");

  // --- 3. SHEET CHI TIẾT ---
  sortedTypes.forEach((type) => {
    const typeVotes = votesByType[type];
    const detailHeaders = ["STT", ...candidates.map((c) => c.name)];
    const rows = typeVotes.map((v, index) => [
      index + 1,
      ...candidates.map((c) => (v.decodedIds.includes(c.id) ? "x" : "")),
    ]);

    const totalRow = [
      "TỔNG CỘNG",
      ...candidates.map(
        (c, idx) => rows.filter((r) => r[idx + 1] === "x").length
      ),
    ];

    const ws = XLSX.utils.aoa_to_sheet([detailHeaders, ...rows, [], totalRow]);

    // Định dạng Sheet chi tiết
    const wsRange = XLSX.utils.decode_range(ws["!ref"]!);
    for (let R = wsRange.s.r; R <= wsRange.e.r; ++R) {
      for (let C = wsRange.s.c; C <= wsRange.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) continue;
        if (R === 0) ws[addr].s = styleHeader;
        else if (R === wsRange.e.r) ws[addr].s = styleTotalRed;
        else ws[addr].s = styleCell;
      }
    }

    ws["!cols"] = detailHeaders.map((h) => ({ wch: h.length + 6 }));
    XLSX.utils.book_append_sheet(workbook, ws, `Bầu ${type}`);
  });

  XLSX.writeFile(
    workbook,
    `Ket_qua_bau_cu_${electionName.replace(/\s+/g, "_")}.xlsx`
  );
};
