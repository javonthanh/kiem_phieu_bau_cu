import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  TextRun,
  VerticalAlign,
  ShadingType,
} from "docx";
import { saveAs } from "file-saver";

export const exportElectionReport = async (config: any, stats: any[]) => {
  // Tạo văn bản mới
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Tiêu ngữ
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
                bold: true,
                size: 26,
              }),
              new TextRun({
                text: "Độc lập - Tự do - Hạnh phúc",
                bold: true,
                size: 24,
                break: 1,
              }),
              new TextRun({ text: "---------------", break: 1 }),
            ],
          }),

          // Tiêu đề biên bản
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 400 },
            children: [
              new TextRun({
                text: `BIÊN BẢN KIỂM PHIẾU BẦU CỬ ${
                  config?.type?.toUpperCase() || "BẦU CỬ"
                }`,
                bold: true,
                size: 30,
              }),
              new TextRun({
                text: `(Phương thức kiểm: ${
                  config?.tallyMethod || "Chưa xác định"
                })`,
                italics: true,
                size: 20,
                break: 1,
              }),
            ],
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: `Số lượng ứng cử viên: ${stats.length}`,
                break: 1,
              }),
              new TextRun({
                text: `Số người được bầu theo quy định: ${config?.seats || 0}`,
                break: 1,
              }),
              new TextRun({
                text: "Kết quả kiểm phiếu chi tiết như sau:",
                bold: true,
                break: 2,
              }),
            ],
          }),

          // Bảng kết quả
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // Hàng tiêu đề bảng
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 10, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.CENTER,
                    shading: { fill: "CCCCCC" },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: "STT", bold: true })],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 60, type: WidthType.PERCENTAGE },
                    shading: { fill: "CCCCCC" },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: "Họ và tên ứng cử viên",
                            bold: true,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    shading: { fill: "CCCCCC" },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: "Số phiếu đồng ý", bold: true }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              // Dữ liệu ứng cử viên
              ...stats.map(
                (s, index) =>
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: (index + 1).toString() }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: s.name })],
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: s.voteCount.toString() }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  })
              ),
            ],
          }),

          // Phần ký tên
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 800 },
            children: [
              new TextRun({
                text: `Ngày ..... tháng ..... năm 2026`,
                italics: true,
              }),
              new TextRun({
                text: "THƯ KÝ ĐOÀN KIỂM PHIẾU",
                bold: true,
                break: 1,
              }),
              new TextRun({
                text: "(Ký và ghi rõ họ tên)",
                italics: true,
                break: 1,
              }),
            ],
          }),
        ],
      },
    ],
  });

  // Xuất file
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Bien-ban-kiem-phieu-${config?.type || "bau-cu"}.docx`);
};
