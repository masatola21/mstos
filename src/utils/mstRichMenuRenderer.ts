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

interface TileVisualSpec {
  badge: string;
  titleLines: string[];
  subtitle: string;
  cta: string;
  theme: 'hero-navy' | 'navy' | 'forest' | 'sand' | 'emerald';
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
  if (clean === '介護保険外開業') return ['介護保険外', '開業専用ページ'];
  if (clean.length <= maxCharsPerLine) return [clean];
  const mid = Math.ceil(clean.length / 2);
  return [clean.slice(0, mid), clean.slice(mid)];
}

function getThemeColors(theme: TileVisualSpec['theme']) {
  switch (theme) {
    case 'hero-navy':
      return {
        bgStart: '#08173A',
        bgEnd: '#13347A',
        border: '#C5A059',
        titleColor: '#FFFFFF',
        subtitleColor: '#DCEBFE',
        badgeBg: 'rgba(197, 160, 89, 0.22)',
        badgeBorder: '#D4AF37',
        badgeText: '#F3ECCC',
        ctaBg: '#D4AF37',
        ctaText: '#08173A',
        ctaBorder: '#E7D897',
        iconStroke: '#F3ECCC',
        iconAccent: '#40916C',
      };
    case 'navy':
      return {
        bgStart: '#0F275C',
        bgEnd: '#1C3F8C',
        border: '#C5A059',
        titleColor: '#FFFFFF',
        subtitleColor: '#DCEBFE',
        badgeBg: 'rgba(255, 255, 255, 0.12)',
        badgeBorder: 'rgba(212, 175, 55, 0.7)',
        badgeText: '#F3ECCC',
        ctaBg: 'rgba(212, 175, 55, 0.18)',
        ctaText: '#F3ECCC',
        ctaBorder: '#D4AF37',
        iconStroke: '#F3ECCC',
        iconAccent: '#D4AF37',
      };
    case 'forest':
      return {
        bgStart: '#123124',
        bgEnd: '#1F513C',
        border: '#6FA990',
        titleColor: '#FFFFFF',
        subtitleColor: '#E1EFE8',
        badgeBg: 'rgba(111, 169, 144, 0.2)',
        badgeBorder: '#9BC7B3',
        badgeText: '#E1EFE8',
        ctaBg: 'rgba(255, 255, 255, 0.12)',
        ctaText: '#FFFFFF',
        ctaBorder: '#9BC7B3',
        iconStroke: '#E1EFE8',
        iconAccent: '#D4AF37',
      };
    case 'sand':
      return {
        bgStart: '#FDFCFB',
        bgEnd: '#F1EFE9',
        border: '#C5A059',
        titleColor: '#0A1B43',
        subtitleColor: '#475569',
        badgeBg: '#FAF7EE',
        badgeBorder: '#C5A059',
        badgeText: '#7E632D',
        ctaBg: '#0F2B6B',
        ctaText: '#FFFFFF',
        ctaBorder: '#0F2B6B',
        iconStroke: '#0F2B6B',
        iconAccent: '#C5A059',
      };
    case 'emerald':
      return {
        bgStart: '#0A4E3B',
        bgEnd: '#13795B',
        border: '#6EE7B7',
        titleColor: '#FFFFFF',
        subtitleColor: '#ECFDF5',
        badgeBg: 'rgba(255, 255, 255, 0.16)',
        badgeBorder: 'rgba(255, 255, 255, 0.45)',
        badgeText: '#FFFFFF',
        ctaBg: '#FFFFFF',
        ctaText: '#0A4E3B',
        ctaBorder: '#FFFFFF',
        iconStroke: '#FFFFFF',
        iconAccent: '#F3ECCC',
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
    // Diagnostic Dashboard Graphic (Bars + Upward Curve)
    const boxW = size * 1.15;
    const boxH = size * 0.85;
    drawRoundedRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, size * 0.1);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fill();
    ctx.lineWidth = Math.max(4, size * 0.025);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
    ctx.stroke();

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2;
    for (let i = 1; i <= 3; i++) {
      const ly = -boxH / 2 + (boxH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(-boxW * 0.42, ly);
      ctx.lineTo(boxW * 0.42, ly);
      ctx.stroke();
    }

    // 4 Bars
    const barHeights = [0.28, 0.46, 0.38, 0.68];
    const barW = boxW * 0.12;
    const gap = boxW * 0.08;
    const startX = -boxW * 0.36;
    const baseY = boxH * 0.34;
    barHeights.forEach((hRatio, idx) => {
      const bh = boxH * hRatio;
      const bx = startX + idx * (barW + gap);
      drawRoundedRect(ctx, bx, baseY - bh, barW, bh, 8);
      ctx.fillStyle = idx === 3 ? '#D4AF37' : 'rgba(220, 235, 254, 0.72)';
      ctx.fill();
    });

    // Upward trend line
    ctx.beginPath();
    ctx.lineWidth = Math.max(6, size * 0.038);
    ctx.strokeStyle = '#6EE7B7';
    ctx.moveTo(startX + barW * 0.5, baseY - boxH * 0.34);
    ctx.lineTo(startX + barW * 1.5 + gap, baseY - boxH * 0.52);
    ctx.lineTo(startX + barW * 2.5 + gap * 2, baseY - boxH * 0.44);
    ctx.lineTo(startX + barW * 3.5 + gap * 3, baseY - boxH * 0.73);
    ctx.stroke();
  } else if (kind === 'calendar') {
    const s = size * 0.44;
    ctx.lineWidth = Math.max(5, size * 0.06);
    ctx.strokeStyle = strokeColor;
    drawRoundedRect(ctx, -s, -s * 0.85, s * 2, s * 1.85, size * 0.14);
    ctx.stroke();
    // Header divider
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.28);
    ctx.lineTo(s, -s * 0.28);
    ctx.stroke();
    // Rings
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, -s * 1.08);
    ctx.lineTo(-s * 0.45, -s * 0.65);
    ctx.moveTo(s * 0.45, -s * 1.08);
    ctx.lineTo(s * 0.45, -s * 0.65);
    ctx.stroke();
    // Checkmark in gold
    ctx.strokeStyle = accentColor;
    ctx.beginPath();
    ctx.moveTo(-s * 0.38, s * 0.28);
    ctx.lineTo(-s * 0.08, s * 0.56);
    ctx.lineTo(s * 0.46, s * 0.04);
    ctx.stroke();
  } else if (kind === 'care') {
    const s = size * 0.46;
    ctx.lineWidth = Math.max(5, size * 0.06);
    ctx.strokeStyle = strokeColor;
    // Leaf / sprout shape
    ctx.beginPath();
    ctx.moveTo(0, s * 0.9);
    ctx.lineTo(0, -s * 0.1);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-s * 0.95, -s * 0.15, -s * 0.75, -s * 0.88);
    ctx.quadraticCurveTo(-s * 0.05, -s * 0.9, 0, 0);
    ctx.fillStyle = 'rgba(155, 199, 179, 0.22)';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, s * 0.2);
    ctx.quadraticCurveTo(s * 0.95, 0, s * 0.82, -s * 0.72);
    ctx.quadraticCurveTo(s * 0.1, -s * 0.75, 0, s * 0.2);
    ctx.fillStyle = 'rgba(212, 175, 55, 0.28)';
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.stroke();
  } else if (kind === 'media') {
    const s = size * 0.44;
    ctx.lineWidth = Math.max(5, size * 0.06);
    ctx.strokeStyle = strokeColor;
    drawRoundedRect(ctx, -s, -s * 0.85, s * 2, s * 1.7, size * 0.12);
    ctx.stroke();
    // Headline block
    ctx.fillStyle = accentColor;
    drawRoundedRect(ctx, -s * 0.68, -s * 0.52, s * 0.72, s * 0.52, 6);
    ctx.fill();
    // Lines
    ctx.beginPath();
    ctx.moveTo(s * 0.2, -s * 0.42);
    ctx.lineTo(s * 0.7, -s * 0.42);
    ctx.moveTo(s * 0.2, -s * 0.12);
    ctx.lineTo(s * 0.7, -s * 0.12);
    ctx.moveTo(-s * 0.68, s * 0.24);
    ctx.lineTo(s * 0.7, s * 0.24);
    ctx.moveTo(-s * 0.68, s * 0.52);
    ctx.lineTo(s * 0.35, s * 0.52);
    ctx.stroke();
  } else if (kind === 'chat') {
    const s = size * 0.46;
    ctx.lineWidth = Math.max(5, size * 0.06);
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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fill();
    ctx.stroke();

    // 3 chat dots
    ctx.fillStyle = accentColor;
    [-0.36, 0, 0.36].forEach((offset) => {
      ctx.beginPath();
      ctx.arc(s * offset, -s * 0.06, s * 0.11, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    const s = size * 0.38;
    ctx.lineWidth = Math.max(5, size * 0.06);
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
        badge: 'MST 無料経営診断（登録不要）',
        titleLines: splitTitleToFit(customLabel || '3分無料経営診断', 10),
        subtitle: '約3分でその場に簡易結果を表示',
        cta: '今すぐ診断スタート  ›',
        theme: 'hero-navy',
        iconKind: 'chart',
      };
    }
    if (index === 1) {
      return {
        badge: 'ONLINE / ZOOM',
        titleLines: splitTitleToFit(customLabel || '30分無料面談予約', 6),
        subtitle: '代表・大橋に直接相談',
        cta: '空き日程を見る  ›',
        theme: 'navy',
        iconKind: 'calendar',
      };
    }
    if (index === 2) {
      return {
        badge: '介護・福祉・新規参入',
        titleLines: splitTitleToFit(customLabel || '介護保険外開業専用ページ', 7),
        subtitle: '収益モデル・支援実例',
        cta: '専用ページを見る  ›',
        theme: 'forest',
        iconKind: 'care',
      };
    }
    if (index === 3) {
      return {
        badge: 'MST MEDIA',
        titleLines: splitTitleToFit(customLabel || '公式メディア', 7),
        subtitle: '支援事例・お役立ち記事',
        cta: '記事を読む  ›',
        theme: 'sand',
        iconKind: 'media',
      };
    }
    if (index === 4) {
      return {
        badge: 'チャット相談',
        titleLines: splitTitleToFit(customLabel || 'LINE相談', 7),
        subtitle: '一言OK・24h以内返信',
        cta: 'メッセージを送る  ›',
        theme: 'emerald',
        iconKind: 'chat',
      };
    }
  }

  const themeCycle: TileVisualSpec['theme'][] = ['hero-navy', 'navy', 'forest', 'sand', 'emerald', 'navy'];
  const iconCycle: TileVisualSpec['iconKind'][] = ['chart', 'calendar', 'care', 'media', 'chat', 'grid'];
  const isMessage = action?.type === 'message';
  return {
    badge: isMessage ? 'チャット送信' : 'MST 公式案内',
    titleLines: splitTitleToFit(customLabel || `メニュー ${index + 1}`, 8),
    subtitle: isMessage ? 'タップして送信' : 'タップして詳細を開く',
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
  const pad = 12;
  const x = bounds.x + pad;
  const y = bounds.y + pad;
  const w = bounds.width - pad * 2;
  const h = bounds.height - pad * 2;

  ctx.save();

  // Tile Card Surface
  drawRoundedRect(ctx, x, y, w, h, 28);
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, colors.bgStart);
  grad.addColorStop(1, colors.bgEnd);
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle architectural grid texture inside hero tile
  if (spec.theme === 'hero-navy') {
    ctx.save();
    drawRoundedRect(ctx, x, y, w, h, 28);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
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
    const radial = ctx.createRadialGradient(x + w * 0.8, y + h * 0.45, 40, x + w * 0.8, y + h * 0.45, w * 0.45);
    radial.addColorStop(0, 'rgba(212, 175, 55, 0.22)');
    radial.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // Crisp gold/accent top bar & card hairline border
  drawRoundedRect(ctx, x, y, w, h, 28);
  ctx.lineWidth = 3;
  ctx.strokeStyle = colors.border;
  ctx.stroke();

  if (isHeroWide && w >= 1400) {
    // Wide Hero Tile Layout (Left: Copy + CTA, Right: Diagnostic Graph Illustration)
    const innerPadX = 76;
    const innerPadY = 64;

    // Right illustration
    drawTileIcon(ctx, spec.iconKind, x + w - 275, y + h * 0.5, 360, colors.iconStroke, colors.iconAccent);

    // Top badge pill
    ctx.font = `700 32px ${FONT_SANS}`;
    const badgeMetrics = ctx.measureText(spec.badge);
    const badgeW = badgeMetrics.width + 48;
    const badgeH = 58;
    drawRoundedRect(ctx, x + innerPadX, y + innerPadY, badgeW, badgeH, 29);
    ctx.fillStyle = colors.badgeBg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.badgeBorder;
    ctx.stroke();

    ctx.fillStyle = colors.badgeText;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(spec.badge, x + innerPadX + 24, y + innerPadY + badgeH / 2 + 1);

    // Headline
    ctx.font = `800 108px ${FONT_SANS}`;
    ctx.fillStyle = colors.titleColor;
    ctx.textBaseline = 'top';
    const titleStartY = y + innerPadY + 96;
    spec.titleLines.forEach((line, lineIdx) => {
      ctx.fillText(line, x + innerPadX, titleStartY + lineIdx * 124);
    });

    // Subtitle
    const subtitleY = titleStartY + spec.titleLines.length * 124 + 28;
    ctx.font = `600 44px ${FONT_SANS}`;
    ctx.fillStyle = colors.subtitleColor;
    ctx.fillText(spec.subtitle, x + innerPadX, subtitleY);

    // Primary Gold CTA Pill
    ctx.font = `800 40px ${FONT_SANS}`;
    const ctaTextW = ctx.measureText(spec.cta).width;
    const ctaW = ctaTextW + 84;
    const ctaH = 92;
    const ctaY = y + h - innerPadY - ctaH;
    drawRoundedRect(ctx, x + innerPadX, ctaY, ctaW, ctaH, 46);
    ctx.fillStyle = colors.ctaBg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.ctaBorder;
    ctx.stroke();

    ctx.fillStyle = colors.ctaText;
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.cta, x + innerPadX + 42, ctaY + ctaH / 2 + 1);

    // Subtle MST signature watermark top-right
    ctx.font = `700 26px ${FONT_SANS}`;
    ctx.fillStyle = 'rgba(243, 236, 204, 0.72)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('有限会社MST', x + w - 58, y + 48);
  } else {
    // Standard / Vertical Compact Tile Layout
    const compactScale = h < 650 ? 0.78 : w < 700 ? 0.85 : 1;
    const innerPadX = Math.round(48 * compactScale);
    const innerPadY = Math.round(46 * compactScale);

    // Top row: Number/Badge + Icon
    const badgeFontSize = Math.round(27 * compactScale);
    ctx.font = `700 ${badgeFontSize}px ${FONT_SANS}`;
    const badgeMetrics = ctx.measureText(spec.badge);
    const badgeW = Math.min(w - innerPadX * 2 - 90, badgeMetrics.width + 34);
    const badgeH = Math.round(48 * compactScale);
    drawRoundedRect(ctx, x + innerPadX, y + innerPadY, badgeW, badgeH, badgeH / 2);
    ctx.fillStyle = colors.badgeBg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.badgeBorder;
    ctx.stroke();

    ctx.fillStyle = colors.badgeText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.badge, x + innerPadX + 17, y + innerPadY + badgeH / 2 + 1, badgeW - 34);

    // Icon (top-right inside tile)
    const iconSize = Math.round(118 * compactScale);
    drawTileIcon(
      ctx,
      spec.iconKind,
      x + w - innerPadX - iconSize * 0.45,
      y + innerPadY + iconSize * 0.56,
      iconSize,
      colors.iconStroke,
      colors.iconAccent
    );

    // Title centered vertically in middle area
    const titleFontSize = Math.round((spec.titleLines.length > 1 ? 66 : 76) * compactScale);
    const lineHeight = Math.round(titleFontSize * 1.24);
    ctx.font = `800 ${titleFontSize}px ${FONT_SANS}`;
    ctx.fillStyle = colors.titleColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const middleStartY = y + Math.round(h * 0.31);
    spec.titleLines.forEach((line, lineIdx) => {
      ctx.fillText(line, x + innerPadX, middleStartY + lineIdx * lineHeight, w - innerPadX * 2);
    });

    // Subtitle
    const subtitleY = middleStartY + spec.titleLines.length * lineHeight + Math.round(24 * compactScale);
    const subFontSize = Math.round(34 * compactScale);
    ctx.font = `600 ${subFontSize}px ${FONT_SANS}`;
    ctx.fillStyle = colors.subtitleColor;
    ctx.fillText(spec.subtitle, x + innerPadX, subtitleY, w - innerPadX * 2);

    // CTA Pill at bottom
    const ctaFontSize = Math.round(34 * compactScale);
    ctx.font = `800 ${ctaFontSize}px ${FONT_SANS}`;
    const ctaTextW = ctx.measureText(spec.cta).width;
    const ctaW = Math.min(w - innerPadX * 2, ctaTextW + Math.round(64 * compactScale));
    const ctaH = Math.round(74 * compactScale);
    const ctaY = y + h - innerPadY - ctaH;
    drawRoundedRect(ctx, x + innerPadX, ctaY, ctaW, ctaH, ctaH / 2);
    ctx.fillStyle = colors.ctaBg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.ctaBorder;
    ctx.stroke();

    ctx.fillStyle = colors.ctaText;
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.cta, x + innerPadX + Math.round(32 * compactScale), ctaY + ctaH / 2 + 1);

    // Subtle tile index marker bottom-right
    ctx.font = `700 ${Math.round(24 * compactScale)}px ${FONT_SANS}`;
    ctx.fillStyle = spec.theme === 'sand' ? 'rgba(15, 43, 107, 0.35)' : 'rgba(255, 255, 255, 0.35)';
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
