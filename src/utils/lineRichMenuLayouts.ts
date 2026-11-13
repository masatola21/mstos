export const RICH_MENU_WIDTH = 2500;
export const RICH_MENU_HEIGHT = 1686;
export const DEFAULT_MST_HP_URL = 'https://corp.mstcorp.info/?utm_source=line&utm_medium=chat';
export const DEFAULT_MST_DIAGNOSIS_URL =
  'https://ais-dev-cadlpgsrctfv3ddojzsli3-203567468120.asia-northeast1.run.app/f/business-diagnosis?utm_source=line&utm_medium=chat';
export const DEFAULT_MST_BOOKING_URL =
  'https://timerex.net/s/mst.shikumikaizen_b173/4ac78e37?utm_source=line&utm_medium=chat';
export const DEFAULT_MST_CARE_LP_URL = 'https://business.mstcorp.info/?utm_source=line&utm_medium=chat';

export type RichMenuLayoutId =
  | 'single'
  | 'columns-2'
  | 'rows-2'
  | 'columns-3'
  | 'rows-3'
  | 'grid-2x2'
  | 'split-2-1-3'
  | 'split-2-3'
  | 'grid-2x3'
  | 'grid-3x2';

export interface RichMenuActionItem {
  type: 'uri' | 'message';
  label: string;
  value: string;
}

export interface RichMenuBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RichMenuLayoutConfig {
  id: RichMenuLayoutId;
  label: string;
  description: string;
  cellCount: number;
  recommended?: boolean;
}

export const RICH_MENU_LAYOUTS: RichMenuLayoutConfig[] = [
  {
    id: 'split-2-1-3',
    label: '5分割（上2:1・下3）',
    description: '左上特大1667×843＋右上833×843＋下段3枠（診断・予約向け）',
    cellCount: 5,
    recommended: true,
  },
  {
    id: 'split-2-3',
    label: '5分割（上2・下3 均等）',
    description: '上段2枠均等（1250×843）＋下段3枠均等（833×843）',
    cellCount: 5,
  },
  {
    id: 'grid-2x3',
    label: '6分割（2×3）',
    description: '2列 × 3行',
    cellCount: 6,
  },
  {
    id: 'grid-3x2',
    label: '6分割（3×2）',
    description: '3列 × 2行',
    cellCount: 6,
  },
  {
    id: 'grid-2x2',
    label: '4分割（2×2）',
    description: '2列 × 2行',
    cellCount: 4,
  },
  {
    id: 'columns-3',
    label: '3分割（左右）',
    description: '3列 × 1行',
    cellCount: 3,
  },
  {
    id: 'rows-3',
    label: '3分割（上下）',
    description: '1列 × 3行',
    cellCount: 3,
  },
  {
    id: 'columns-2',
    label: '2分割（左右）',
    description: '2列 × 1行',
    cellCount: 2,
  },
  {
    id: 'rows-2',
    label: '2分割（上下）',
    description: '1列 × 2行',
    cellCount: 2,
  },
  {
    id: 'single',
    label: '1分割（全面）',
    description: '1列 × 1行（2500×1686）',
    cellCount: 1,
  },
];

export function getRichMenuLayoutConfig(layoutId: string): RichMenuLayoutConfig | undefined {
  return RICH_MENU_LAYOUTS.find((item) => item.id === layoutId);
}

function buildUniformGridBounds(columns: number, rows: number): RichMenuBounds[] {
  const bounds: RichMenuBounds[] = [];
  for (let row = 0; row < rows; row++) {
    const y = Math.round((row * RICH_MENU_HEIGHT) / rows);
    const bottom = Math.round(((row + 1) * RICH_MENU_HEIGHT) / rows);
    for (let col = 0; col < columns; col++) {
      const x = Math.round((col * RICH_MENU_WIDTH) / columns);
      const right = Math.round(((col + 1) * RICH_MENU_WIDTH) / columns);
      bounds.push({
        x,
        y,
        width: right - x,
        height: bottom - y,
      });
    }
  }
  return bounds;
}

