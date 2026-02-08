import * as THREE from 'three';
import { Inventory } from '../inventory/Inventory';
import { Item } from '../inventory/Item';
import { UITheme, DEFAULT_UI_THEME, mergeTheme } from './UITheme';
import { UIPanel, UIText, UIBox, UIImage, UI9Slice } from '../../../three-troika-ui/src';

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
  isLegendary?: boolean;
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
  private background9Slice: UI9Slice;
  private slots: SlotUI[][] = [];

  private onSlotClick?: (x: number, y: number, item: Item | null) => void;
  private onSlotRightClick?: (x: number, y: number, item: Item | null) => void;

  // 현재 선택/호버 상태
  private hoveredSlot: { x: number; y: number } | null = null;
  private selectedSlot: { x: number; y: number } | null = null;

  // 드롭 프리뷰 상태
  private dropPreviewSlots: { x: number; y: number }[] = [];

  // 드롭 프리뷰 색상
  private static readonly DROP_PREVIEW_CAN_DROP_COLOR = 0x00ff00; // 녹색
  private static readonly DROP_PREVIEW_CANNOT_DROP_COLOR = 0xff0000; // 빨간색

  // 레전더리 글로우 애니메이션용
  private legendaryGlowSlots: SlotUI[] = [];
  private glowTime: number = 0;

  constructor(config: InventoryGridUIConfig) {
    super();

    this.inventory = config.inventory;
    this.theme = mergeTheme(DEFAULT_UI_THEME, config.theme ?? {});
    this.onSlotClick = config.onSlotClick;
    this.onSlotRightClick = config.onSlotRightClick;

    const { width, height } = this.inventory;
    const { slotSize, slotGap, padding } = this.theme;

    const totalWidth = width * slotSize + (width + 1) * slotGap + padding * 2;
    const totalHeight = height * slotSize + (height + 1) * slotGap + padding * 2;

    // 9-slice 배경
    this.background9Slice = new UI9Slice({
      width: totalWidth * PX,
      height: totalHeight * PX,
      texture: 'ui/panel-031.png',
      textureSize: { width: 48, height: 48 },
      sliceBorders: { left: 15, right: 15, top: 15, bottom: 15 },
    });
    this.add(this.background9Slice);

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
    this.inventory.on('resized', () => this.rebuild());
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
    const { slotSize, slotGap, slotColor, slotEmptyColor, rarityColors } = this.theme;

    // 레전더리 글로우 슬롯 초기화
    this.legendaryGlowSlots = [];

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
        // 레전더리 플래그 초기화
        slot.isLegendary = false;

        if (item && item.gridX === x && item.gridY === y) {
          // 아이템이 있고, 이 슬롯이 아이템의 시작 위치인 경우만 표시
          const rarityColor = rarityColors[item.rarity] ?? rarityColors.common;

          slot.container.setColor(slotColor);
          slot.container.setBorder(2 * PX, rarityColor);

          // 아이콘 표시 (멀티 슬롯 아이템은 중심에 배치)
          if (item.icon) {
            const iconSize = (slotSize - 8) * PX;
            const icon = new UIImage({
              width: iconSize,
              height: iconSize,
              texture: item.icon,
            });
            // 멀티 슬롯 아이템의 경우 아이템 전체 크기의 중심에 배치
            const offsetX = (item.width - 1) * (slotSize + slotGap) / 2 * PX;
            const offsetY = -(item.height - 1) * (slotSize + slotGap) / 2 * PX;
            icon.position.set(offsetX, offsetY, 0.01);
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

          // 레전더리 아이템 반짝임 효과
          if (item.rarity === 'legendary' && slot.itemIcon) {
            slot.isLegendary = true;
            this.legendaryGlowSlots.push(slot);
          }
        } else if (item) {
          // 아이템의 일부 영역 (시작 위치가 아닌 경우) - 시작 슬롯과 동일하게 표시
          const rarityColor = rarityColors[item.rarity] ?? rarityColors.common;
          slot.container.setColor(slotColor);
          slot.container.setBorder(2 * PX, rarityColor);
          slot.container.setOpacity(1);
        } else if (this.inventory.isSlotLocked(x, y)) {
          // 잠긴 슬롯 (사용 불가)
          slot.container.setColor(0x1a1a1a);
          slot.container.setBorder(0, 0x000000);
          slot.container.setOpacity(0.4);
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

  /**
   * 드롭 프리뷰 설정 (멀티 슬롯 지원)
   */
  setDropPreview(x: number, y: number, canDrop: boolean, itemWidth: number = 1, itemHeight: number = 1): void {
    // 이전 프리뷰 해제
    this.clearDropPreview();

    // 프리뷰 배경색 적용
    const color = canDrop
      ? InventoryGridUI.DROP_PREVIEW_CAN_DROP_COLOR
      : InventoryGridUI.DROP_PREVIEW_CANNOT_DROP_COLOR;

    // 아이템 크기만큼 슬롯들에 프리뷰 표시
    for (let dy = 0; dy < itemHeight; dy++) {
      for (let dx = 0; dx < itemWidth; dx++) {
        const slotX = x + dx;
        const slotY = y + dy;
        if (slotY >= 0 && slotY < this.inventory.height && slotX >= 0 && slotX < this.inventory.width) {
          this.dropPreviewSlots.push({ x: slotX, y: slotY });
          this.slots[slotY][slotX].container.setColor(color);
        }
      }
    }
  }

  /**
   * 드롭 프리뷰 해제
   */
  clearDropPreview(): void {
    for (const slot of this.dropPreviewSlots) {
      this.updateSlotState(slot.x, slot.y);
    }
    this.dropPreviewSlots = [];
  }

  private updateSlotState(x: number, y: number): void {
    const item = this.inventory.getItemAt(x, y);
    const slot = this.slots[y][x];

    if (item) {
      const rarityColor = this.theme.rarityColors[item.rarity] ?? this.theme.rarityColors.common;
      slot.container.setColor(this.theme.slotColor);
      slot.container.setBorder(2 * PX, rarityColor);
      slot.container.setOpacity(1);
    } else if (this.inventory.isSlotLocked(x, y)) {
      slot.container.setColor(0x1a1a1a);
      slot.container.setBorder(0, 0x000000);
      slot.container.setOpacity(0.4);
    } else {
      slot.container.setColor(this.theme.slotEmptyColor);
      slot.container.setBorder(0, 0x000000);
      slot.container.setOpacity(1);
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
   * 특정 슬롯의 월드 위치 반환
   */
  getSlotWorldPosition(x: number, y: number): THREE.Vector3 {
    const worldPos = new THREE.Vector3();
    if (y >= 0 && y < this.slots.length && x >= 0 && x < this.slots[y].length) {
      this.slots[y][x].container.getWorldPosition(worldPos);
    }
    return worldPos;
  }

  /**
   * 인벤토리 UI 전체 너비 반환
   */
  getTotalWidth(): number {
    const { width } = this.inventory;
    const { slotSize, slotGap, padding } = this.theme;
    return (width * slotSize + (width + 1) * slotGap + padding * 2) * PX;
  }

  /**
   * UI 업데이트
   */
  update(deltaTime: number = 1 / 60): void {
    // 레전더리 아이템 반짝임 애니메이션
    if (this.legendaryGlowSlots.length > 0) {
      this.glowTime += deltaTime;

      // 펄스 효과 (1초 주기)
      const pulse = Math.sin(this.glowTime * Math.PI * 2) * 0.5 + 0.5; // 0 ~ 1

      // 레전더리 색상 (0xff8000 = 주황색)과 흰색 사이를 보간
      const baseColor = new THREE.Color(this.theme.rarityColors.legendary);
      const brightColor = new THREE.Color(0xffffff);
      const currentColor = baseColor.clone().lerp(brightColor, pulse * 0.5);

      for (const slot of this.legendaryGlowSlots) {
        if (slot.itemIcon && slot.isLegendary) {
          slot.itemIcon.setColor(currentColor.getHex());
        }
      }
    }
  }

  /**
   * 인벤토리 크기 변경 시 UI 완전 재구성
   */
  rebuild(): void {
    // 기존 슬롯 정리
    for (const row of this.slots) {
      for (const slot of row) {
        if (slot.itemIcon) slot.itemIcon.dispose();
        if (slot.quantityText) slot.quantityText.dispose();
        if (slot.quantityBg) slot.quantityBg.dispose();
        slot.container.dispose();
      }
    }
    this.slots = [];
    this.legendaryGlowSlots = [];
    this.hoveredSlot = null;
    this.selectedSlot = null;
    this.dropPreviewSlots = [];

    // 컨테이너 내용 제거
    this.container.dispose();
    this.remove(this.container);
    this.background9Slice.dispose();
    this.remove(this.background9Slice);

    // 새 크기로 재생성
    const { width, height } = this.inventory;
    const { slotSize, slotGap, padding } = this.theme;

    const totalWidth = width * slotSize + (width + 1) * slotGap + padding * 2;
    const totalHeight = height * slotSize + (height + 1) * slotGap + padding * 2;

    this.background9Slice = new UI9Slice({
      width: totalWidth * PX,
      height: totalHeight * PX,
      texture: 'ui/panel-031.png',
      textureSize: { width: 48, height: 48 },
      sliceBorders: { left: 15, right: 15, top: 15, bottom: 15 },
    });
    this.add(this.background9Slice);

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

    this.legendaryGlowSlots = [];
    this.container.dispose();
    this.background9Slice.dispose();
  }
}
