import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Hàm mã hóa chuỗi ngày đơn giản sang ký tự (Obfuscation)
 * Ví dụ: "20260205" -> "BGGCAGAF" (Tránh người dùng nhìn thấy ngày)
 */
const obfuscateDate = (dateStr: string): string => {
  const map: { [key: string]: string } = {
    "0": "5",
    "1": "Z",
    "2": "P",
    "3": "W",
    "4": "M",
    "5": "N",
    "6": "9",
    "7": "Q",
    "8": "R",
    "9": "1",
  };
  return dateStr
    .split("")
    .map((char) => map[char] || char)
    .join("");
};

const createLicense = (hwid: string, days: string): string => {
  const secretSalt = "THANHBAUCU2026";
  const reversedHwid = hwid.trim().split("").reverse().join("");

  // 1. Tính toán ngày hết hạn
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + parseInt(days));

  const y = expiryDate.getFullYear();
  const m = String(expiryDate.getMonth() + 1).padStart(2, "0");
  const d = String(expiryDate.getDate()).padStart(2, "0");
  const dateStr = `${y}${m}${d}`; // Ví dụ: "20260205"

  // 2. Tạo mã bảo mật Hash (8 ký tự đầu)
  const hash = Buffer.from(reversedHwid + dateStr + secretSalt)
    .toString("base64")
    .replace(/[/+=]/g, "")
    .slice(0, 10) // Tăng lên 10 ký tự cho an toàn
    .toUpperCase();

  // 3. Mã hóa chuỗi ngày (Thành chữ)
  const encodedDate = obfuscateDate(dateStr);

  return hash + encodedDate;
};

console.log("\x1b[36m%s\x1b[0m", "=== KEY GEN ===");

rl.question("Nhập HWID: ", (hwid: string) => {
  rl.question("Số ngày: ", (days: string) => {
    if (!hwid || isNaN(parseInt(days))) {
      console.log("❌ Dữ liệu lỗi!");
      rl.close();
      return;
    }

    const key = createLicense(hwid, days);
    console.log("\n\x1b[32m%s\x1b[0m", "=".repeat(40));
    console.log(`🔑 KEY: ${key}`);
    console.log(`📅 HẠN: ${days} ngày`);
    console.log("\x1b[32m%s\x1b[0m", "=".repeat(40));
    rl.close();
  });
});
