import {
  RICH_MENU_HEIGHT,
  RICH_MENU_WIDTH,
  type RichMenuActionItem,
  type RichMenuBounds,
  type RichMenuLayoutId,
  getRichMenuLayoutAreas,
} from './lineRichMenuLayouts';

export interface RenderedRichMenuImage {
  base64: string;
  mime: 'image/png' | 'image/jpeg';
  url: string;
  byteLength: number;
}

const FONT_SANS =
  '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", Meiryo, sans-serif';

type TileTheme = 'hero-navy' | 'cobalt-booking' | 'teal-care' | 'ivory-media' | 'line-chat';

interface TileVisualSpec {
  badge: string;
  titleLines: string[];
  subtitle: string;
  cta: string;
  theme: TileTheme;
  iconKind: 'chart' | 'calendar' | 'care' | 'media' | 'chat' | 'grid';
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function splitTitleToFit(label: string, maxCharsPerLine: number): string[] {
  const clean = (label || '').trim();
  if (!clean) return ['メニュー'];
  if (clean.includes('\n')) return clean.split('\n').slice(0, 2);
  if (clean === '30分無料面談予約') return ['30分無料', '面談予約'];
  if (clean === '介護保険外開業専用ページ') return ['介護保険外', '開業専用ページ'];
  if (clean === '介護保険外開業') return ['介護保険外', '開業支援'];
  if (clean === '公式メディア') return ['公式', 'メディア'];
  if (clean === 'LINE相談') return ['LINE相談'];
  if (clean.length <= maxCharsPerLine) return [clean];
  const mid = Math.ceil(clean.length / 2);
  return [clean.slice(0, mid), clean.slice(mid)];
}

/**
 * Finds the largest font size (up to maxFontSize, down to minFontSize) so every line fits inside maxWidth.
 */
function fitFontSizeForLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  maxFontSize: number,
  minFontSize: number,
  maxWidth: number,
  weight = 800
): number {
  for (let size = maxFontSize; size >= minFontSize; size -= 2) {
    ctx.font = `${weight} ${size}px ${FONT_SANS}`;
    const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
    if (widest <= maxWidth) return size;
  }
  return minFontSize;
}

function getThemeColors(theme: TileTheme) {
  switch (theme) {
    case 'hero-navy':
      return {
        bgStart: '#06132E',
        bgEnd: '#102D6B',
        topStripe: '#FBBF24',
        border: '#EAB308',
        titleColor: '#FFFFFF',
        subtitleColor: '#E0ECFF',
        badgeBg: 'rgba(251, 191, 36, 0.22)',
        badgeBorder: '#FBBF24',
        badgeText: '#FEF08A',
        ctaBg: '#FBBF24',
        ctaText: '#06132E',
        ctaBorder: '#FDE68A',
        iconStroke: '#FEF08A',
        iconAccent: '#34D399',
        watermarkOpacity: 0.16,
      };
    case 'cobalt-booking':
      return {
        bgStart: '#1E40AF',
        bgEnd: '#0284C7',
        topStripe: '#7DD3FC',
        border: '#7DD3FC',
        titleColor: '#FFFFFF',
        subtitleColor: '#E0F2FE',
        badgeBg: 'rgba(255, 255, 255, 0.18)',
        badgeBorder: '#BAE6FD',
        badgeText: '#FFFFFF',
        ctaBg: '#FFFFFF',
        ctaText: '#1E3A8A',
        ctaBorder: '#FFFFFF',
        iconStroke: '#FFFFFF',
        iconAccent: '#FDE047',
        watermarkOpacity: 0.2,
      };
    case 'teal-care':
      return {
        bgStart: '#0F4C3A',
        bgEnd: '#0D7A5F',
        topStripe: '#6EE7B7',
        border: '#6EE7B7',
        titleColor: '#FFFFFF',
        subtitleColor: '#D1FAE5',
        badgeBg: 'rgba(251, 191, 36, 0.22)',
        badgeBorder: '#FCD34D',
        badgeText: '#FEF3C7',
        ctaBg: '#FCD34D',
        ctaText: '#064E3B',
        ctaBorder: '#FDE68A',
        iconStroke: '#ECFDF5',
        iconAccent: '#FBBF24',
        watermarkOpacity: 0.2,
      };
    case 'ivory-media':
      return {
        bgStart: '#FFFDF7',
        bgEnd: '#F2EBD9',
        topStripe: '#D97706',
        border: '#D97706',
        titleColor: '#0A1B43',
        subtitleColor: '#334155',
        badgeBg: '#FEF3C7',
        badgeBorder: '#D97706',
        badgeText: '#92400E',
        ctaBg: '#0F2B6B',
        ctaText: '#FFFFFF',
        ctaBorder: '#0F2B6B',
        iconStroke: '#0F2B6B',
        iconAccent: '#D97706',
        watermarkOpacity: 0.14,
      };
    case 'line-chat':
      return {
        bgStart: '#047857',
        bgEnd: '#06C755',
        topStripe: '#FFFFFF',
        border: '#A7F3D0',
        titleColor: '#FFFFFF',
        subtitleColor: '#ECFDF5',
        badgeBg: 'rgba(255, 255, 255, 0.22)',
        badgeBorder: '#FFFFFF',
        badgeText: '#FFFFFF',
        ctaBg: '#FFFFFF',
        ctaText: '#065F46',
        ctaBorder: '#FFFFFF',
        iconStroke: '#FFFFFF',
        iconAccent: '#FEF08A',
        watermarkOpacity: 0.22,
      };
  }
}

