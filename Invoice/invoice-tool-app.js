(() => {
  const {
    A4_WIDTH,
    A4_HEIGHT,
    MAX_FILE_COUNT,
    validateFile,
    getLayoutSlots,
    getDividerLines,
    fitIntoBox,
    createOutputFilename,
    formatFileSize,
    getFileKind,
  } = window.InvoiceToolCore;

  const state = {
    uploadedFiles: [],
    layoutCount: 2,
    generatedPdfBytes: null,
    isGenerating: false,
    generationToken: 0,
    toastTimer: null,
  };

  const els = {
    fileInput: document.getElementById("fileInput"),
    dropzone: document.getElementById("dropzone"),
    uploadTitle: document.getElementById("uploadTitle"),
    fileList: document.getElementById("fileList"),
    clearBtn: document.getElementById("clearBtn"),
    layoutButtons: document.querySelectorAll("[data-layout-count]"),
    previewContent: document.getElementById("previewContent"),
    statusText: document.getElementById("statusText"),
    toast: document.getElementById("toast"),
    downloadBtn: document.getElementById("downloadBtn"),
    printBtn: document.getElementById("printBtn"),
    regenerateBtn: document.getElementById("regenerateBtn"),
    actionButtons: document.querySelectorAll("[data-action-button]"),
  };

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  function showToast(message, type = "info") {
    clearTimeout(state.toastTimer);
    els.toast.textContent = message;
    els.toast.className =
      "fixed left-1/2 top-20 z-[80] flex min-h-12 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-center rounded-lg px-4 py-3 text-center text-sm shadow-lg transition-all";

    const styles = {
      info: "bg-[#233d29] text-white",
      success: "bg-[#4a654e] text-white",
      error: "bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]/20",
    };

    els.toast.classList.add(...styles[type].split(" "), "opacity-100", "translate-y-0");
    els.toast.classList.remove("pointer-events-none");
    state.toastTimer = setTimeout(() => {
      els.toast.classList.remove("opacity-100", "translate-y-0");
      els.toast.classList.add("opacity-0", "-translate-y-2", "pointer-events-none");
    }, 3200);
  }

  function setStatus(message, type = "idle") {
    els.statusText.textContent = message;
    const colorMap = {
      idle: "text-on-surface-variant",
      loading: "text-primary",
      success: "text-primary",
      error: "text-error",
    };
    els.statusText.className = `text-xs font-medium ${colorMap[type] || colorMap.idle}`;
  }

  function setBusy(isBusy) {
    state.isGenerating = isBusy;
    updateButtons();
  }

  function updateButtons() {
    const hasFiles = state.uploadedFiles.length > 0;
    const hasPdf = Boolean(state.generatedPdfBytes);
    els.clearBtn.disabled = !hasFiles || state.isGenerating;

    els.regenerateBtn.disabled = !hasFiles || state.isGenerating;
    els.downloadBtn.disabled = !hasPdf || state.isGenerating;
    els.printBtn.disabled = !hasPdf || state.isGenerating;

    els.actionButtons.forEach((button) => {
      button.classList.toggle("opacity-50", button.disabled);
      button.classList.toggle("cursor-not-allowed", button.disabled);
    });
  }

  function renderFileList() {
    els.uploadTitle.textContent = `已上传 ${state.uploadedFiles.length} 个文件`;
    els.fileList.innerHTML = "";

    if (!state.uploadedFiles.length) {
      const empty = document.createElement("div");
      empty.className =
        "rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest px-3 py-4 text-center text-sm text-outline";
      empty.textContent = "文件列表为空";
      els.fileList.appendChild(empty);
      return;
    }

    state.uploadedFiles.forEach((item, index) => {
      const row = document.createElement("div");
      row.className =
        "group rounded-lg border border-[#D1DED1] bg-white px-3 py-2 shadow-sm transition hover:border-primary-container";

      const kindLabel = getFileKind(item.file) === "pdf" ? "PDF" : "图片";
      row.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-fixed text-[11px] font-bold text-primary">${kindLabel}</div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-on-surface" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</p>
            <p class="mt-0.5 text-xs text-outline">${formatFileSize(item.file.size)}</p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <button type="button" class="flex h-8 w-8 items-center justify-center rounded-md border border-outline-variant text-on-surface-variant hover:bg-surface-container disabled:opacity-35" data-move-up="${item.id}" title="上移" aria-label="上移" ${index === 0 ? "disabled" : ""}>
              <span class="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
            </button>
            <button type="button" class="flex h-8 w-8 items-center justify-center rounded-md border border-outline-variant text-on-surface-variant hover:bg-surface-container disabled:opacity-35" data-move-down="${item.id}" title="下移" aria-label="下移" ${index === state.uploadedFiles.length - 1 ? "disabled" : ""}>
              <span class="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
            </button>
            <button type="button" class="flex h-8 w-8 items-center justify-center rounded-md text-error hover:bg-error-container" data-delete="${item.id}" title="删除文件" aria-label="删除文件">
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </div>
      `;
      els.fileList.appendChild(row);
    });
  }

  function renderLayoutButtons() {
    els.layoutButtons.forEach((button) => {
      const isActive = Number(button.dataset.layoutCount) === state.layoutCount;
      button.className = isActive
        ? "flex-1 rounded-md bg-primary py-2 text-sm font-bold text-on-primary shadow-sm transition-all"
        : "flex-1 rounded-md py-2 text-sm font-medium text-on-surface-variant transition-all hover:bg-surface-container";
    });
  }

  function renderEmptyPreview() {
    els.previewContent.innerHTML = `
      <div class="flex min-h-full flex-col items-center justify-center p-10 text-center">
        <div class="mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-primary-fixed text-primary shadow-inner">
          <span class="material-symbols-outlined text-6xl">receipt_long</span>
        </div>
        <h2 class="mb-4 text-3xl font-semibold text-on-tertiary-container">您还没有添加发票哦</h2>
        <p class="max-w-xl text-lg leading-8 text-outline">开始上传您的电子发票或扫描件，我们将自动为您排版并合并为 PDF。</p>
      </div>
    `;
  }

  function renderLoadingPreview(message) {
    els.previewContent.innerHTML = `
      <div class="flex min-h-full flex-col items-center justify-center gap-4 p-10 text-center">
        <div class="h-12 w-12 animate-spin rounded-full border-4 border-primary-fixed border-t-primary"></div>
        <p class="text-base font-medium text-primary">${message}</p>
      </div>
    `;
  }

  function renderErrorPreview(message) {
    els.previewContent.innerHTML = `
      <div class="flex min-h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <div class="flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-error">
          <span class="material-symbols-outlined text-3xl">error</span>
        </div>
        <h2 class="text-xl font-semibold text-error">生成失败</h2>
        <p class="max-w-lg text-sm leading-6 text-on-surface-variant">${escapeHtml(message)}</p>
      </div>
    `;
  }

  function renderAll() {
    renderFileList();
    renderLayoutButtons();
    updateButtons();
  }

  function handleFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;

    const remainingSlots = MAX_FILE_COUNT - state.uploadedFiles.length;
    if (remainingSlots <= 0) {
      showToast("文件数量已达到 50 个上限，请先删除部分文件", "error");
      return;
    }

    let accepted = 0;
    incoming.slice(0, remainingSlots).forEach((file) => {
      const result = validateFile(file);
      if (!result.valid) {
        showToast(`${file.name}：${result.message}`, "error");
        return;
      }

      state.uploadedFiles.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        file,
      });
      accepted += 1;
    });

    if (incoming.length > remainingSlots) {
      showToast("最多支持 50 个文件，超出的文件已自动忽略", "error");
    } else if (accepted > 0) {
      showToast(`已添加 ${accepted} 个文件`, "success");
    }

    renderAll();
    scheduleGenerate();
  }

  function removeFile(id) {
    state.uploadedFiles = state.uploadedFiles.filter((item) => item.id !== id);
    if (!state.uploadedFiles.length) {
      resetGeneratedPdf();
      renderEmptyPreview();
      setStatus("等待上传文件", "idle");
    } else {
      scheduleGenerate();
    }
    renderAll();
  }

  function moveFile(id, direction) {
    const index = state.uploadedFiles.findIndex((item) => item.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= state.uploadedFiles.length) return;

    const [item] = state.uploadedFiles.splice(index, 1);
    state.uploadedFiles.splice(targetIndex, 0, item);
    renderAll();
    scheduleGenerate();
  }

  function clearFiles() {
    if (!state.uploadedFiles.length) return;
    state.uploadedFiles = [];
    state.generationToken += 1;
    resetGeneratedPdf();
    renderAll();
    renderEmptyPreview();
    setStatus("已清空文件", "idle");
    showToast("已清空全部文件", "success");
  }

  function resetGeneratedPdf() {
    state.generatedPdfBytes = null;
    updateButtons();
  }

  function scheduleGenerate() {
    clearTimeout(scheduleGenerate.timer);
    scheduleGenerate.timer = setTimeout(() => generateMergedPdf(), 120);
  }

  async function generateMergedPdf() {
    if (!state.uploadedFiles.length) {
      resetGeneratedPdf();
      renderEmptyPreview();
      setStatus("等待上传文件", "idle");
      return;
    }

    const token = ++state.generationToken;
    setBusy(true);
    resetGeneratedPdf();
    setStatus("正在读取文件", "loading");
    renderLoadingPreview("正在读取文件...");

    try {
      const pdfBytes = await buildMergedPdfBytes((message) => {
        if (token === state.generationToken) {
          setStatus(message, "loading");
        }
      });

      if (token !== state.generationToken) return;

      state.generatedPdfBytes = pdfBytes;
      setStatus("正在生成预览", "loading");
      renderLoadingPreview("正在生成预览...");
      await renderPreview(pdfBytes);

      if (token !== state.generationToken) return;

      setStatus("已生成预览", "success");
      showToast("PDF 预览已生成", "success");
    } catch (error) {
      if (token !== state.generationToken) return;
      const message = error?.userMessage || "PDF 生成失败，请检查文件是否损坏";
      resetGeneratedPdf();
      renderErrorPreview(message);
      setStatus("生成失败", "error");
      showToast(message, "error");
      console.error(error);
    } finally {
      if (token === state.generationToken) {
        setBusy(false);
      }
    }
  }

  async function buildMergedPdfBytes(onProgress) {
    if (!window.PDFLib?.PDFDocument) {
      throw withUserMessage(new Error("pdf-lib 未加载"), "PDF 工具加载失败，请检查网络后刷新页面");
    }

    const { PDFDocument, rgb } = window.PDFLib;
    const outputPdf = await PDFDocument.create();
    const slots = getLayoutSlots(state.layoutCount);
    const dividerLines = getDividerLines(state.layoutCount);
    let outputPage = null;
    let slotIndex = 0;

    for (const item of state.uploadedFiles) {
      onProgress(`正在读取文件：${item.file.name}`);
      const entries = await fileToDrawableEntries(item.file, outputPdf);

      for (const entry of entries) {
        if (!outputPage || slotIndex >= state.layoutCount) {
          outputPage = outputPdf.addPage([A4_WIDTH, A4_HEIGHT]);
          drawCutGuides(outputPage, dividerLines, rgb);
          slotIndex = 0;
        }

        const slot = slots[slotIndex];
        const fitted = fitIntoBox(entry.width, entry.height, slot);

        // 每个槽位只按源宽高等比缩放并居中，不裁切、不拉伸，保证发票内容比例不变。
        if (entry.kind === "pdf") {
          outputPage.drawPage(entry.page, fitted);
        } else {
          outputPage.drawImage(entry.image, fitted);
        }
        slotIndex += 1;
      }
    }

    if (!outputPdf.getPageCount()) {
      throw withUserMessage(new Error("没有可合并的发票内容"), "没有可合并的发票内容");
    }

    onProgress("正在保存 PDF");
    return outputPdf.save();
  }

  function drawCutGuides(page, dividerLines, rgb) {
    dividerLines.forEach((line) => {
      page.drawLine({
        start: line.start,
        end: line.end,
        thickness: 0.8,
        color: rgb(0.45, 0.52, 0.45),
        opacity: 0.7,
        dashArray: [6, 5],
      });
    });
  }

  async function fileToDrawableEntries(file, outputPdf) {
    const bytes = await file.arrayBuffer();
    const kind = getFileKind(file);

    if (kind === "pdf") {
      try {
        const srcPdf = await window.PDFLib.PDFDocument.load(bytes);
        const indices = srcPdf.getPageIndices();
        const embeddedPages = await outputPdf.embedPdf(bytes, indices);
        return embeddedPages.map((page) => ({
          kind: "pdf",
          page,
          width: page.width,
          height: page.height,
        }));
      } catch (error) {
        throw withUserMessage(error, "PDF 生成失败，请检查文件是否损坏");
      }
    }

    try {
      const isWebp = file.type === "image/webp" || /\.webp$/i.test(file.name);
      const imageBytes = isWebp ? await convertWebpToPngBytes(file) : bytes;
      const image =
        file.type === "image/jpeg" || /\.(jpg|jpeg)$/i.test(file.name)
          ? await outputPdf.embedJpg(imageBytes)
          : await outputPdf.embedPng(imageBytes);

      return [
        {
          kind: "image",
          image,
          width: image.width,
          height: image.height,
        },
      ];
    } catch (error) {
      throw withUserMessage(error, "图片读取失败，请检查文件是否损坏");
    }
  }

  async function convertWebpToPngBytes(file) {
    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      throw new Error("WEBP 转换失败");
    }
    return blob.arrayBuffer();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("图片加载失败"));
      image.src = src;
    });
  }

  async function renderPreview(pdfBytes) {
    if (!window.pdfjsLib) {
      throw withUserMessage(new Error("pdf.js 未加载"), "PDF 预览工具加载失败，请检查网络后刷新页面");
    }

    els.previewContent.innerHTML = "";
    els.previewContent.classList.add("gap-5", "py-6");

    const loadingTask = window.pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
    const pdf = await loadingTask.promise;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.25 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.className = "mx-auto w-full max-w-[760px] rounded-lg bg-white shadow-md ring-1 ring-outline-variant";

      await page.render({
        canvasContext: context,
        viewport,
        transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
      }).promise;

      const wrapper = document.createElement("div");
      wrapper.className = "px-4";
      wrapper.appendChild(canvas);
      els.previewContent.appendChild(wrapper);
    }
  }

  function downloadPdf() {
    if (!state.generatedPdfBytes) return;
    const url = createPdfObjectUrl();
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = createOutputFilename();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("PDF 已开始下载", "success");
  }

  function printPdf() {
    if (!state.generatedPdfBytes) return;
    const url = createPdfObjectUrl();
    const printWindow = window.open(url, "_blank");
    if (!printWindow) {
      showToast("浏览器阻止了打印窗口，请允许弹窗后重试", "error");
      URL.revokeObjectURL(url);
      return;
    }

    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (error) {
        showToast("打印失败，请在新窗口中手动打印", "error");
      }
    }, 800);
    setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
  }

  function createPdfObjectUrl() {
    const blob = new Blob([state.generatedPdfBytes], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  }

  function withUserMessage(error, message) {
    error.userMessage = message;
    return error;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function bindEvents() {
    els.dropzone.addEventListener("click", () => els.fileInput.click());
    els.fileInput.addEventListener("change", (event) => {
      handleFiles(event.target.files);
      event.target.value = "";
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      els.dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        els.dropzone.classList.add("border-primary", "bg-primary-container/20", "scale-[1.01]");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      els.dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        els.dropzone.classList.remove("border-primary", "bg-primary-container/20", "scale-[1.01]");
      });
    });

    els.dropzone.addEventListener("drop", (event) => {
      handleFiles(event.dataTransfer.files);
    });

    els.fileList.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.delete) removeFile(button.dataset.delete);
      if (button.dataset.moveUp) moveFile(button.dataset.moveUp, -1);
      if (button.dataset.moveDown) moveFile(button.dataset.moveDown, 1);
    });

    els.layoutButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextCount = Number(button.dataset.layoutCount);
        if (state.layoutCount === nextCount) return;
        state.layoutCount = nextCount;
        renderLayoutButtons();
        scheduleGenerate();
      });
    });

    els.clearBtn.addEventListener("click", clearFiles);
    els.regenerateBtn.addEventListener("click", generateMergedPdf);
    els.downloadBtn.addEventListener("click", downloadPdf);
    els.printBtn.addEventListener("click", printPdf);
  }

  bindEvents();
  renderAll();
  renderEmptyPreview();
  setStatus("等待上传文件", "idle");

  window.InvoiceMergeApp = {
    state,
    handleFiles,
    validateFile,
    generateMergedPdf,
    renderPreview,
    downloadPdf,
    printPdf,
  };
})();
