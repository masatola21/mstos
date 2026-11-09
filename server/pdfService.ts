import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface CustomerDoc {
  id: string;
  title: string;
  document_type?: string;
  body_html?: string | null;
  created_at?: string | null;
}

const FONT_CANDIDATES = [
  '/usr/share/fonts/opentype/unifont/unifont_jp.otf',
  '/usr/share/fonts/opentype/unifont/unifont.otf',
];

function getJapaneseFont(): string | null {
  for (const fontPath of FONT_CANDIDATES) {
    if (fs.existsSync(fontPath)) return fontPath;
  }
  return null;
}

// Convert HTML text to structural blocks
interface ParsedBlock {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'table' | 'hr';
  text?: string;
  rows?: string[][];
}

export function parseHtmlToBlocks(html: string): ParsedBlock[] {
  if (!html) return [];

  const blocks: ParsedBlock[] = [];
  // Normalize self-closing tags
  let cleaned = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Extract tables first
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const segmentHtml = (segment: string) => {
    // Split by block tags
    const tagRegex = /<(h[1-3]|p|div|hr|li)[^>]*>([\s\S]*?)<\/\1>|<(hr|br)\s*\/?>/gi;
    let m: RegExpExecArray | null;
    let currentIdx = 0;

    while ((m = tagRegex.exec(segment)) !== null) {
      const tag = (m[1] || m[3] || '').toLowerCase();
      const content = m[2] ? m[2].replace(/<[^>]+>/g, '').trim() : '';

      if (tag === 'h1' && content) {
        blocks.push({ type: 'h1', text: content });
      } else if (tag === 'h2' && content) {
        blocks.push({ type: 'h2', text: content });
      } else if (tag === 'h3' && content) {
        blocks.push({ type: 'h3', text: content });
      } else if (tag === 'hr') {
        blocks.push({ type: 'hr' });
      } else if (content) {
        blocks.push({ type: 'p', text: content });
      }
      currentIdx = tagRegex.lastIndex;
    }

    if (currentIdx < segment.length) {
      const leftover = segment.slice(currentIdx).replace(/<[^>]+>/g, '').trim();
      if (leftover) {
        blocks.push({ type: 'p', text: leftover });
      }
    }
  };

  while ((match = tableRegex.exec(cleaned)) !== null) {
    const beforeTable = cleaned.slice(lastIndex, match.index);
    if (beforeTable.trim()) {
      segmentHtml(beforeTable);
    }

    // Process table rows
    const tableContent = match[1];
    const rows: string[][] = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch: RegExpExecArray | null;

    while ((trMatch = trRegex.exec(tableContent)) !== null) {
      const rowContent = trMatch[1];
      const cells: string[] = [];
      const cellRegex = /<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        cells.push(cellMatch[2].replace(/<[^>]+>/g, '').trim());
      }
      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (rows.length > 0) {
      blocks.push({ type: 'table', rows });
    }

    lastIndex = tableRegex.lastIndex;
  }

  if (lastIndex < cleaned.length) {
    const remaining = cleaned.slice(lastIndex);
    if (remaining.trim()) {
      segmentHtml(remaining);
    }
  }

  return blocks;
}