function drawTileIcon(
  ctx: CanvasRenderingContext2D,
  kind: TileVisualSpec['iconKind'],
  cx: number,
  cy: number,
  size: number,
  strokeColor: string,
  accentColor: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (kind === 'chart') {
    const boxW = size * 1.16;
    const boxH = size * 0.86;
    drawRoundedRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, size * 0.11);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.fill();
    ctx.lineWidth = Math.max(5, size * 0.028);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 2.5;
    for (let i = 1; i <= 3; i++) {
      const ly = -boxH / 2 + (boxH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(-boxW * 0.42, ly);
      ctx.lineTo(boxW * 0.42, ly);
      ctx.stroke();
    }

    const barHeights = [0.28, 0.46, 0.38, 0.72];
    const barW = boxW * 0.13;
    const gap = boxW * 0.075;
    const startX = -boxW * 0.37;
    const baseY = boxH * 0.35;
    barHeights.forEach((hRatio, idx) => {
      const bh = boxH * hRatio;
      const bx = startX + idx * (barW + gap);
      drawRoundedRect(ctx, bx, baseY - bh, barW, bh, 9);
      ctx.fillStyle = idx === 3 ? '#FBBF24' : 'rgba(224, 236, 255, 0.82)';
      ctx.fill();
    });

    ctx.beginPath();
    ctx.lineWidth = Math.max(8, size * 0.044);
    ctx.strokeStyle = '#34D399';
    ctx.moveTo(startX + barW * 0.5, baseY - boxH * 0.34);
    ctx.lineTo(startX + barW * 1.5 + gap, baseY - boxH * 0.52);
    ctx.lineTo(startX + barW * 2.5 + gap * 2, baseY - boxH * 0.44);
    ctx.lineTo(startX + barW * 3.5 + gap * 3, baseY - boxH * 0.76);
    ctx.stroke();
  } else if (kind === 'calendar') {
    const s = size * 0.45;
    ctx.lineWidth = Math.max(7, size * 0.065);
    ctx.strokeStyle = strokeColor;
    drawRoundedRect(ctx, -s, -s * 0.85, s * 2, s * 1.85, size * 0.14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.25);
    ctx.lineTo(s, -s * 0.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, -s * 1.08);
    ctx.lineTo(-s * 0.45, -s * 0.65);
    ctx.moveTo(s * 0.45, -s * 1.08);
    ctx.lineTo(s * 0.45, -s * 0.65);
    ctx.stroke();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = Math.max(8, size * 0.08);
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, s * 0.28);
    ctx.lineTo(-s * 0.08, s * 0.58);
    ctx.lineTo(s * 0.48, s * 0.02);
    ctx.stroke();
  } else if (kind === 'care') {
    const s = size * 0.46;
    ctx.lineWidth = Math.max(7, size * 0.065);
    ctx.strokeStyle = strokeColor;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.92);
    ctx.lineTo(0, -s * 0.08);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-s * 0.96, -s * 0.14, -s * 0.76, -s * 0.88);
    ctx.quadraticCurveTo(-s * 0.04, -s * 0.9, 0, 0);
    ctx.fillStyle = 'rgba(110, 231, 183, 0.32)';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, s * 0.22);
    ctx.quadraticCurveTo(s * 0.96, 0, s * 0.84, -s * 0.72);
    ctx.quadraticCurveTo(s * 0.1, -s * 0.76, 0, s * 0.22);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.36)';
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.stroke();
  } else if (kind === 'media') {
    const s = size * 0.45;
    ctx.lineWidth = Math.max(7, size * 0.065);
    ctx.strokeStyle = strokeColor;
    drawRoundedRect(ctx, -s, -s * 0.85, s * 2, s * 1.7, size * 0.12);
    ctx.fillStyle = 'rgba(15, 43, 107, 0.07)';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = accentColor;
    drawRoundedRect(ctx, -s * 0.68, -s * 0.52, s * 0.72, s * 0.54, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.18, -s * 0.42);
    ctx.lineTo(s * 0.7, -s * 0.42);
    ctx.moveTo(s * 0.18, -s * 0.1);
    ctx.lineTo(s * 0.7, -s * 0.1);
    ctx.moveTo(-s * 0.68, s * 0.26);
    ctx.lineTo(s * 0.7, s * 0.26);
    ctx.moveTo(-s * 0.68, s * 0.54);
    ctx.lineTo(s * 0.36, s * 0.54);
    ctx.stroke();
  } else if (kind === 'chat') {
    const s = size * 0.46;
    ctx.lineWidth = Math.max(7, size * 0.065);
    ctx.strokeStyle = strokeColor;
    ctx.beginPath();
    ctx.moveTo(-s * 0.82, -s * 0.68);
    ctx.lineTo(s * 0.82, -s * 0.68);
    ctx.quadraticCurveTo(s, -s * 0.68, s, -s * 0.48);
    ctx.lineTo(s, s * 0.35);
    ctx.quadraticCurveTo(s, s * 0.55, s * 0.82, s * 0.55);
    ctx.lineTo(-s * 0.18, s * 0.55);
    ctx.lineTo(-s * 0.62, s * 0.92);
    ctx.lineTo(-s * 0.52, s * 0.55);
    ctx.lineTo(-s * 0.82, s * 0.55);
    ctx.quadraticCurveTo(-s, s * 0.55, -s, s * 0.35);
    ctx.lineTo(-s, -s * 0.48);
    ctx.quadraticCurveTo(-s, -s * 0.68, -s * 0.82, -s * 0.68);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accentColor;
    [-0.36, 0, 0.36].forEach((offset) => {
      ctx.beginPath();
      ctx.arc(s * offset, -s * 0.06, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    const s = size * 0.38;
    ctx.lineWidth = Math.max(6, size * 0.06);
    ctx.strokeStyle = strokeColor;
    drawRoundedRect(ctx, -s, -s, s * 2, s * 2, size * 0.14);
    ctx.stroke();
  }

  ctx.restore();
}

function buildVisualSpecForTile(
  layoutId: RichMenuLayoutId,
  index: number,
  action?: RichMenuActionItem
): TileVisualSpec {
  const customLabel = (action?.label || '').trim();
  const isFiveSplit = layoutId === 'split-2-1-3' || layoutId === 'split-2-3';

  if (isFiveSplit) {
    if (index === 0) {
      return {
        badge: '無料・登録不要',
        titleLines: splitTitleToFit(customLabel || '3分無料経営診断', 10),
        subtitle: '約3分でその場に簡易結果を表示',
        cta: '今すぐ診断スタート  ›',
        theme: 'hero-navy',
        iconKind: 'chart',
      };
    }
    if (index === 1) {
      return {
        badge: 'ZOOM・オンライン',
        titleLines: splitTitleToFit(customLabel || '30分無料面談予約', 6),
        subtitle: '代表・大橋に直接相談',
        cta: '空き日程を見る  ›',
        theme: 'cobalt-booking',
        iconKind: 'calendar',
      };
    }
    if (index === 2) {
      return {
        badge: '新規参入・開業支援',
        titleLines: splitTitleToFit(customLabel || '介護保険外開業専用ページ', 7),
        subtitle: '収益モデル・導入事例',
        cta: '専用ページへ  ›',
        theme: 'teal-care',
        iconKind: 'care',
      };
    }
    if (index === 3) {
      return {
        badge: 'MST MEDIA',
        titleLines: splitTitleToFit(customLabel || '公式メディア', 7),
        subtitle: '改善ノウハウ・事例記事',
        cta: '記事を読む  ›',
        theme: 'ivory-media',
        iconKind: 'media',
      };
    }
    if (index === 4) {
      return {
        badge: 'チャット受付',
        titleLines: splitTitleToFit(customLabel || 'LINE相談', 7),
        subtitle: '一言OK・担当が返信',
        cta: 'メッセージを送る  ›',
        theme: 'line-chat',
        iconKind: 'chat',
      };
    }
  }

  const themeCycle: TileTheme[] = ['hero-navy', 'cobalt-booking', 'teal-care', 'ivory-media', 'line-chat', 'cobalt-booking'];
  const iconCycle: TileVisualSpec['iconKind'][] = ['chart', 'calendar', 'care', 'media', 'chat', 'grid'];
  const isMessage = action?.type === 'message';
  return {
    badge: isMessage ? 'チャット相談' : 'MST 公式案内',
    titleLines: splitTitleToFit(customLabel || `メニュー ${index + 1}`, 7),
    subtitle: isMessage ? 'タップして相談開始' : 'タップして詳細を開く',
    cta: isMessage ? '相談する  ›' : '開く  ›',
    theme: themeCycle[index % themeCycle.length],
    iconKind: isMessage ? 'chat' : iconCycle[index % iconCycle.length],
  };
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  bounds: RichMenuBounds,
  spec: TileVisualSpec,
  index: number,
  isHeroWide: boolean
) {
  const colors = getThemeColors(spec.theme);
  const pad = 11;
  const x = bounds.x + pad;
  const y = bounds.y + pad;
  const w = bounds.width - pad * 2;
  const h = bounds.height - pad * 2;

  ctx.save();

  // Tile Card Surface
  drawRoundedRect(ctx, x, y, w, h, 30);
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, colors.bgStart);
  grad.addColorStop(1, colors.bgEnd);
  ctx.fillStyle = grad;
  ctx.fill();

  // Top color accent stripe inside clipped rounded card
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, 30);
  ctx.clip();
  ctx.fillStyle = colors.topStripe;
  ctx.fillRect(x, y, w, isHeroWide ? 14 : 12);

  if (spec.theme === 'hero-navy') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 2;
    for (let gx = x + 80; gx < x + w; gx += 80) {
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();
    }
    for (let gy = y + 80; gy < y + h; gy += 80) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }
    const radial = ctx.createRadialGradient(x + w * 0.82, y + h * 0.48, 40, x + w * 0.82, y + h * 0.48, w * 0.46);
    radial.addColorStop(0, 'rgba(251, 191, 36, 0.26)');
    radial.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();

  // Outer card border
  drawRoundedRect(ctx, x, y, w, h, 30);
  ctx.lineWidth = 4;
  ctx.strokeStyle = colors.border;
  ctx.stroke();

  if (isHeroWide && w >= 1400) {
    // Wide Hero Tile Layout (Left: Large Mobile-Legible Copy + CTA, Right: Diagnostic Graph)
    const innerPadX = 68;
    const innerPadY = 58;
    const textAreaMaxW = w - innerPadX - 490;

    // Right illustration
    drawTileIcon(ctx, spec.iconKind, x + w - 255, y + h * 0.52, 370, colors.iconStroke, colors.iconAccent);

    // Top badge pill
    ctx.font = `800 38px ${FONT_SANS}`;
    const badgeMetrics = ctx.measureText(spec.badge);
    const badgeW = badgeMetrics.width + 52;
    const badgeH = 66;
    drawRoundedRect(ctx, x + innerPadX, y + innerPadY, badgeW, badgeH, 33);
    ctx.fillStyle = colors.badgeBg;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = colors.badgeBorder;
    ctx.stroke();

    ctx.fillStyle = colors.badgeText;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(spec.badge, x + innerPadX + 26, y + innerPadY + badgeH / 2 + 1);

    // Big Mobile-Legible Headline
    const titleMax = spec.titleLines.length > 1 ? 106 : 126;
    const titleFontSize = fitFontSizeForLines(ctx, spec.titleLines, titleMax, 76, textAreaMaxW, 800);
    const titleLineH = Math.round(titleFontSize * 1.2);
    ctx.font = `800 ${titleFontSize}px ${FONT_SANS}`;
    ctx.fillStyle = colors.titleColor;
    ctx.textBaseline = 'top';
    const titleStartY = y + innerPadY + 98;
    spec.titleLines.forEach((line, lineIdx) => {
      ctx.fillText(line, x + innerPadX, titleStartY + lineIdx * titleLineH);
    });

    // Clear Subtitle
    const subtitleY = titleStartY + spec.titleLines.length * titleLineH + 26;
    ctx.font = `700 48px ${FONT_SANS}`;
    ctx.fillStyle = colors.subtitleColor;
    ctx.fillText(spec.subtitle, x + innerPadX, subtitleY, textAreaMaxW);

    // Bold Gold CTA Pill
    ctx.font = `800 46px ${FONT_SANS}`;
    const ctaTextW = ctx.measureText(spec.cta).width;
    const ctaW = Math.min(textAreaMaxW, ctaTextW + 92);
    const ctaH = 102;
    const ctaY = y + h - innerPadY - ctaH;
    drawRoundedRect(ctx, x + innerPadX, ctaY, ctaW, ctaH, 51);
    ctx.fillStyle = colors.ctaBg;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = colors.ctaBorder;
    ctx.stroke();

    ctx.fillStyle = colors.ctaText;
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.cta, x + innerPadX + 46, ctaY + ctaH / 2 + 1, ctaW - 60);

    // Subtle MST watermark top-right
    ctx.font = `700 28px ${FONT_SANS}`;
    ctx.fillStyle = 'rgba(254, 240, 138, 0.78)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('有限会社MST', x + w - 52, y + 48);
  } else {
    // Standard / Compact Tile Layout — High-Contrast & Extra-Large Mobile Typography
    const compactScale = h < 650 ? 0.78 : w < 700 ? 0.85 : 1;
    const innerPadX = Math.round(44 * compactScale);
    const innerPadY = Math.round(44 * compactScale);
    const contentMaxW = w - innerPadX * 2;

    // Expressive large topic icon top-right
    const iconSize = Math.round(140 * compactScale);
    drawTileIcon(
      ctx,
      spec.iconKind,
      x + w - innerPadX - iconSize * 0.42,
      y + innerPadY + iconSize * 0.5,
      iconSize,
      colors.iconStroke,
      colors.iconAccent
    );

    // Top badge pill
    const badgeFontSize = Math.round(32 * compactScale);
    ctx.font = `800 ${badgeFontSize}px ${FONT_SANS}`;
    const badgeMetrics = ctx.measureText(spec.badge);
    const badgeMaxW = w - innerPadX * 2 - Math.round(135 * compactScale);
    const badgeW = Math.min(badgeMaxW, badgeMetrics.width + Math.round(38 * compactScale));
    const badgeH = Math.round(56 * compactScale);
    drawRoundedRect(ctx, x + innerPadX, y + innerPadY, badgeW, badgeH, badgeH / 2);
    ctx.fillStyle = colors.badgeBg;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = colors.badgeBorder;
    ctx.stroke();

    ctx.fillStyle = colors.badgeText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.badge, x + innerPadX + Math.round(19 * compactScale), y + innerPadY + badgeH / 2 + 1, badgeW - Math.round(34 * compactScale));

    // Large Bold Headline (dynamically sized to maximize mobile legibility without clipping)
    const desiredTitleMax = Math.round((spec.titleLines.length > 1 ? 94 : 106) * compactScale);
    const desiredTitleMin = Math.round(58 * compactScale);
    const titleFontSize = fitFontSizeForLines(ctx, spec.titleLines, desiredTitleMax, desiredTitleMin, contentMaxW, 800);
    const lineHeight = Math.round(titleFontSize * 1.18);
    ctx.font = `800 ${titleFontSize}px ${FONT_SANS}`;
    ctx.fillStyle = colors.titleColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const middleStartY = y + Math.round(h * (spec.titleLines.length > 1 ? 0.275 : 0.315));
    spec.titleLines.forEach((line, lineIdx) => {
      ctx.fillText(line, x + innerPadX, middleStartY + lineIdx * lineHeight, contentMaxW);
    });

    // Clear high-contrast Subtitle
    const subtitleY = middleStartY + spec.titleLines.length * lineHeight + Math.round(22 * compactScale);
    const subFontSize = Math.round(40 * compactScale);
    ctx.font = `700 ${subFontSize}px ${FONT_SANS}`;
    ctx.fillStyle = colors.subtitleColor;
    ctx.fillText(spec.subtitle, x + innerPadX, subtitleY, contentMaxW);

    // High-contrast CTA Pill at bottom
    const ctaFontSize = Math.round(42 * compactScale);
    ctx.font = `800 ${ctaFontSize}px ${FONT_SANS}`;
    const ctaTextW = ctx.measureText(spec.cta).width;
    const ctaW = Math.min(contentMaxW, ctaTextW + Math.round(72 * compactScale));
    const ctaH = Math.round(86 * compactScale);
    const ctaY = y + h - innerPadY - ctaH;
    drawRoundedRect(ctx, x + innerPadX, ctaY, ctaW, ctaH, ctaH / 2);
    ctx.fillStyle = colors.ctaBg;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = colors.ctaBorder;
    ctx.stroke();

    ctx.fillStyle = colors.ctaText;
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.cta, x + innerPadX + Math.round(36 * compactScale), ctaY + ctaH / 2 + 1, ctaW - Math.round(48 * compactScale));

    // Subtle tile number bottom-right
    ctx.font = `800 ${Math.round(26 * compactScale)}px ${FONT_SANS}`;
    ctx.fillStyle = spec.theme === 'ivory-media' ? 'rgba(15, 43, 107, 0.32)' : 'rgba(255, 255, 255, 0.38)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1).padStart(2, '0'), x + w - innerPadX, ctaY + ctaH / 2);
  }

  ctx.restore();
}

