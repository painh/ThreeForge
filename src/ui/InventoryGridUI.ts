import * as THREE from 'three';
import { Inventory } from '../inventory/Inventory';
import { Item } from '../inventory/Item';
import { UITheme, DEFAULT_UI_THEME, mergeTheme } from './UITheme';
import { UIPanel, UIText, UIBox, UIImage } from '../../../three-troika-ui/src';

// 픽셀을 UI 단위로 변환 (1 unit = 100px 기준)
const PX = 0.01;

export interface InventoryGridUIConfig {
  inventory: Inventory;
  theme?: Partial<UITheme>;
  onSlotClick?: (x: number, y: number, item: Item | null) => void;
  onSlotRightClick?: (x: number, y: number, item: Item | null) => void;
  onItemDragStart?: (item: Item) => void;
  onItemDragEnd?: (item: Item, targetX: number, targetY: number) => void;
}

interface SlotUI {
  container: UIBox;
  itemIcon?: UIImage;
  quantityText?: UIText;
  quantityBg?: UIBox;
  x: number;
  y: number;
}

/**
 * 그리드 인벤토리 UI (troika-ui 기반)
 */
export class InventoryGridUI extends THREE.Object3D {
  private inventory: Inventory;
  private theme: UITheme;
  private container: UIPanel;
  private backgroundBox: UIBox;
  private slots: SlotUI[][] = [];

  private onSlotClick?: (x: number, y: number, item: Item | null) => void;
  private onSlotRightClick?: (x: number, y: number, item: Item | null) => void;

  // 현재 선택/호버 상태
  private hoveredSlot: { x: number; y: number } | null = null;
  private selectedSlot: { x: number; y: number } | null = null;

  constructor(config: InventoryGridUIConfig) {
    super();

    this.inventory = config.inventory;
    this.theme = mergeTheme(DEFAULT_UI_THEME, config.theme ?? {});
    this.onSlotClick = config.onSlotClick;
    this.onSlotRightClick = config.onSlotRightClick;

    const { width, height } = this.inventory;
    const { slotSize, slotGap, padding, backgroundColor, backgroundOpacity, borderRadius } = this.theme;

    const totalWidth = width * slotSize + (width + 1) * slotGap + padding * 2;
    const totalHeight = height * slotSize + (height + 1) * slotGap + padding * 2;

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

    this.createSlots();
    this.refresh();

    // 인벤토리 변경 이벤트 구독
    this.inventory.on('changed', () => this.refresh());
  }

  private createSlots(): void {
    const { width, height } = this.inventory;
    const { slotSize, slotGap, slotEmptyColor, borderRadius } = this.theme;

    for (let y = 0; y < height; y++) {
      const row: SlotUI[] = [];

      // 행 패널
      const rowPanel = new UIPanel({
        width: (width * slotSize + (width - 1) * slotGap) * PX,
        height: slotSize * PX,
        gap: slotGap * PX,
        direction: 'horizontal',
        justify: 'center',
        align: 'center',
      });

      for (let x = 0; x < width; x++) {
        const slotBox = new UIBox({
          width: slotSize * PX,
          height: slotSize * PX,
          color: slotEmptyColor,
          opacity: 1,
          borderRadius: borderRadius * PX,
        });

        // 슬롯에 좌표 정보 저장 (인터랙션용)
        /* eslint-disable @typescript-eslint/no-explicit-any */
        (slotBox as any).slotX = x;
        (slotBox as any).slotY = y;
        (slotBox as any).isInventorySlot = true;
        /* eslint-enable @typescript-eslint/no-explicit-any */

        row.push({
          container: slotBox,
          x,
          y,
        });

        rowPanel.addChild(slotBox);
      }

      this.slots.push(row);
      this.container.addChild(rowPanel);
    }
  }

