/**
 * LICENSE UTILS - GEMINI AI SECURITY
 */

/**
 * Tạo mã định danh thiết bị duy nhất (Hardware ID)
 * Kết hợp thông số GPU, số nhân CPU và độ phân giải màn hình.
 */
export const getHWID = (): string => {
  if (typeof window === "undefined") return "";

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    let renderer = "";

    if (gl instanceof WebGLRenderingContext) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      renderer = debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : "Generic-Renderer";
    }

    // Các thông số phần cứng cơ bản
    const cores = navigator.hardwareConcurrency || 0;
    const screenRes = `${window.screen.width}x${window.screen.height}`;
    const language = navigator.language;

    // Chuỗi thông tin thô
    const rawInfo = `${cores}-${renderer}-${screenRes}-${language}`;

    // Mã hóa sang Base64 và dọn dẹp ký tự đặc biệt
    return btoa(rawInfo)
      .replace(/[/+=]/g, "") // Loại bỏ ký tự gây lỗi URL/Path
      .slice(0, 10) // Lấy 10 ký tự đầu cho gọn
      .toUpperCase();
  } catch (error) {
    console.error("HWID Generation Error:", error);
    return "UNKNOWN-ID";
  }
};

const deObfuscateDate = (encodedStr: string): string => {
  const reverseMap: { [key: string]: string } = {
    5: "0",
    Z: "1",
    P: "2",
    W: "3",
    M: "4",
    N: "5",
    9: "6",
    Q: "7",
    R: "8",
    1: "9",
  };
  return encodedStr
    .split("")
    .map((char) => reverseMap[char] || char)
    .join("");
};

export const verifyLicenseKey = (
  hwid: string,
  inputKey: string
): { valid: boolean; message: string } => {
  if (!hwid || !inputKey || inputKey.length < 18)
    return { valid: false, message: "Mã không hợp lệ!" };

  const secretSalt = "THANHBAUCU2026";
  const keyStr = inputKey.trim().toUpperCase();

  // 1. Tách chuỗi: 10 ký tự đầu là Hash, 8 ký tự sau là Ngày mã hóa
  const inputHash = keyStr.slice(0, 10);
  const encodedDate = keyStr.slice(10);

  // 2. Giải mã ngày
  const dateStr = deObfuscateDate(encodedDate); // Trả về dạng YYYYMMDD
  const reversedHwid = hwid.split("").reverse().join("");

  // 3. Kiểm tra tính toàn vẹn (Check Hash)
  const expectedHash = btoa(reversedHwid + dateStr + secretSalt)
    .replace(/[/+=]/g, "")
    .slice(0, 10)
    .toUpperCase();

  if (inputHash !== expectedHash)
    return {
      valid: false,
      message: "Mã kích hoạt bị sai hoặc đã bị chỉnh sửa!",
    };

  // 4. Kiểm tra ngày hết hạn
  const year = parseInt(dateStr.slice(0, 4));
  const month = parseInt(dateStr.slice(4, 6)) - 1;
  const day = parseInt(dateStr.slice(6, 8));
  const expiryDate = new Date(year, month, day);

  if (new Date() > expiryDate) {
    return {
      valid: false,
      message: `Mã đã hết hạn vào ${day}/${month + 1}/${year}`,
    };
  }

  return { valid: true, message: "Kích hoạt thành công!" };
};

/**
 * Lưu mã kích hoạt vào LocalStorage thay vì chỉ lưu "true"
 */
export const setActivationStatus = (hwid: string, licenseKey: string): void => {
  if (typeof window !== "undefined") {
    // Tạo một tên key khó đoán trong LocalStorage
    const storageKey = btoa(`license_slot_${hwid}`).slice(0, 12);
    // Lưu chính cái mã Key mà người dùng đã nhập
    localStorage.setItem(storageKey, licenseKey);
  }
};

/**
 * Kiểm tra xem thiết bị đã được kích hoạt và KEY còn hạn hay không
 */
export const checkIsActivated = (hwid: string): boolean => {
  if (typeof window === "undefined" || !hwid) return false;

  const storageKey = btoa(`license_slot_${hwid}`).slice(0, 12);
  const savedKey = localStorage.getItem(storageKey);

  if (!savedKey) return false;

  // Gọi lại hàm verify để kiểm tra xem Key đã lưu có đúng HWID và còn hạn không
  const result = verifyLicenseKey(hwid, savedKey);

  return result.valid;
};