export async function renderMstRichMenuImage(options: {
  layout: RichMenuLayoutId;
  actions: RichMenuActionItem[];
}): Promise<RenderedRichMenuImage> {
  const canvas = document.createElement('canvas');
  canvas.width = RICH_MENU_WIDTH;
  canvas.height = RICH_MENU_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas コンテキストを作成できませんでした。');
  }

  // Ensure web fonts if ready (non-blocking)
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 250)),
    ]);
  }

  // Deep Slate-Navy canvas base (acts as clean gutter between cards)
  ctx.fillStyle = '#07122E';
  ctx.fillRect(0, 0, RICH_MENU_WIDTH, RICH_MENU_HEIGHT);

  const areas = getRichMenuLayoutAreas(options.layout);
  areas.forEach((bounds, index) => {
    const spec = buildVisualSpecForTile(options.layout, index, options.actions[index]);
    const isHeroWide = index === 0 && bounds.width >= 1400;
    drawTile(ctx, bounds, spec, index, isHeroWide);
  });

  // Try PNG first if under 950KB, otherwise high-quality JPEG guaranteed under 1MB
  const tryEncode = (mime: 'image/png' | 'image/jpeg', quality?: number): string => {
    return canvas.toDataURL(mime, quality);
  };

  const estimateBytes = (dataUrl: string): number => {
    const base64 = dataUrl.split(',')[1] || '';
    return Math.floor((base64.length * 3) / 4);
  };

  let chosenUrl = tryEncode('image/png');
  let chosenMime: 'image/png' | 'image/jpeg' = 'image/png';
  let byteLength = estimateBytes(chosenUrl);

  if (byteLength > 950 * 1024) {
    for (const q of [0.92, 0.86, 0.8, 0.72]) {
      const jpegUrl = tryEncode('image/jpeg', q);
      const jpegBytes = estimateBytes(jpegUrl);
      chosenUrl = jpegUrl;
      chosenMime = 'image/jpeg';
      byteLength = jpegBytes;
      if (jpegBytes <= 950 * 1024) break;
    }
  }

  return {
    base64: chosenUrl.split(',')[1] || '',
    mime: chosenMime,
    url: chosenUrl,
    byteLength,
  };
}
