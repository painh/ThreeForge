import * as THREE from 'three';
import ThreeMeshUI from 'three-mesh-ui';
import { Inventory } from '../inventory/Inventory';
import { Item } from '../inventory/Item';
import { UITheme, DEFAULT_UI_THEME, mergeTheme } from './UITheme';

// 텍스처 캐시
const textureCache: Map<string, THREE.Texture> = new Map();
const textureLoader = new THREE.TextureLoader();
const pendingLoads: Set<string> = new Set();

function loadTexture(url: string, onLoaded?: () => void): THREE.Texture | null {
  // 이미 캐시에 있으면 바로 반환 (콜백 호출 안 함)
  if (textureCache.has(url)) {
    return textureCache.get(url)!;
  }

  // 이미 로드 중이면 스킵
  if (pendingLoads.has(url)) {
    return null;
  }
  pendingLoads.add(url);

  textureLoader.load(
    url,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      textureCache.set(url, texture);
      pendingLoads.delete(url);
      // 로드 완료 시 콜백 호출 (한 번만)
      if (onLoaded) {
        onLoaded();
      }
    },
    undefined,
    () => {
      console.warn('Failed to load texture:', url);
      pendingLoads.delete(url);
    }
  );

  return null; // 아직 로드되지 않음
}

export interface InventoryGridUIConfig {
  inventory: Inventory;
  theme?: Partial<UITheme>;
  onSlotClick?: (x: number, y: number, item: Item | null) => void;
  onSlotRightClick?: (x: number, y: number, item: Item | null) => void;
  onItemDragStart?: (item: Item) => void;
  onItemDragEnd?: (item: Item, targetX: number, targetY: number) => void;
}

interface SlotUI {
  container: ThreeMeshUI.Block;
  background: ThreeMeshUI.Block;
  itemIcon?: THREE.Sprite;
  quantityBlock?: ThreeMeshUI.Block;
  x: number;
  y: number;
}

// three-mesh-ui Block set 메서드 타입 헬퍼
type BlockWithSet = ThreeMeshUI.Block & { set: (props: Record<string, unknown>) => void };

// 픽셀을 three-mesh-ui 단위로 변환 (1 unit = 100px 기준)
const PX = 0.01;

/**
 * 그리드 인벤토리 UI (three-mesh-ui 기반)
 */
export class InventoryGridUI extends THREE.Object3D {
  private inventory: Inventory;
  private theme: UITheme;
  private container: ThreeMeshUI.Block;
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

    this.container = this.createContainer();
    this.add(this.container);

    this.createSlots();
    this.refresh();

