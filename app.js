(function () {
  const slots = {
    primary: null,
    horizontal: null,
    icon: null,
    wordmark: null
  };
  let sources = [];

  const $ = (id) => document.getElementById(id);
  const brandName = $("brandName");
  const brandColor = $("brandColor");
  const brandHex = $("brandHex");
  const clearSpace = $("clearSpace");
  const clearLabel = $("clearLabel");
  const keyWhite = $("keyWhite");
  const jpgBg = $("jpgBg");
  const includeSocial = $("includeSocial");
  const includePrint = $("includePrint");
  const include4k = $("include4k");
  const generateBtn = $("generate");
  const tree = $("tree");
  const variants = $("variants");
  const masterPreview = $("masterPreview");
  const emptyStage = $("emptyStage");
  const metaRow = $("metaRow");
  const progress = $("progress");
  const barFill = $("barFill");
  const progressLabel = $("progressLabel");
  const result = $("result");

  const VARIATIONS = [
    { key: "primary", folder: "01 Primary Logo", label: "Primary" },
    { key: "horizontal", folder: "02 Horizontal Logo", label: "Horizontal" },
    { key: "icon", folder: "03 Brandmark", label: "Brandmark" },
    { key: "wordmark", folder: "04 Wordmark", label: "Wordmark" }
  ];

  const COLOURS = [
    { key: "full", folder: "01 Full-Colour", label: "Full-Colour", mode: "full" },
    { key: "inverse", folder: "02 Inverse", label: "Inverse", mode: "inverse" },
    { key: "black", folder: "03 Black", label: "Black", mode: "black" },
    { key: "white", folder: "04 White", label: "White", mode: "white" }
  ];

  function slug(value) {
    const clean = String(value || "Logo")
      .trim()
      .replace(/[^\w]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return clean || "Logo";
  }

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    if (Number.isNaN(n) || full.length !== 6) return { r: 31, g: 59, b: 49 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  function rgbToCmyk(r, g, b) {
    const R = r / 255, G = g / 255, B = b / 255;
    const k = 1 - Math.max(R, G, B);
    if (k >= 0.999) return { c: 0, m: 0, y: 0, k: 100 };
    return {
      c: Math.round(((1 - R - k) / (1 - k)) * 100),
      m: Math.round(((1 - G - k) / (1 - k)) * 100),
      y: Math.round(((1 - B - k) / (1 - k)) * 100),
      k: Math.round(k * 100)
    };
  }

  function cmykToRgb(c, m, y, k) {
    return {
      r: Math.round(255 * (1 - c) * (1 - k)),
      g: Math.round(255 * (1 - m) * (1 - k)),
      b: Math.round(255 * (1 - y) * (1 - k))
    };
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url, file });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read " + file.name));
      };
      img.src = url;
    });
  }

  function canvasFrom(img, maxEdge) {
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  }

  function analyze(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let opaque = 0;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 16) {
      if (data[i] > 12) opaque++;
      else transparent++;
    }
    const hasAlpha = transparent > opaque * 0.01;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hit = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        let ink = a > 16;
        if (!hasAlpha) {
          ink = !(r > 246 && g > 246 && b > 246);
        }
        if (ink) {
          hit = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!hit) {
      minX = 0; minY = 0; maxX = width - 1; maxY = height - 1;
    }
    return {
      hasAlpha,
      bounds: { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 },
      data,
      width,
      height
    };
  }

  function keyWhitePixels(imageData) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const min = Math.min(r, g, b);
      const max = Math.max(r, g, b);
      if (min > 244 && max > 248) {
        d[i + 3] = 0;
      } else if (min > 214 && (max - min) < 18) {
        const fade = (min - 214) / 34;
        d[i + 3] = Math.round(d[i + 3] * (1 - fade));
      }
    }
    return imageData;
  }

  function recolor(imageData, mode) {
    const copy = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const d = copy.data;
    if (mode === "full") return copy;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      if (mode === "black") {
        d[i] = 0; d[i + 1] = 0; d[i + 2] = 0;
      } else if (mode === "white") {
        d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
      } else if (mode === "inverse") {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
    }
    return copy;
  }

  function simulateCmyk(imageData) {
    const copy = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const d = copy.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      const cmyk = rgbToCmyk(d[i], d[i + 1], d[i + 2]);
      const rgb = cmykToRgb(cmyk.c / 100, cmyk.m / 100, cmyk.y / 100, cmyk.k / 100);
      d[i] = rgb.r; d[i + 1] = rgb.g; d[i + 2] = rgb.b;
    }
    return copy;
  }

  function extractColors(imageData) {
    const buckets = new Map();
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 24) {
      if (d[i + 3] < 140) continue;
      const r = d[i] >> 4, g = d[i + 1] >> 4, b = d[i + 2] >> 4;
      const key = (r << 8) | (g << 4) | b;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    return [...buckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key]) => {
        const r = ((key >> 8) & 15) * 17;
        const g = ((key >> 4) & 15) * 17;
        const b = (key & 15) * 17;
        return { r, g, b, hex: rgbToHex(r, g, b), cmyk: rgbToCmyk(r, g, b) };
      });
  }

  function cropPad(baseCanvas, bounds, paddingRatio, mode, doKey) {
    const src = baseCanvas.getContext("2d", { willReadFrequently: true });
    const image = src.getImageData(bounds.minX, bounds.minY, bounds.width, bounds.height);
    if (doKey) keyWhitePixels(image);
    const coloured = recolor(image, mode);
    const longest = Math.max(bounds.width, bounds.height);
    const pad = Math.round(longest * paddingRatio);
    const canvas = document.createElement("canvas");
    canvas.width = bounds.width + pad * 2;
    canvas.height = bounds.height + pad * 2;
    const ctx = canvas.getContext("2d");
    const hold = document.createElement("canvas");
    hold.width = bounds.width;
    hold.height = bounds.height;
    hold.getContext("2d").putImageData(coloured, 0, 0);
    ctx.drawImage(hold, pad, pad);
    return canvas;
  }

  function fitSquare(source, size, bleed) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const margin = size * bleed;
    const maxW = size - margin * 2;
    const maxH = size - margin * 2;
    const scale = Math.min(maxW / source.width, maxH / source.height);
    const w = source.width * scale;
    const h = source.height * scale;
    ctx.drawImage(source, (size - w) / 2, (size - h) / 2, w, h);
    return canvas;
  }

  function fitLongEdge(source, edge) {
    const scale = edge / Math.max(source.width, source.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function plate(source, w, h, bg) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const margin = Math.min(w, h) * 0.18;
    const scale = Math.min((w - margin * 2) / source.width, (h - margin * 2) / source.height);
    const dw = source.width * scale;
    const dh = source.height * scale;
    ctx.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return canvas;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function canvasToPng(canvas) {
    return canvasToBlob(canvas, "image/png");
  }

  async function canvasToJpg(canvas, bg) {
    const flat = document.createElement("canvas");
    flat.width = canvas.width;
    flat.height = canvas.height;
    const ctx = flat.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(canvas, 0, 0);
    return canvasToBlob(flat, "image/jpeg", 0.92);
  }

  function svgWrap(dataUrl, w, h) {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <title>Placement SVG. Raster artwork is embedded because the upload was not a path file.</title>
  <image href="${dataUrl}" width="${w}" height="${h}" />
</svg>`;
    return new Blob([svg], { type: "image/svg+xml" });
  }

  function buildIco(entries) {
    const count = entries.length;
    let offset = 6 + 16 * count;
    const total = entries.reduce((sum, e) => sum + e.bytes.length, offset);
    const buf = new Uint8Array(total);
    const view = new DataView(buf.buffer);
    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);
    view.setUint16(4, count, true);
    entries.forEach((e, n) => {
      const p = 6 + n * 16;
      buf[p] = e.size >= 256 ? 0 : e.size;
      buf[p + 1] = e.size >= 256 ? 0 : e.size;
      view.setUint16(p + 4, 1, true);
      view.setUint16(p + 6, 32, true);
      view.setUint32(p + 8, e.bytes.length, true);
      view.setUint32(p + 12, offset, true);
      buf.set(e.bytes, offset);
      offset += e.bytes.length;
    });
    return new Blob([buf], { type: "image/x-icon" });
  }

  function contactSheet(canvases) {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f3efe6";
    ctx.fillRect(0, 0, 1600, 900);
    const cells = [
      { x: 40, y: 120, w: 360, h: 680, bg: "#faf7f2", label: "Full colour" },
      { x: 420, y: 120, w: 360, h: 680, bg: "#1b1814", label: "Inverse" },
      { x: 800, y: 120, w: 360, h: 680, bg: "#faf7f2", label: "Black" },
      { x: 1180, y: 120, w: 360, h: 680, bg: "#1b1814", label: "White" }
    ];
    ctx.fillStyle = "#1b1814";
    ctx.font = "500 42px Georgia, serif";
    ctx.fillText(brandName.value.trim() || "Logo", 40, 68);
    ctx.font = "16px Georgia, serif";
    ctx.fillStyle = "#5e574c";
    ctx.fillText("Colourways · clear space included", 40, 96);
    canvases.forEach((src, i) => {
      const cell = cells[i];
      ctx.fillStyle = cell.bg;
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      const scale = Math.min((cell.w - 70) / src.width, (cell.h - 90) / src.height);
      const dw = src.width * scale;
      const dh = src.height * scale;
      ctx.drawImage(src, cell.x + (cell.w - dw) / 2, cell.y + (cell.h - dh) / 2 - 8, dw, dh);
      ctx.fillStyle = cell.bg === "#1b1814" ? "#d9d0c3" : "#5e574c";
      ctx.font = "14px monospace";
      ctx.fillText(cell.label.toUpperCase(), cell.x + 16, cell.y + cell.h - 18);
    });
    return canvas;
  }

  function addWrapped(doc, text, x, y, width, line) {
    const lines = doc.splitTextToSize(text, width);
    doc.text(lines, x, y);
    return y + lines.length * line;
  }

  function makeGuide(meta) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const name = meta.brand;
    const margin = 16;
    const width = 210 - margin * 2;
    let y = 22;

    doc.setFillColor(27, 24, 20);
    doc.rect(0, 0, 210, 38, "F");
    doc.setTextColor(243, 239, 230);
    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.text(name + "  ·  Logo file guide", margin, 18);
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.text("What each file is for, and where to use it.", margin, 28);
    doc.setTextColor(27, 24, 20);
    y = 50;
    doc.setFontSize(12);
    y = addWrapped(doc, "This package is the working set for the " + name + " logo. It is sorted by lockup, then by digital or print, then by colourway. Use the file that matches the surface. A flattened upload cannot be turned back into editable paths, so AI and EPS files appear only if they were added as source files.", margin, y, width, 6);
    y += 6;
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("Folder order", margin, y);
    y += 7;
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    const folders = [
      "01–04 lockups: Primary, Horizontal, Brandmark, Wordmark. Missing lockups are omitted rather than faked.",
      "01 Digital: RGB PNG, JPG, a placement SVG, and a placement PDF.",
      "02 Print: a print PDF plus CMYK notes. Pantone folders hold spot-colour instructions, not invented codes.",
      "05 Social & App and 06 Favicons: ready sizes for profiles, link cards, and browser icons.",
      "00 Source Files: original AI, EPS, SVG, or PDF files, copied unchanged."
    ];
    folders.forEach((line) => {
      y = addWrapped(doc, line, margin, y, width, 5.4);
      y += 2.2;
    });

    doc.addPage();
    y = 20;
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text("File types", margin, y);
    y += 8;
    const types = [
      ["PNG", "Pixels with transparency. Use on websites, apps, and social posts. Do not stretch a small PNG onto a billboard."],
      ["JPG", "Pixels without transparency, smaller files. Fine for quick previews and photo backgrounds. Not for knockout logos."],
      ["SVG", "A placement file that stays sharp in browsers. If the upload was a picture, the SVG embeds that picture. It is not a rebuilt path."],
      ["PDF", "The most portable print and share file. The PDFs here place the artwork; they are not a substitute for the original Illustrator document."],
      ["AI / EPS", "Editable source formats. Included only when you drop them into Oriel. EPS is older; some print shops still ask for it."]
    ];
    types.forEach(([title, body]) => {
      doc.setFont("times", "bold");
      doc.setFontSize(12);
      doc.text(title, margin, y);
      y += 5;
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      y = addWrapped(doc, body, margin, y, width, 5.2);
      y += 4;
    });

    doc.addPage();
    y = 20;
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text("Colour spaces and colourways", margin, y);
    y += 8;
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    y = addWrapped(doc, "RGB is for screens. Printing an RGB file can shift the colour. CMYK is the four process inks used for most print. Pantone, or spot colour, is a single mixed ink and has to be specified from a physical guide. Oriel records approximate CMYK from the pixels. Confirm those numbers with the printer before a press run.", margin, y, width, 5.4);
    y += 6;
    const ways = [
      ["Full colour", "Default mark on white or light grounds."],
      ["Inverse", "White silhouette for dark backgrounds, photography, and video."],
      ["Black", "One-colour black for stamps, newspaper, and single-ink print."],
      ["White", "One-colour white, same use as inverse when a solid knockout is required."]
    ];
    ways.forEach(([title, body]) => {
      doc.setFont("times", "bold");
      doc.text(title, margin, y);
      doc.setFont("times", "normal");
      y = addWrapped(doc, " — " + body, margin + doc.getTextWidth(title), y, width - doc.getTextWidth(title), 5.2);
      y += 3.5;
    });
    y += 4;
    doc.setFont("times", "bold");
    doc.text("Colours read from the primary artwork", margin, y);
    y += 6;
    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    if (!meta.colors.length) {
      doc.text("No opaque colours detected.", margin, y);
    }
    meta.colors.forEach((c) => {
      doc.setFillColor(c.r, c.g, c.b);
      doc.rect(margin, y - 3.2, 6, 6, "F");
      doc.setTextColor(27, 24, 20);
      doc.text(c.hex.toUpperCase() + "    RGB " + c.r + " " + c.g + " " + c.b + "    CMYK " + c.cmyk.c + " " + c.cmyk.m + " " + c.cmyk.y + " " + c.cmyk.k, margin + 9, y + 1);
      y += 8;
    });
    y += 4;
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    doc.text("CMYK figures are process approximations, not a press proof or a Pantone match.", margin, y);

    doc.addPage();
    y = 20;
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.setTextColor(27, 24, 20);
    doc.text("Sizes and a few rules", margin, y);
    y += 8;
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    y = addWrapped(doc, "Digital PNGs are exported at 512, 1024, and 1920 on the longest edge, with an optional 3840 master for 4K displays. Favicons run from 16 to 512, including a Windows .ico. Social plates are already composed on the primary colour: profile images, a 1200×630 link card, and covers for common networks.", margin, y, width, 5.4);
    y += 6;
    const rules = [
      "Keep the clear space that is already built into these exports. Do not crop it off.",
      "Do not recolor the full-colour file by hand. Use the black, white, or inverse file.",
      "Do not set type tighter than the wordmark, or rebuild the icon in another typeface.",
      "For large print, prefer the PDF in 02 Print, or the original vector in 00 Source Files.",
      "On the web, prefer SVG or a PNG at least twice the display size."
    ];
    rules.forEach((rule, i) => {
      y = addWrapped(doc, (i + 1) + ".  " + rule, margin, y, width, 5.4);
      y += 3;
    });
    y += 8;
    doc.setFont("times", "italic");
    doc.text("Packed by Oriel. Artwork remains the property of " + name + ".", margin, y);
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont("times", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120, 110, 98);
      doc.text(name + " logo package  ·  " + p + " / " + pages, margin, 290);
    }
    return doc.output("blob");
  }

  function makePrintPdf(canvas, title, note) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text(title, 16, 18);
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(note, 178);
    doc.text(lines, 16, 26);
    const data = canvas.toDataURL("image/png");
    const maxW = 170;
    const maxH = 200;
    const scale = Math.min(maxW / canvas.width, maxH / canvas.height);
    const w = canvas.width * scale;
    const h = canvas.height * scale;
    doc.addImage(data, "PNG", (210 - w) / 2, 48, w, h);
    doc.setFontSize(9);
    doc.setTextColor(90, 84, 74);
    doc.text("Placement file generated from the uploaded raster. Confirm colour with a printed proof.", 16, 285);
    return doc.output("blob");
  }

  function renderTree() {
    const name = slug(brandName.value);
    const lines = [`<b>${name}-Logo-Package/</b>`];
    lines.push("  00 Logo-File-Guide.pdf");
    lines.push("  00 Contact-Sheet.png");
    lines.push("  00 Read-Me.txt");
    if (sources.length) lines.push(`  00 Source Files/ <i>${sources.length} original${sources.length > 1 ? "s" : ""}</i>`);
    VARIATIONS.forEach((v) => {
      if (!slots[v.key]) return;
      lines.push(`  <b>${v.folder}/</b>`);
      lines.push("    01 Digital/  Full-Colour · Inverse · Black · White");
      lines.push("      PNG 512 / 1024 / 1920" + (include4k.checked ? " / 3840" : "") + " · JPG · SVG · PDF");
      if (includePrint.checked) lines.push("    02 Print/  CMYK pdf + notes · Pantone notes");
    });
    if (!slots.primary) lines.push("  <i>Add a primary logo to fill the map.</i>");
    if (includeSocial.checked && slots.primary) {
      lines.push("  <b>05 Social & App/</b>");
      lines.push("  <b>06 Favicons/</b>  16–512 · apple-touch · .ico");
    }
    tree.innerHTML = lines.join("<br>");
  }

  function setProgress(pct, label) {
    progress.classList.add("show");
    barFill.style.width = pct + "%";
    progressLabel.textContent = label;
  }

  async function prepareSlot(file) {
    const loaded = await loadImage(file);
    const base = canvasFrom(loaded.img, 2800);
    const info = analyze(base);
    return { file, img: loaded.img, url: loaded.url, base, info };
  }

  function paintDrop(drop, record) {
    const ph = drop.querySelector(".ph");
    let img = drop.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      img.alt = "";
      ph.replaceWith(img);
    }
    img.src = record.url;
    drop.querySelector("b").textContent = record.file.name;
    drop.querySelector("p").textContent = Math.round(record.file.size / 1024) + " KB · " + record.info.bounds.width + "×" + record.info.bounds.height + " crop";
  }

  async function onArtwork(slot, file, drop) {
    if (!file) return;
    try {
      const record = await prepareSlot(file);
      if (slots[slot] && slots[slot].url) URL.revokeObjectURL(slots[slot].url);
      slots[slot] = record;
      paintDrop(drop, record);
      if (slot === "primary") {
        if (!record.info.hasAlpha) keyWhite.checked = true;
        const sample = record.base.getContext("2d").getImageData(0, 0, record.base.width, record.base.height);
        if (keyWhite.checked) keyWhitePixels(sample);
        const colours = extractColors(sample);
        if (colours[0]) {
          brandColor.value = colours[0].hex;
          brandHex.value = colours[0].hex;
        }
        showPreview();
      }
      generateBtn.disabled = !slots.primary;
      renderTree();
    } catch (err) {
      drop.querySelector("p").textContent = err.message;
    }
  }

  function showPreview() {
    if (!slots.primary) return;
    const pad = Number(clearSpace.value) / 100;
    const full = cropPad(slots.primary.base, slots.primary.info.bounds, pad, "full", keyWhite.checked);
    const modes = ["full", "inverse", "black", "white"].map((mode) => cropPad(slots.primary.base, slots.primary.info.bounds, pad, mode, keyWhite.checked));
    emptyStage.hidden = true;
    masterPreview.hidden = false;
    masterPreview.src = full.toDataURL("image/png");
    variants.hidden = false;
    [...variants.querySelectorAll("img")].forEach((img, i) => {
      img.src = modes[i].toDataURL("image/png");
    });
    const b = slots.primary.info.bounds;
    const colours = extractColors(full.getContext("2d").getImageData(0, 0, full.width, full.height));
    metaRow.hidden = false;
    metaRow.innerHTML = "";
    const chips = [
      b.width + "×" + b.height + " crop",
      slots.primary.info.hasAlpha ? "Transparency detected" : "No transparency",
      "Clear space " + clearSpace.value + "%"
    ];
    chips.forEach((text) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = text;
      metaRow.appendChild(chip);
    });
    if (colours.length) {
      const wrap = document.createElement("span");
      wrap.className = "swatches";
      colours.forEach((c) => {
        const s = document.createElement("i");
        s.className = "swatch";
        s.style.background = c.hex;
        s.title = c.hex;
        wrap.appendChild(s);
      });
      metaRow.appendChild(wrap);
    }
  }

  async function buildPackage() {
    if (!slots.primary) return;
    generateBtn.disabled = true;
    result.classList.remove("show");
    const name = slug(brandName.value);
    const pretty = brandName.value.trim() || "Logo";
    const pad = Number(clearSpace.value) / 100;
    const zip = new JSZip();
    const root = zip.folder(name + "-Logo-Package");
    const brand = hexToRgb(brandHex.value || brandColor.value);
    const jpgColor = jpgBg.value === "black" ? "#111111" : jpgBg.value === "brand" ? brandHex.value : "#ffffff";
    let step = 0;
    const jobs = VARIATIONS.filter((v) => slots[v.key]).length * COLOURS.length + 4;
    const tick = (label) => {
      step += 1;
      setProgress(Math.min(96, Math.round((step / jobs) * 100)), label);
    };

    const primaryFull = cropPad(slots.primary.base, slots.primary.info.bounds, pad, "full", keyWhite.checked);
    const colors = extractColors(primaryFull.getContext("2d").getImageData(0, 0, primaryFull.width, primaryFull.height));
    const made = [];

    for (const variation of VARIATIONS) {
      const record = slots[variation.key];
      if (!record) continue;
      const vFolder = root.folder(variation.folder);
      const colourCanvases = [];
      for (const colour of COLOURS) {
        tick(variation.label + " · " + colour.label);
        const art = cropPad(record.base, record.info.bounds, pad, colour.mode, keyWhite.checked);
        colourCanvases.push(art);
        const digital = vFolder.folder("01 Digital").folder(colour.folder);
        const images = digital.folder("01 Images");
        const vectors = digital.folder("02 Vectors");
        const edges = [512, 1024, 1920];
        if (include4k.checked) edges.push(3840);
        for (const edge of edges) {
          const sized = fitLongEdge(art, edge);
          const png = await canvasToPng(sized);
          const file = `${name}_${variation.label}_${colour.label}_RGB_${edge}.png`;
          images.file("PNG/" + file, png);
          made.push(file);
        }
        const jpgSource = fitLongEdge(art, 1920);
        const jpg = await canvasToJpg(jpgSource, colour.mode === "white" || colour.mode === "inverse" ? "#1b1814" : jpgColor);
        images.file("JPG/" + `${name}_${variation.label}_${colour.label}_RGB_1920.jpg`, jpg);
        const svgSource = fitLongEdge(art, 1024);
        const svgUrl = await blobToDataUrl(await canvasToPng(svgSource));
        vectors.file(`${name}_${variation.label}_${colour.label}_RGB.svg`, svgWrap(svgUrl, svgSource.width, svgSource.height));
        const pdf = makePrintPdf(fitLongEdge(art, 1400), pretty + " · " + variation.label + " · " + colour.label + " · RGB", "Digital placement PDF. Colour is RGB, for screens and on-screen presentations. For press, use the print folder.");
        vectors.file(`${name}_${variation.label}_${colour.label}_RGB.pdf`, pdf);

        if (includePrint.checked) {
          const print = vFolder.folder("02 Print").folder(colour.folder);
          const cmykArt = document.createElement("canvas");
          cmykArt.width = art.width;
          cmykArt.height = art.height;
          const simulated = simulateCmyk(art.getContext("2d").getImageData(0, 0, art.width, art.height));
          cmykArt.getContext("2d").putImageData(simulated, 0, 0);
          const cmykPdf = makePrintPdf(fitLongEdge(cmykArt, 1400), pretty + " · " + variation.label + " · " + colour.label + " · CMYK preview", "Process-colour preview. Values below are converted from the uploaded RGB pixels and should be checked against a printed proof.");
          print.file("01 CMYK/" + `${name}_${variation.label}_${colour.label}_CMYK.pdf`, cmykPdf);
          const note = [
            pretty + " · " + variation.label + " · " + colour.label,
            "",
            "These CMYK numbers are approximations from the raster upload.",
            "They are not a substitute for a calibrated proof.",
            ""
          ];
          colors.forEach((c, i) => {
            note.push((i + 1) + ". " + c.hex.toUpperCase() + "  RGB " + [c.r, c.g, c.b].join(" ") + "  approx CMYK " + [c.cmyk.c, c.cmyk.m, c.cmyk.y, c.cmyk.k].join(" "));
          });
          print.file("01 CMYK/CMYK-notes.txt", note.join("\n"));
          if (colour.mode !== "white") {
            const pantone = [
              pretty + " · spot colour notes",
              "",
              "A Pantone (spot) colour is a single mixed ink. It cannot be recovered from a flattened image, and Oriel will not invent a Pantone code.",
              "Specify spot colours from your original vector file and a current Pantone guide before offset printing.",
              "",
              "Process approximations from this artwork:"
            ];
            colors.forEach((c, i) => {
              pantone.push((i + 1) + ". " + c.hex.toUpperCase() + "  approx CMYK " + [c.cmyk.c, c.cmyk.m, c.cmyk.y, c.cmyk.k].join(" "));
            });
            print.file("02 Pantone/SPOT-COLOUR-NOTES.txt", pantone.join("\n"));
            const spotPdf = makePrintPdf(fitLongEdge(art, 1400), pretty + " · " + variation.label + " · spot colour folder", "Use this PDF for placement only. Assign real Pantone values in the original vector file. See SPOT-COLOUR-NOTES.txt.");
            print.file("02 Pantone/" + `${name}_${variation.label}_${colour.label}_SPOT.pdf`, spotPdf);
          }
        }
        await new Promise((r) => setTimeout(r, 0));
      }
      if (variation.key === "primary") {
        tick("Contact sheet");
        root.file("00 Contact-Sheet.png", await canvasToPng(contactSheet(colourCanvases)));
      }
    }

    tick("File guide");
    root.file("00 Logo-File-Guide.pdf", makeGuide({ brand: pretty, colors }));
    const readme = [
      pretty + " logo package",
      "Packed by Oriel",
      "",
      "Start with 00 Logo-File-Guide.pdf.",
      "Lockups are numbered 01–04. Each contains 01 Digital and, if included, 02 Print.",
      "Digital images are RGB. Print PDFs are placement files with CMYK notes.",
      "SVG files scale on the web. If the upload was a picture, the SVG embeds that picture.",
      "AI and EPS files are included only in 00 Source Files, and only if you supplied them.",
      "",
      "Clear space: " + clearSpace.value + "% of the longest edge, already included.",
      "Primary colour: " + (brandHex.value || brandColor.value).toUpperCase(),
      ""
    ].join("\n");
    root.file("00 Read-Me.txt", readme);

    if (sources.length) {
      const src = root.folder("00 Source Files");
      sources.forEach((file) => src.file(file.name, file));
    }

    if (includeSocial.checked) {
      tick("Social and favicons");
      const iconSource = slots.icon
        ? cropPad(slots.icon.base, slots.icon.info.bounds, pad, "full", keyWhite.checked)
        : primaryFull;
      const iconWhite = slots.icon
        ? cropPad(slots.icon.base, slots.icon.info.bounds, pad, "white", keyWhite.checked)
        : cropPad(slots.primary.base, slots.primary.info.bounds, pad, "white", keyWhite.checked);
      const social = root.folder("05 Social & App");
      const bg = brandHex.value || "#1f3b31";
      const paper = "#f3efe6";
      const plates = [
        ["profile-instagram-1080.png", 1080, 1080, paper, iconSource],
        ["profile-x-400.png", 400, 400, paper, iconSource],
        ["profile-linkedin-400.png", 400, 400, paper, iconSource],
        ["profile-facebook-720.png", 720, 720, paper, iconSource],
        ["youtube-avatar-800.png", 800, 800, paper, iconSource],
        ["link-card-1200x630.png", 1200, 630, bg, iconWhite],
        ["x-header-1500x500.png", 1500, 500, bg, iconWhite],
        ["linkedin-cover-1584x396.png", 1584, 396, bg, iconWhite],
        ["facebook-cover-820x312.png", 820, 312, bg, iconWhite],
        ["email-signature-600.png", 600, 200, paper, iconSource]
      ];
      for (const [file, w, h, plateBg, art] of plates) {
        social.file(file, await canvasToPng(plate(art, w, h, plateBg)));
      }
      social.file("social-on-transparent-1024.png", await canvasToPng(fitSquare(iconSource, 1024, 0.16)));
      const fav = root.folder("06 Favicons");
      const icoEntries = [];
      for (const size of [16, 32, 48, 64, 128, 180, 192, 256, 512]) {
        const icon = fitSquare(iconSource, size, 0.12);
        const png = await canvasToPng(icon);
        const filename = size === 180 ? "apple-touch-icon-180.png" : size === 192 ? "android-chrome-192.png" : size === 512 ? "android-chrome-512.png" : "favicon-" + size + ".png";
        fav.file(filename, png);
        if (size <= 64) {
          const bytes = new Uint8Array(await png.arrayBuffer());
          icoEntries.push({ size, bytes });
        }
      }
      fav.file("favicon.ico", buildIco(icoEntries));
    }

    setProgress(98, "Compressing zip…");
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    setProgress(100, "Package ready.");
    const mb = (blob.size / 1024 / 1024).toFixed(1);
    result.classList.add("show");
    result.innerHTML = `<strong>Package ready.</strong> ${pretty} · ${mb} MB<button class="primary" id="download" style="margin-left:12px">Download zip</button>`;
    $("download").addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = url;
      a.download = name + "-Logo-Package.zip";
      a.click();
    });
    generateBtn.disabled = false;
  }

  document.querySelectorAll(".drop").forEach((drop) => {
    const input = drop.querySelector("input");
    const slot = drop.dataset.slot;
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.classList.add("drag");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("drag");
      const file = e.dataTransfer.files[0];
      if (slot === "sources") {
        sources = [...e.dataTransfer.files];
        drop.querySelector("b").textContent = sources.length + " source file" + (sources.length > 1 ? "s" : "");
        drop.querySelector("p").textContent = sources.map((f) => f.name).join(", ");
        renderTree();
        return;
      }
      onArtwork(slot, file, drop);
    });
    input.addEventListener("change", () => {
      if (slot === "sources") {
        sources = [...input.files];
        drop.querySelector("b").textContent = sources.length ? sources.length + " source file" + (sources.length > 1 ? "s" : "") : "AI, EPS, SVG, PDF";
        drop.querySelector("p").textContent = sources.length ? sources.map((f) => f.name).join(", ") : "Copied into 00 Source Files";
        renderTree();
        return;
      }
      onArtwork(slot, input.files[0], drop);
    });
  });

  brandColor.addEventListener("input", () => {
    brandHex.value = brandColor.value;
    renderTree();
  });
  brandHex.addEventListener("change", () => {
    if (/^#?[0-9a-fA-F]{6}$/.test(brandHex.value.trim())) {
      brandHex.value = brandHex.value.startsWith("#") ? brandHex.value : "#" + brandHex.value;
      brandColor.value = brandHex.value;
    }
  });
  brandName.addEventListener("input", renderTree);
  clearSpace.addEventListener("input", () => {
    clearLabel.textContent = clearSpace.value + "%";
    if (slots.primary) showPreview();
  });
  keyWhite.addEventListener("change", () => slots.primary && showPreview());
  [includeSocial, includePrint, include4k].forEach((el) => el.addEventListener("change", renderTree));
  generateBtn.addEventListener("click", () => {
    buildPackage().catch((err) => {
      progressLabel.textContent = err.message || "Could not build the package.";
      generateBtn.disabled = false;
    });
  });
  $("reset").addEventListener("click", () => location.reload());

  renderTree();
})();
