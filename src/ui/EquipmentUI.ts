import * as THREE from 'three';
import { Equipment } from '../inventory/Equipment';
import { Item } from '../inventory/Item';
import { UITheme, DEFAULT_UI_THEME, mergeTheme } from './UITheme';
import { UIPanel, UIText, UIBox, UIImage } from '../../../three-troika-ui/src';

// 픽셀을 UI 단위로 변환 (1 unit = 100px 기준)
const PX = 0.01;

export interface EquipmentSlotPosition {
  slotId: string;
  row: number;  // 행 (0부터)
  col: number;  // 열 (0부터)
  width?: number;  // 슬롯 크기 배율 (기본 1)
  height?: number;
}

export interface EquipmentUIConfig {
  equipment: Equipment;
  layout: EquipmentSlotPosition[];
  cols: number;  // 열 개수
  rows: number;  // 행 개수
  theme?: Partial<UITheme>;
  onSlotClick?: (slotId: string, item: Item | null) => void;
  onSlotRightClick?: (slotId: string, item: Item | null) => void;
}

interface EquipSlotUI {
  slotId: string;
  container: UIBox;
  labelText: UIText;
  itemIcon?: UIImage;
}

/**
 * 장비 UI (디아블로 스타일 캐릭터 장비창) - troika-ui 기반
 */
export class EquipmentUI extends THREE.Object3D {
  private equipment: Equipment;
  private theme: UITheme;
  private container: UIPanel;
  private backgroundBox: UIBox;
  private slotUIs: Map<string, EquipSlotUI> = new Map();

  private onSlotClick?: (slotId: string, item: Item | null) => void;
  private onSlotRightClick?: (slotId: string, item: Item | null) => void;

  private hoveredSlot: string | null = null;

  constructor(config: EquipmentUIConfig) {
    super();

    this.equipment = config.equipment;
    this.theme = mergeTheme(DEFAULT_UI_THEME, config.theme ?? {});
    this.onSlotClick = config.onSlotClick;
    this.onSlotRightClick = config.onSlotRightClick;

    const { backgroundColor, backgroundOpacity, borderRadius, padding, slotSize, slotGap } = this.theme;

    const totalWidth = config.cols * slotSize + (config.cols + 1) * slotGap + padding * 2;
    const totalHeight = config.rows * slotSize + (config.rows + 1) * slotGap + padding * 2;

    // 배경 박스
    this.backgroundBox = new UIBox({
      width: totalWidth * PX,
      height: totalHeight * PX,
      color: backgroundColor,
      opacity: backgroundOpacity,
      borderRadius: borderRadius * PX,
    });
    this.add(this.backgroundBox);

    // 메인 컨테이너
    this.container = new UIPanel({
      width: totalWidth * PX,
      height: totalHeight * PX,
      padding: padding * PX,
      gap: slotGap * PX,
      direction: 'vertical',
      justify: 'center',
      align: 'center',
    });
    this.container.position.z = 0.01;
    this.add(this.container);

    this.createSlots(config.layout, config.cols, config.rows);
    this.refresh();

    // 장비 변경 이벤트 구독
    this.equipment.on('changed', () => this.refresh());
  }

