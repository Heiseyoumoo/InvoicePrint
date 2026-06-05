const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ACCEPTED_TYPES,
  MAX_FILE_SIZE,
  MAX_FILE_COUNT,
  validateFile,
  getLayoutSlots,
  getDividerLines,
  createOutputFilename,
  formatFileSize,
} = require("./invoice-tool-core.js");

test("validateFile accepts supported PDF and image files under the size limit", () => {
  const result = validateFile({
    name: "invoice.pdf",
    type: "application/pdf",
    size: MAX_FILE_SIZE,
  });

  assert.equal(result.valid, true);
  assert.equal(ACCEPTED_TYPES.includes("image/webp"), true);
});

test("validateFile rejects unsupported formats and oversized files with Chinese messages", () => {
  const wrongType = validateFile({
    name: "invoice.txt",
    type: "text/plain",
    size: 1024,
  });
  const oversized = validateFile({
    name: "invoice.png",
    type: "image/png",
    size: MAX_FILE_SIZE + 1,
  });

  assert.equal(wrongType.valid, false);
  assert.match(wrongType.message, /文件格式不支持/);
  assert.equal(oversized.valid, false);
  assert.match(oversized.message, /20MB/);
});

test("getLayoutSlots returns centered A4 regions for 2, 3 and 4-up layouts", () => {
  const two = getLayoutSlots(2);
  const three = getLayoutSlots(3);
  const four = getLayoutSlots(4);

  assert.equal(two.length, 2);
  assert.equal(three.length, 3);
  assert.equal(four.length, 4);
  assert.ok(two[0].y > two[1].y, "2-up should be vertical from top to bottom");
  assert.ok(three[0].y > three[2].y, "3-up should be vertical from top to bottom");
  assert.ok(four[0].x < four[1].x, "4-up should use left and right columns");
  assert.ok(four[0].y > four[2].y, "4-up should use top and bottom rows");
});

test("getDividerLines returns cut guide lines between invoice regions", () => {
  const two = getDividerLines(2);
  const three = getDividerLines(3);
  const four = getDividerLines(4);

  assert.equal(two.length, 1);
  assert.equal(three.length, 2);
  assert.equal(four.length, 2);
  assert.equal(two[0].orientation, "horizontal");
  assert.equal(three[0].orientation, "horizontal");
  assert.equal(four[0].orientation, "vertical");
  assert.equal(four[1].orientation, "horizontal");
});

test("createOutputFilename uses the expected Chinese timestamp format", () => {
  const filename = createOutputFilename(new Date("2026-06-05T09:08:07"));

  assert.equal(filename, "发票合并_20260605_090807.pdf");
});

test("formatFileSize formats common byte values", () => {
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(1024), "1.0 KB");
  assert.equal(formatFileSize(1048576), "1.0 MB");
  assert.equal(MAX_FILE_COUNT, 50);
});