    // 인벤토리 변경 이벤트 구독
    this.inventory.on('changed', () => this.refresh());
  }

  private createContainer(): ThreeMeshUI.Block {
    const { width, height } = this.inventory;
    const { slotSize, slotGap, padding, backgroundColor, backgroundOpacity, borderRadius } = this.theme;

    const totalWidth = width * slotSize + (width + 1) * slotGap + padding * 2;
    const totalHeight = height * slotSize + (height + 1) * slotGap + padding * 2;

    return new ThreeMeshUI.Block({
      width: totalWidth * PX,
      height: totalHeight * PX,
      padding: padding * PX,
      backgroundColor: new THREE.Color(backgroundColor),
      backgroundOpacity,
      borderRadius: borderRadius * PX,
      fontFamily: '/fonts/Roboto-msdf.json',
      fontTexture: '/fonts/Roboto-msdf.png',
      justifyContent: 'center',
      alignItems: 'center',
      contentDirection: 'column',
    });
  }

  private createSlots(): void {
    const { width, height } = this.inventory;
    const { slotSize, slotGap, slotEmptyColor, borderRadius } = this.theme;

    for (let y = 0; y < height; y++) {
      const row: SlotUI[] = [];

      const rowBlock = new ThreeMeshUI.Block({
        width: (width * slotSize + (width + 1) * slotGap) * PX,
        height: (slotSize + slotGap) * PX,
        contentDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundOpacity: 0,
      });

      for (let x = 0; x < width; x++) {
        const slotContainer = new ThreeMeshUI.Block({
          width: slotSize * PX,
          height: slotSize * PX,
          margin: (slotGap / 2) * PX,
          backgroundColor: new THREE.Color(slotEmptyColor),
          backgroundOpacity: 1,
          borderRadius: borderRadius * PX,
          justifyContent: 'center',
          alignItems: 'center',
        });

        // 슬롯에 좌표 정보 저장 (인터랙션용)
        /* eslint-disable @typescript-eslint/no-explicit-any */
        (slotContainer as any).slotX = x;
        (slotContainer as any).slotY = y;
        (slotContainer as any).isInventorySlot = true;
        /* eslint-enable @typescript-eslint/no-explicit-any */

        row.push({
          container: slotContainer,
          background: slotContainer,
          x,
          y,
        });

        rowBlock.add(slotContainer);
      }

      this.slots.push(row);
      this.container.add(rowBlock);
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
          slot.itemIcon.material.dispose();
          slot.itemIcon = undefined;
        }
        if (slot.quantityBlock) {
          slot.container.remove(slot.quantityBlock);
          slot.quantityBlock = undefined;
        }

        if (item && item.gridX === x && item.gridY === y) {
          // 아이템이 있고, 이 슬롯이 아이템의 시작 위치인 경우만 표시
          const rarityColor = rarityColors[item.rarity] ?? rarityColors.common;

          (slot.background as BlockWithSet).set({
            backgroundColor: new THREE.Color(slotColor),
            borderWidth: 2 * PX,
            borderColor: new THREE.Color(rarityColor),
          });

          // 아이콘 텍스처 로드 (로드 완료 시 refresh 콜백)
          const iconUrl = item.icon;
          const texture = iconUrl ? loadTexture(iconUrl, () => this.refresh()) : null;

          // THREE.Sprite로 아이콘 표시
          if (texture) {
            const iconSize = (slotSize - 8) * PX;
            const spriteMaterial = new THREE.SpriteMaterial({
              map: texture,
              transparent: true,
            });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(iconSize, iconSize, 1);
            sprite.position.set(0, 0, 0.01);
            slot.itemIcon = sprite;
            slot.container.add(sprite);
          }

          // 스택 수량 표시 (아이콘 위에 오버레이로 표시)
          if (item.quantity > 1) {
            const qtyBlock = new ThreeMeshUI.Block({
              width: 18 * PX,
              height: 12 * PX,
              backgroundColor: new THREE.Color(0x000000),
              backgroundOpacity: 0.8,
              borderRadius: 2 * PX,
              justifyContent: 'center',
              alignItems: 'center',
              fontFamily: '/fonts/Roboto-msdf.json',
              fontTexture: '/fonts/Roboto-msdf.png',
            });
            const qtyText = new ThreeMeshUI.Text({
              content: item.quantity.toString(),
              fontSize: 8 * PX,
              fontColor: new THREE.Color(0xffffff),
            });
            qtyBlock.add(qtyText);
            // 수량 표시를 우하단에 위치
            const iconSize = slotSize - 8;
            qtyBlock.position.set((iconSize / 2 - 10) * PX, (-iconSize / 2 + 8) * PX, 0.02);
            slot.quantityBlock = qtyBlock;
            slot.container.add(qtyBlock);
          }
        } else if (item) {
          // 아이템의 일부 영역 (시작 위치가 아닌 경우)
          (slot.background as BlockWithSet).set({
            backgroundColor: new THREE.Color(slotColor),
            backgroundOpacity: 0.5,
          });
        } else {
          // 빈 슬롯
          (slot.background as BlockWithSet).set({
            backgroundColor: new THREE.Color(slotEmptyColor),
            borderWidth: 0,
          });
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
    (this.slots[y][x].background as BlockWithSet).set({
      backgroundColor: new THREE.Color(this.theme.slotHoverColor),
    });
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
    (this.slots[y][x].background as BlockWithSet).set({
      backgroundColor: new THREE.Color(this.theme.slotSelectedColor),
    });
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
      (slot.background as BlockWithSet).set({
        backgroundColor: new THREE.Color(this.theme.slotColor),
      });
    } else {
      (slot.background as BlockWithSet).set({
        backgroundColor: new THREE.Color(this.theme.slotEmptyColor),
      });
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
        objects.push(slot.container);
      }
    }
    return objects;
  }

  /**
   * UI 업데이트 (three-mesh-ui 필수)
   */
  update(): void {
    ThreeMeshUI.update();
  }

  dispose(): void {
    this.inventory.off('changed', () => this.refresh());
    // three-mesh-ui 정리
    this.container.clear();
    this.remove(this.container);
  }
}
