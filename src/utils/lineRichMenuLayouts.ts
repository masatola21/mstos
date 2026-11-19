export const RICH_MENU_WIDTH = 2500;
export const RICH_MENU_HEIGHT = 1686;
export const DEFAULT_MST_HP_URL = 'https://corp.mstcorp.info/?utm_source=line&utm_medium=chat';
export const DEFAULT_MST_DIAGNOSIS_URL =
  'https://corp.mstcorp.info/diagnosis?utm_source=line&utm_medium=chat';
export const DEFAULT_MST_BOOKING_URL =
  'https://timerex.net/s/mstcorp/c3dd3eea?utm_source=line&utm_medium=chat';
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
    label: '5蛻・牡・井ｸ・:1繝ｻ荳・・・,
    description: '蟾ｦ荳顔音螟ｧ1667ﾃ・43・句承荳・33ﾃ・43・倶ｸ区ｮｵ3譫・郁ｨｺ譁ｭ繝ｻ莠育ｴ・髄縺托ｼ・,
    cellCount: 5,
    recommended: true,
  },
  {
    id: 'split-2-3',
    label: '5蛻・牡・井ｸ・繝ｻ荳・ 蝮・ｭ会ｼ・,
    description: '荳頑ｮｵ2譫蝮・ｭ会ｼ・250ﾃ・43・会ｼ倶ｸ区ｮｵ3譫蝮・ｭ会ｼ・33ﾃ・43・・,
    cellCount: 5,
  },
  {
    id: 'grid-2x3',
    label: '6蛻・牡・・ﾃ・・・,
    description: '2蛻・ﾃ・3陦・,
    cellCount: 6,
  },
  {
    id: 'grid-3x2',
    label: '6蛻・牡・・ﾃ・・・,
    description: '3蛻・ﾃ・2陦・,
    cellCount: 6,
  },
  {
    id: 'grid-2x2',
    label: '4蛻・牡・・ﾃ・・・,
    description: '2蛻・ﾃ・2陦・,
    cellCount: 4,
  },
  {
    id: 'columns-3',
    label: '3蛻・牡・亥ｷｦ蜿ｳ・・,
    description: '3蛻・ﾃ・1陦・,
    cellCount: 3,
  },
  {
    id: 'rows-3',
    label: '3蛻・牡・井ｸ贋ｸ具ｼ・,
    description: '1蛻・ﾃ・3陦・,
    cellCount: 3,
  },
  {
    id: 'columns-2',
    label: '2蛻・牡・亥ｷｦ蜿ｳ・・,
    description: '2蛻・ﾃ・1陦・,
    cellCount: 2,
  },
  {
    id: 'rows-2',
    label: '2蛻・牡・井ｸ贋ｸ具ｼ・,
    description: '1蛻・ﾃ・2陦・,
    cellCount: 2,
  },
  {
    id: 'single',
    label: '1蛻・牡・亥・髱｢・・,
    description: '1蛻・ﾃ・1陦鯉ｼ・500ﾃ・686・・,
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
        // 竭 荳頑ｮｵ蟾ｦ・育音螟ｧ譫 2:1・・        { x: 0, y: 0, width: 1667, height: halfH },
        // 竭｡ 荳頑ｮｵ蜿ｳ
        { x: 1667, y: 0, width: 833, height: halfH },
        // 竭｢ 荳区ｮｵ蟾ｦ
        { x: 0, y: halfH, width: thirdW1, height: bottomH },
        // 竭｣ 荳区ｮｵ荳ｭ螟ｮ
        { x: thirdW1, y: halfH, width: thirdW2, height: bottomH },
        // 竭､ 荳区ｮｵ蜿ｳ
        { x: thirdW1 + thirdW2, y: halfH, width: thirdW3, height: bottomH },
      ];
    case 'split-2-3':
      return [
        // 竭 荳頑ｮｵ蟾ｦ・亥插遲・1:1・・        { x: 0, y: 0, width: 1250, height: halfH },
        // 竭｡ 荳頑ｮｵ蜿ｳ・亥插遲・1:1・・        { x: 1250, y: 0, width: 1250, height: halfH },
        // 竭｢ 荳区ｮｵ蟾ｦ
        { x: 0, y: halfH, width: thirdW1, height: bottomH },
        // 竭｣ 荳区ｮｵ荳ｭ螟ｮ
        { x: thirdW1, y: halfH, width: thirdW2, height: bottomH },
        // 竭､ 荳区ｮｵ蜿ｳ
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
    title: 'MST蜈ｬ蠑上Μ繝・メ繝｡繝九Η繝ｼ',
    chatBarText: '繝｡繝九Η繝ｼ',
    layout: 'split-2-1-3',
    actions: [
      {
        type: 'uri',
        label: '3蛻・┌譁咏ｵ悟霧險ｺ譁ｭ',
        value: DEFAULT_MST_DIAGNOSIS_URL,
      },
      {
        type: 'uri',
        label: '30蛻・┌譁咎擇隲・ｺ育ｴ・,
        value: safeBookingUrl,
      },
      {
        type: 'uri',
        label: '莉玖ｭｷ菫晞匱螟夜幕讌ｭ蟆ら畑繝壹・繧ｸ',
        value: DEFAULT_MST_CARE_LP_URL,
      },
      {
        type: 'uri',
        label: '蜈ｬ蠑上Γ繝・ぅ繧｢',
        value: DEFAULT_MST_HP_URL,
      },
      {
        type: 'message',
        label: 'LINE逶ｸ隲・,
        value: '縲伸INE縺ｧ逶ｸ隲・＠縺溘＞縲・,
      },
    ],
  };
}