  /**
   * UI 새로고침 (아이템 표시 업데이트)
   */
  refresh(): void {
    const { slotSize, slotColor, slotEmptyColor, rarityColors } = this.theme;

    // 모든 슬롯 초기화
    for (let y = 0; y < this.inventory.height; y++) {
      for (let x = 0; x < this.inventory.width; x++) {
        const slot = this.slots[y][x];
        const item = this.inventory.getItemAt(x, y);

        // 기존 아이템 UI 제거
        if (slot.itemIcon) {
          slot.container.remove(slot.itemIcon);
          slot.itemIcon.dispose();
          slot.itemIcon = undefined;
        }
        if (slot.quantityText) {
          slot.container.remove(slot.quantityText);
          slot.quantityText.dispose();
          slot.quantityText = undefined;
        }
        if (slot.quantityBg) {
          slot.container.remove(slot.quantityBg);
          slot.quantityBg.dispose();
          slot.quantityBg = undefined;
        }

        if (item && item.gridX === x && item.gridY === y) {
          // 아이템이 있고, 이 슬롯이 아이템의 시작 위치인 경우만 표시
          const rarityColor = rarityColors[item.rarity] ?? rarityColors.common;

          slot.container.setColor(slotColor);
          slot.container.setBorder(2 * PX, rarityColor);

          // 아이콘 표시
          if (item.icon) {
            const iconSize = (slotSize - 8) * PX;
            const icon = new UIImage({
              width: iconSize,
              height: iconSize,
              texture: item.icon,
            });
            icon.position.z = 0.01;
            slot.itemIcon = icon;
            slot.container.add(icon);
          }

          // 스택 수량 표시
          if (item.quantity > 1) {
            const iconSize = slotSize - 8;

            // 배경
            const qtyBg = new UIBox({
              width: 18 * PX,
              height: 12 * PX,
              color: 0x000000,
              opacity: 0.8,
              borderRadius: 2 * PX,
            });
            qtyBg.position.set((iconSize / 2 - 10) * PX, (-iconSize / 2 + 8) * PX, 0.02);
            slot.quantityBg = qtyBg;
            slot.container.add(qtyBg);

            // 텍스트
            const qtyText = new UIText({
              text: item.quantity.toString(),
              fontSize: 8 * PX,
              color: 0xffffff,
              anchorX: 'center',
              anchorY: 'middle',
            });
            qtyText.position.set((iconSize / 2 - 10) * PX, (-iconSize / 2 + 8) * PX, 0.03);
            slot.quantityText = qtyText;
            slot.container.add(qtyText);
          }
        } else if (item) {
          // 아이템의 일부 영역 (시작 위치가 아닌 경우)
          slot.container.setColor(slotColor);
          slot.container.setOpacity(0.5);
        } else {
          // 빈 슬롯
          slot.container.setColor(slotEmptyColor);
          slot.container.setBorder(0, 0x000000);
          slot.container.setOpacity(1);
        }
      }
    }
  }

  /**
   * 슬롯 호버 처리
   */
  setHoveredSlot(x: number, y: number): void {
    // 이전 호버 해제
    if (this.hoveredSlot) {
      this.updateSlotState(this.hoveredSlot.x, this.hoveredSlot.y);
    }

    this.hoveredSlot = { x, y };
    this.slots[y][x].container.setColor(this.theme.slotHoverColor);
  }

  clearHover(): void {
    if (this.hoveredSlot) {
      this.updateSlotState(this.hoveredSlot.x, this.hoveredSlot.y);
      this.hoveredSlot = null;
    }
  }

  /**
   * 슬롯 선택 처리
   */
  setSelectedSlot(x: number, y: number): void {
    // 이전 선택 해제
    if (this.selectedSlot) {
      this.updateSlotState(this.selectedSlot.x, this.selectedSlot.y);
    }

    this.selectedSlot = { x, y };
    this.slots[y][x].container.setColor(this.theme.slotSelectedColor);
  }

  clearSelection(): void {
    if (this.selectedSlot) {
      this.updateSlotState(this.selectedSlot.x, this.selectedSlot.y);
      this.selectedSlot = null;
    }
  }

  private updateSlotState(x: number, y: number): void {
    const item = this.inventory.getItemAt(x, y);
    const slot = this.slots[y][x];

    if (item) {
      slot.container.setColor(this.theme.slotColor);
    } else {
      slot.container.setColor(this.theme.slotEmptyColor);
    }
  }

  /**
   * 클릭 이벤트 처리 (외부에서 호출)
   */
  handleClick(x: number, y: number): void {
    const item = this.inventory.getItemAt(x, y);
    this.onSlotClick?.(x, y, item);
  }

  handleRightClick(x: number, y: number): void {
    const item = this.inventory.getItemAt(x, y);
    this.onSlotRightClick?.(x, y, item);
  }

  /**
   * 레이캐스트용 객체 반환
   */
  getInteractiveObjects(): THREE.Object3D[] {
    const objects: THREE.Object3D[] = [];
    for (const row of this.slots) {
      for (const slot of row) {
        objects.push(...slot.container.getInteractiveMeshes());
      }
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
    this.inventory.off('changed', () => this.refresh());

    for (const row of this.slots) {
      for (const slot of row) {
        if (slot.itemIcon) {
          slot.itemIcon.dispose();
        }
        if (slot.quantityText) {
          slot.quantityText.dispose();
        }
        if (slot.quantityBg) {
          slot.quantityBg.dispose();
        }
        slot.container.dispose();
      }
    }

    this.container.dispose();
    this.backgroundBox.dispose();
  }
}