  private createSlots(layout: EquipmentSlotPosition[], cols: number, rows: number): void {
    const { slotSize, slotGap, slotEmptyColor, borderRadius, fontColor, fontSize } = this.theme;

    // 그리드 기반으로 행별 Block 생성
    const grid: (EquipmentSlotPosition | null)[][] = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        grid[r][c] = null;
      }
    }

    // 레이아웃에서 슬롯 위치 할당
    for (const pos of layout) {
      if (pos.row < rows && pos.col < cols) {
        grid[pos.row][pos.col] = pos;
      }
    }

    // 행별로 Panel 생성
    for (let r = 0; r < rows; r++) {
      const rowPanel = new UIPanel({
        width: (cols * slotSize + (cols - 1) * slotGap) * PX,
        height: slotSize * PX,
        gap: slotGap * PX,
        direction: 'horizontal',
        justify: 'center',
        align: 'center',
      });

      for (let c = 0; c < cols; c++) {
        const pos = grid[r][c];

        if (pos) {
          const slotConfig = this.equipment.getSlotConfig(pos.slotId);
          if (!slotConfig) {
            // 빈 슬롯 공간
            const emptySpace = new UIBox({
              width: slotSize * PX,
              height: slotSize * PX,
              color: 0x000000,
              opacity: 0,
            });
            rowPanel.addChild(emptySpace);
            continue;
          }

          // 슬롯 컨테이너
          const slotBox = new UIBox({
            width: slotSize * PX,
            height: slotSize * PX,
            color: slotEmptyColor,
            opacity: 1,
            borderRadius: borderRadius * PX,
          });

          // 슬롯 ID 저장 (인터랙션용)
          /* eslint-disable @typescript-eslint/no-explicit-any */
          (slotBox as any).slotId = pos.slotId;
          (slotBox as any).isEquipSlot = true;
          /* eslint-enable @typescript-eslint/no-explicit-any */

          // 슬롯 라벨 (슬롯 이름 전체 표시)
          const labelText = new UIText({
            text: slotConfig.name,
            fontSize: (fontSize - 6) * PX,
            color: fontColor,
            anchorX: 'center',
            anchorY: 'middle',
          });
          labelText.position.z = 0.01;
          slotBox.add(labelText);

          this.slotUIs.set(pos.slotId, {
            slotId: pos.slotId,
            container: slotBox,
            labelText,
          });

          rowPanel.addChild(slotBox);
        } else {
          // 빈 슬롯 공간
          const emptySpace = new UIBox({
            width: slotSize * PX,
            height: slotSize * PX,
            color: 0x000000,
            opacity: 0,
          });
          rowPanel.addChild(emptySpace);
        }
      }

      this.container.addChild(rowPanel);
    }
  }

  /**
   * UI 새로고침
   */
  refresh(): void {
    const { slotSize, slotColor, slotEmptyColor, rarityColors, fontColor } = this.theme;

    for (const [slotId, slotUI] of this.slotUIs) {
      const item = this.equipment.getEquipped(slotId);

      // 기존 아이템 아이콘 제거
      if (slotUI.itemIcon) {
        slotUI.container.remove(slotUI.itemIcon);
        slotUI.itemIcon.dispose();
        slotUI.itemIcon = undefined;
      }

      const slotConfig = this.equipment.getSlotConfig(slotId);

      if (item) {
        const rarityColor = rarityColors[item.rarity] ?? rarityColors.common;

        slotUI.container.setColor(slotColor);
        slotUI.container.setBorder(2 * PX, rarityColor);

        // 아이콘 표시
        if (item.icon) {
          const iconSize = (slotSize - 12) * PX;
          const icon = new UIImage({
            width: iconSize,
            height: iconSize,
            texture: item.icon,
          });
          icon.position.z = 0.01;
          slotUI.itemIcon = icon;
          slotUI.container.add(icon);
        }

        // 라벨은 빈 문자열로 (아이콘이 대신함)
        slotUI.labelText.setText('');
      } else {
        slotUI.container.setColor(slotEmptyColor);
        slotUI.container.setBorder(0, 0x000000);

        // 슬롯 이름으로 복원
        if (slotConfig) {
          slotUI.labelText.setText(slotConfig.name);
          slotUI.labelText.setColor(fontColor);
        }
      }
    }
  }

  /**
   * 슬롯 호버 처리
   */
  setHoveredSlot(slotId: string): void {
    if (this.hoveredSlot) {
      this.updateSlotState(this.hoveredSlot);
    }

    this.hoveredSlot = slotId;
    const slotUI = this.slotUIs.get(slotId);
    if (slotUI) {
      slotUI.container.setColor(this.theme.slotHoverColor);
    }
  }

  clearHover(): void {
    if (this.hoveredSlot) {
      this.updateSlotState(this.hoveredSlot);
      this.hoveredSlot = null;
    }
  }

  private updateSlotState(slotId: string): void {
    const item = this.equipment.getEquipped(slotId);
    const slotUI = this.slotUIs.get(slotId);
    if (!slotUI) return;

    if (item) {
      slotUI.container.setColor(this.theme.slotColor);
    } else {
      slotUI.container.setColor(this.theme.slotEmptyColor);
    }
  }

  /**
   * 클릭 이벤트 처리
   */
  handleClick(slotId: string): void {
    const item = this.equipment.getEquipped(slotId);
    this.onSlotClick?.(slotId, item);
  }

  handleRightClick(slotId: string): void {
    const item = this.equipment.getEquipped(slotId);
    this.onSlotRightClick?.(slotId, item);
  }

  /**
   * 레이캐스트용 객체 반환
   */
  getInteractiveObjects(): THREE.Object3D[] {
    const objects: THREE.Object3D[] = [];
    for (const slotUI of this.slotUIs.values()) {
      objects.push(...slotUI.container.getInteractiveMeshes());
    }
    return objects;
  }

  /**
   * UI 업데이트
   */
  update(): void {
    // troika-ui는 자동 업데이트
  }

  dispose(): void {
    this.equipment.off('changed', () => this.refresh());

    for (const slotUI of this.slotUIs.values()) {
      if (slotUI.itemIcon) {
        slotUI.itemIcon.dispose();
      }
      slotUI.labelText.dispose();
      slotUI.container.dispose();
    }

    this.container.dispose();
    this.backgroundBox.dispose();
  }
}

/**
 * 기본 디아블로 스타일 장비 레이아웃 (3x4 그리드)
 *
 *     [Head]  [Amulet]  [    ]
 *     [Main]  [Chest]   [Off ]
 *     [Hand]  [Legs]    [Ring]
 *     [    ]  [Feet]    [Ring]
 */
export const DEFAULT_EQUIPMENT_LAYOUT: EquipmentSlotPosition[] = [
  { slotId: 'head', row: 0, col: 0 },
  { slotId: 'amulet', row: 0, col: 1 },
  { slotId: 'mainHand', row: 1, col: 0 },
  { slotId: 'chest', row: 1, col: 1 },
  { slotId: 'offHand', row: 1, col: 2 },
  { slotId: 'hands', row: 2, col: 0 },
  { slotId: 'legs', row: 2, col: 1 },
  { slotId: 'ring1', row: 2, col: 2 },
  { slotId: 'feet', row: 3, col: 1 },
  { slotId: 'ring2', row: 3, col: 2 },
];

export const DEFAULT_EQUIPMENT_COLS = 3;
export const DEFAULT_EQUIPMENT_ROWS = 4;