export async function generateDocumentPdf(doc: CustomerDoc, companyName?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const pdf = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: doc.title || '書類',
          Author: '有限会社MST',
          Subject: doc.document_type || '重要書類',
        },
      });

      const fontPath = getJapaneseFont();
      if (fontPath) {
        pdf.font(fontPath);
      }

      const buffers: Buffer[] = [];
      pdf.on('data', (chunk) => buffers.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(buffers)));
      pdf.on('error', (err) => reject(err));

      const pageWidth = pdf.page.width - 80; // 595.28 - 80 = 515.28

      // 1. Header Section: Title
      pdf.fontSize(18).text(doc.title || '書類', { align: 'center' });
      pdf.moveDown(0.5);

      // Underline title
      const titleY = pdf.y;
      pdf.strokeColor('#334155').lineWidth(1.5).moveTo(40, titleY).lineTo(40 + pageWidth, titleY).stroke();
      pdf.moveDown(1);

      // 2. Metadata: Issue Date, No, and Companies
      const metaY = pdf.y;
      const createdDate = doc.created_at ? new Date(doc.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('ja-JP');

      // Left column: Client Name
      pdf.fontSize(12).text(`${companyName || 'お客様'} 御中`, 40, metaY);
      pdf.fontSize(9).fillColor('#64748b').text('いつも格別のご愛顧を賜り、厚く御礼申し上げます。', 40, metaY + 18);

      // Right column: Issuer (MST)
      pdf.fillColor('#0f172a').fontSize(9);
      const rightX = 340;
      pdf.text(`発行日: ${createdDate}`, rightX, metaY, { width: 215, align: 'right' });
      pdf.text(`書類番号: ${doc.id.slice(0, 8).toUpperCase()}`, rightX, metaY + 14, { width: 215, align: 'right' });
      pdf.moveDown(0.5);
      pdf.text('有限会社MST', rightX, metaY + 32, { width: 215, align: 'right' });
      pdf.text('〒100-0005 東京都千代田区丸の内', rightX, metaY + 44, { width: 215, align: 'right' });
      pdf.text('Email: contact@mstcorp.info', rightX, metaY + 56, { width: 215, align: 'right' });

      // Move down past header
      pdf.y = Math.max(pdf.y, metaY + 80);
      pdf.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, pdf.y).lineTo(40 + pageWidth, pdf.y).stroke();
      pdf.moveDown(1);

      // 3. Body Content Parsing
      const blocks = parseHtmlToBlocks(doc.body_html || '');

      for (const block of blocks) {
        // Check page break
        if (pdf.y > pdf.page.height - 80) {
          pdf.addPage();
          if (fontPath) pdf.font(fontPath);
        }

        if (block.type === 'h1') {
          pdf.fillColor('#0f172a').fontSize(14).text(block.text || '', { underline: false });
          pdf.moveDown(0.4);
        } else if (block.type === 'h2') {
          pdf.fillColor('#1e293b').fontSize(12).text(block.text || '');
          pdf.moveDown(0.3);
        } else if (block.type === 'h3') {
          pdf.fillColor('#334155').fontSize(11).text(block.text || '');
          pdf.moveDown(0.2);
        } else if (block.type === 'hr') {
          pdf.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(40, pdf.y).lineTo(40 + pageWidth, pdf.y).stroke();
          pdf.moveDown(0.5);
        } else if (block.type === 'p') {
          pdf.fillColor('#1e293b').fontSize(10).text(block.text || '', {
            lineGap: 3,
            width: pageWidth,
          });
          pdf.moveDown(0.5);
        } else if (block.type === 'table' && block.rows && block.rows.length > 0) {
          const colCount = Math.max(...block.rows.map((r) => r.length));
          if (colCount > 0) {
            const colWidth = pageWidth / colCount;
            const startY = pdf.y;

            block.rows.forEach((row, rowIdx) => {
              if (pdf.y > pdf.page.height - 70) {
                pdf.addPage();
                if (fontPath) pdf.font(fontPath);
              }

              const rowY = pdf.y;
              const isHeader = rowIdx === 0;

              // Row background for header
              if (isHeader) {
                pdf.rect(40, rowY, pageWidth, 20).fill('#f1f5f9');
                pdf.fillColor('#0f172a');
              } else {
                pdf.fillColor('#334155');
              }

              // Draw cells
              row.forEach((cellText, colIdx) => {
                const cellX = 40 + colIdx * colWidth + 4;
                pdf.fontSize(isHeader ? 9 : 8.5).text(cellText, cellX, rowY + 5, {
                  width: colWidth - 8,
                  align: isHeader ? 'center' : /^[0-9,¥\\$\\%]+$/.test(cellText.trim()) ? 'right' : 'left',
                });
              });

              // Row border
              pdf.strokeColor('#cbd5e1').lineWidth(0.5).rect(40, rowY, pageWidth, 20).stroke();
              pdf.y = rowY + 20;
            });
            pdf.moveDown(0.8);
          }
        }
      }

      // 4. Footer Note
      if (pdf.y > pdf.page.height - 60) {
        pdf.addPage();
        if (fontPath) pdf.font(fontPath);
      }
      pdf.moveDown(1);
      pdf.fillColor('#64748b').fontSize(8).text('※ 本書は有限会社MSTより電子的に作成・発行された重要書類です。', 40, pdf.y, {
        align: 'center',
        width: pageWidth,
      });

      pdf.end();
    } catch (err) {
      reject(err);
    }
  });
}
