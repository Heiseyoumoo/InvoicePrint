(function initInvoiceToolCore(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.InvoiceToolCore = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function createCore() {
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const PAGE_MARGIN = 36;
  const GAP = 18;
  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  const MAX_FILE_COUNT = 50;
  const ACCEPTED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];
  const ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

  function getFileExtension(name) {
    const normalized = String(name || "").toLowerCase();
    const dotIndex = normalized.lastIndexOf(".");
    return dotIndex >= 0 ? normalized.slice(dotIndex) : "";
  }

  function validateFile(file) {
    if (!file) {
      return { valid: false, message: "请选择需要上传的文件" };
    }

    const extension = getFileExtension(file.name);
    const typeSupported =
      ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.includes(extension);

    if (!typeSupported) {
      return {
        valid: false,
        message: "文件格式不支持，请上传 PDF 或图片文件",
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        message: "文件过大，请上传 20MB 以内的文件",
      };
    }

    return { valid: true, message: "" };
  }

  function getLayoutSlots(layoutCount) {
    const count = Number(layoutCount);
    const pageWidth = A4_WIDTH;
    const pageHeight = A4_HEIGHT;
    const contentWidth = pageWidth - PAGE_MARGIN * 2;
    const contentHeight = pageHeight - PAGE_MARGIN * 2;

    if (count === 2 || count === 3) {
      const verticalGap = count === 2 ? GAP : 14;
      const slotHeight = (contentHeight - verticalGap * (count - 1)) / count;
      return Array.from({ length: count }, (_, index) => ({
        x: PAGE_MARGIN,
        y: pageHeight - PAGE_MARGIN - slotHeight - index * (slotHeight + verticalGap),
        width: contentWidth,
        height: slotHeight,
      }));
    }

    if (count === 4) {
      const slotWidth = (contentWidth - GAP) / 2;
      const slotHeight = (contentHeight - GAP) / 2;
      return [
        { x: PAGE_MARGIN, y: PAGE_MARGIN + slotHeight + GAP, width: slotWidth, height: slotHeight },
        { x: PAGE_MARGIN + slotWidth + GAP, y: PAGE_MARGIN + slotHeight + GAP, width: slotWidth, height: slotHeight },
        { x: PAGE_MARGIN, y: PAGE_MARGIN, width: slotWidth, height: slotHeight },
        { x: PAGE_MARGIN + slotWidth + GAP, y: PAGE_MARGIN, width: slotWidth, height: slotHeight },
      ];
    }

    throw new Error("仅支持每页 2、3 或 4 张发票");
  }

  function getDividerLines(layoutCount) {
    const count = Number(layoutCount);
    const slots = getLayoutSlots(count);

    if (count === 2 || count === 3) {
      return Array.from({ length: count - 1 }, (_, index) => {
        const upperSlot = slots[index];
        const lowerSlot = slots[index + 1];
        const y = (upperSlot.y + lowerSlot.y + lowerSlot.height) / 2;
        return {
          orientation: "horizontal",
          start: { x: PAGE_MARGIN, y },
          end: { x: A4_WIDTH - PAGE_MARGIN, y },
        };
      });
    }

    if (count === 4) {
      const verticalX = (slots[0].x + slots[0].width + slots[1].x) / 2;
      const horizontalY = (slots[0].y + slots[2].y + slots[2].height) / 2;
      return [
        {
          orientation: "vertical",
          start: { x: verticalX, y: PAGE_MARGIN },
          end: { x: verticalX, y: A4_HEIGHT - PAGE_MARGIN },
        },
        {
          orientation: "horizontal",
          start: { x: PAGE_MARGIN, y: horizontalY },
          end: { x: A4_WIDTH - PAGE_MARGIN, y: horizontalY },
        },
      ];
    }

    throw new Error("仅支持每页 2、3 或 4 张发票");
  }

  function fitIntoBox(sourceWidth, sourceHeight, box) {
    const scale = Math.min(box.width / sourceWidth, box.height / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    return {
      x: box.x + (box.width - width) / 2,
      y: box.y + (box.height - height) / 2,
      width,
      height,
    };
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function createOutputFilename(date = new Date()) {
    const yyyy = date.getFullYear();
    const MM = pad2(date.getMonth() + 1);
    const dd = pad2(date.getDate());
    const HH = pad2(date.getHours());
    const mm = pad2(date.getMinutes());
    const ss = pad2(date.getSeconds());
    return `发票合并_${yyyy}${MM}${dd}_${HH}${mm}${ss}.pdf`;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function getFileKind(file) {
    const extension = getFileExtension(file.name);
    if (file.type === "application/pdf" || extension === ".pdf") return "pdf";
    return "image";
  }

  return {
    A4_WIDTH,
    A4_HEIGHT,
    MAX_FILE_SIZE,
    MAX_FILE_COUNT,
    ACCEPTED_TYPES,
    validateFile,
    getLayoutSlots,
    getDividerLines,
    fitIntoBox,
    createOutputFilename,
    formatFileSize,
    getFileKind,
  };
});