export function getRichMenuLayoutAreas(layoutId: RichMenuLayoutId): RichMenuBounds[] {
  const halfH = Math.round(RICH_MENU_HEIGHT / 2); // 843
  const bottomH = RICH_MENU_HEIGHT - halfH; // 843
  const thirdW1 = 833;
  const thirdW2 = 834; // 833 + 834 + 833 = 2500
  const thirdW3 = 833;

  switch (layoutId) {
    case 'single':
      return buildUniformGridBounds(1, 1);
    case 'columns-2':
      return buildUniformGridBounds(2, 1);
    case 'rows-2':
      return buildUniformGridBounds(1, 2);
    case 'columns-3':
      return buildUniformGridBounds(3, 1);
    case 'rows-3':
      return buildUniformGridBounds(1, 3);
    case 'grid-2x2':
      return buildUniformGridBounds(2, 2);
    case 'grid-2x3':
      return buildUniformGridBounds(2, 3);
    case 'grid-3x2':
      return buildUniformGridBounds(3, 2);
    case 'split-2-1-3':
      return [
        // ① 上段左（特大枠 2:1）
        { x: 0, y: 0, width: 1667, height: halfH },
        // ② 上段右
        { x: 1667, y: 0, width: 833, height: halfH },
        // ③ 下段左
        { x: 0, y: halfH, width: thirdW1, height: bottomH },
        // ④ 下段中央
        { x: thirdW1, y: halfH, width: thirdW2, height: bottomH },
        // ⑤ 下段右
        { x: thirdW1 + thirdW2, y: halfH, width: thirdW3, height: bottomH },
      ];
    case 'split-2-3':
      return [
        // ① 上段左（均等 1:1）
        { x: 0, y: 0, width: 1250, height: halfH },
        // ② 上段右（均等 1:1）
        { x: 1250, y: 0, width: 1250, height: halfH },
        // ③ 下段左
        { x: 0, y: halfH, width: thirdW1, height: bottomH },
        // ④ 下段中央
        { x: thirdW1, y: halfH, width: thirdW2, height: bottomH },
        // ⑤ 下段右
        { x: thirdW1 + thirdW2, y: halfH, width: thirdW3, height: bottomH },
      ];
  }
}

export function getRichMenuCellStylePercent(bounds: RichMenuBounds): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${(bounds.x / RICH_MENU_WIDTH) * 100}%`,
    top: `${(bounds.y / RICH_MENU_HEIGHT) * 100}%`,
    width: `${(bounds.width / RICH_MENU_WIDTH) * 100}%`,
    height: `${(bounds.height / RICH_MENU_HEIGHT) * 100}%`,
  };
}

export function createMstRecommendedRichMenuPreset(bookingUrl?: string): {
  title: string;
  chatBarText: string;
  layout: RichMenuLayoutId;
  actions: RichMenuActionItem[];
} {
  const safeBookingUrl = (bookingUrl || '').trim() || DEFAULT_MST_BOOKING_URL;
  return {
    title: 'MST公式リッチメニュー',
    chatBarText: 'メニュー',
    layout: 'split-2-1-3',
    actions: [
      {
        type: 'uri',
        label: '3分無料経営診断',
        value: DEFAULT_MST_DIAGNOSIS_URL,
      },
      {
        type: 'uri',
        label: '30分無料面談予約',
        value: safeBookingUrl,
      },
      {
        type: 'uri',
        label: '介護保険外開業専用ページ',
        value: DEFAULT_MST_CARE_LP_URL,
      },
      {
        type: 'uri',
        label: '公式メディア',
        value: DEFAULT_MST_HP_URL,
      },
      {
        type: 'message',
        label: 'LINE相談',
        value: '【LINEで相談したい】',
      },
    ],
  };
}
