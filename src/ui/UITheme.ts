/**
 * 인벤토리 UI 테마 설정
 */
export interface UITheme {
  // 색상
  backgroundColor: number;
  backgroundOpacity: number;
  slotColor: number;
  slotEmptyColor: number;
  slotHoverColor: number;
  slotSelectedColor: number;
  borderColor: number;

  // 레리티 색상
  rarityColors: {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
  };

  // 크기
  slotSize: number;
  slotGap: number;
  padding: number;
  borderRadius: number;

  // 폰트
  fontFamily: string;
  fontSize: number;
  fontColor: number;
}

export const DEFAULT_UI_THEME: UITheme = {
  backgroundColor: 0x1a1a2e,
  backgroundOpacity: 0.95,
  slotColor: 0x2d2d44,
  slotEmptyColor: 0x1f1f33,
  slotHoverColor: 0x3d3d5c,
  slotSelectedColor: 0x4a4a6a,
  borderColor: 0x4a4a6a,

  rarityColors: {
    common: 0x9d9d9d,
    uncommon: 0x1eff00,
    rare: 0x0070dd,
    epic: 0xa335ee,
    legendary: 0xff8000,
  },

  slotSize: 50,
  slotGap: 4,
  padding: 12,
  borderRadius: 4,

  fontFamily: 'Arial',
  fontSize: 12,
  fontColor: 0xffffff,
};

/**
 * 테마 병합 헬퍼
 */
export function mergeTheme(base: UITheme, overrides: Partial<UITheme>): UITheme {
  return {
    ...base,
    ...overrides,
    rarityColors: {
      ...base.rarityColors,
      ...(overrides.rarityColors ?? {}),
    },
  };
}
