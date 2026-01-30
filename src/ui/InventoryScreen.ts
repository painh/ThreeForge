import * as THREE from 'three';
import { InventoryComponent } from '../inventory/InventoryComponent';
import { Item } from '../inventory/Item';
import { InventoryGridUI } from './InventoryGridUI';
import { EquipmentUI, EquipmentSlotPosition, DEFAULT_EQUIPMENT_LAYOUT, DEFAULT_EQUIPMENT_COLS, DEFAULT_EQUIPMENT_ROWS } from './EquipmentUI';
import { ItemTooltip } from './ItemTooltip';
import { UITheme } from './UITheme';

// 텍스처 로더
const textureLoader = new THREE.TextureLoader();
const textureCache: Map<string, THREE.Texture> = new Map();

export interface InventoryScreenConfig {
  inventoryComponent: InventoryComponent;
  equipmentLayout?: EquipmentSlotPosition[];
  equipmentCols?: number;
  equipmentRows?: number;
  theme?: Partial<UITheme>;
  showEquipment?: boolean;
}

/**
 * 통합 인벤토리 화면 (인벤토리 그리드 + 장비창)
 * 디아블로 스타일의 전체 인벤토리 UI
 * 레이아웃: 장비창 (위) + 인벤토리 (아래)
 */
export class InventoryScreen extends THREE.Object3D {
  private inventoryComponent: InventoryComponent;

  private inventoryUI: InventoryGridUI;
  private equipmentUI: EquipmentUI | null = null;

  // 드래그 상태
  private draggedItem: Item | null = null;
  private draggedFromInventory: boolean = false;
  private draggedFromSlot: string | null = null;
  private draggedFromPos: { x: number; y: number } | null = null;

  // 드래그 아이콘 (마우스 따라다니는 스프라이트)
  private dragIcon: THREE.Sprite | null = null;

  // 툴팁
  private tooltip: ItemTooltip;

  private _visible: boolean = false;

  constructor(config: InventoryScreenConfig) {
    super();

    this.inventoryComponent = config.inventoryComponent;

    // 툴팁 생성
    this.tooltip = new ItemTooltip({ theme: config.theme });
    this.add(this.tooltip);

    // 인벤토리 그리드
    this.inventoryUI = new InventoryGridUI({
      inventory: this.inventoryComponent.inventory,
      theme: config.theme,
      onSlotClick: (x, y, item) => this.handleInventorySlotClick(x, y, item),
      onSlotRightClick: (x, y, item) => this.handleInventorySlotRightClick(x, y, item),
    });

    // 장비 UI (위)
    if (config.showEquipment !== false && this.inventoryComponent.equipment) {
      this.equipmentUI = new EquipmentUI({
        equipment: this.inventoryComponent.equipment,
        layout: config.equipmentLayout ?? DEFAULT_EQUIPMENT_LAYOUT,
        cols: config.equipmentCols ?? DEFAULT_EQUIPMENT_COLS,
        rows: config.equipmentRows ?? DEFAULT_EQUIPMENT_ROWS,
        theme: config.theme,
        onSlotClick: (slotId, item) => this.handleEquipSlotClick(slotId, item),
        onSlotRightClick: (slotId, item) => this.handleEquipSlotRightClick(slotId, item),
      });

      // 장비창과 인벤토리를 좌우로 배치, 상단 정렬
      // 장비창: 3행 기준 (slotSize=50, slotGap=4, padding=8) => 높이 약 1.78, 너비 약 1.78 (3열)
      // 인벤토리: 6행 x 8열 기준 => 높이 약 3.4, 너비 약 4.4
      const equipWidth = 1.78;
      const equipHeight = 1.78;
      const invWidth = 4.4;
      const invHeight = 3.4;
      const gap = 0.15;

      // 상단 정렬: 두 UI의 top을 맞춤
      const topY = Math.max(equipHeight, invHeight) / 2;

      // 장비창 (왼쪽), 인벤토리 (오른쪽)
      const totalWidth = equipWidth + gap + invWidth;
      const leftX = -totalWidth / 2 + equipWidth / 2;
      const rightX = -totalWidth / 2 + equipWidth + gap + invWidth / 2;

      // 상단 정렬: 각 UI의 중심 Y를 상단 기준으로 계산
      this.equipmentUI.position.set(leftX, topY - equipHeight / 2, 0);
      this.inventoryUI.position.set(rightX, topY - invHeight / 2, 0);

      this.add(this.equipmentUI);
    } else {
      // 장비 없으면 중앙에
      this.inventoryUI.position.set(0, 0, 0);
    }

    this.add(this.inventoryUI);

    // 인벤토리 UI가 다른 UI 위에 렌더링되도록 renderOrder 설정
    this.setRenderOrder(100);

    // 기본적으로 숨김
    this.visible = false;
  }

  /**
   * 모든 하위 메시의 renderOrder 설정 및 depthTest 설정
   */
  private setRenderOrder(order: number): void {
    this.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.renderOrder = order;
        // material이 배열일 수 있으므로 처리
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if (mat) {
            mat.depthTest = true;
            mat.depthWrite = true;
          }
        });
      }
    });
  }

  /**
   * 인벤토리 슬롯 클릭 처리
   */
  private handleInventorySlotClick(x: number, y: number, item: Item | null): void {
    if (this.draggedItem) {
      // 드래그 중인 아이템 배치
      if (this.draggedFromInventory && this.draggedFromPos) {
        // 인벤토리 내 이동 (placeAt은 내부적으로 기존 위치 처리함)
        this.inventoryComponent.inventory.placeAt(this.draggedItem, x, y);
      } else if (this.draggedFromSlot) {
        // 장비에서 인벤토리로
        if (this.inventoryComponent.inventory.canPlaceAt(this.draggedItem, x, y)) {
          this.inventoryComponent.equipment?.unequip(this.draggedFromSlot);
          this.inventoryComponent.inventory.placeAt(this.draggedItem, x, y);
        }
      }
      this.clearDrag();
    } else if (item) {
      // 아이템 드래그 시작
      this.startDrag(item, true, null, { x, y });
    }
  }

  /**
   * 드래그 시작
   */
  private startDrag(item: Item, fromInventory: boolean, fromSlot: string | null, fromPos: { x: number; y: number } | null): void {
    this.draggedItem = item;
    this.draggedFromInventory = fromInventory;
    this.draggedFromSlot = fromSlot;
    this.draggedFromPos = fromPos;

    if (fromInventory && fromPos) {
      this.inventoryUI.setSelectedSlot(fromPos.x, fromPos.y);
    }

    this.createDragIcon(item);
  }

  /**
   * 인벤토리 슬롯 우클릭 처리 (빠른 장착)
   */
  private handleInventorySlotRightClick(_x: number, _y: number, item: Item | null): void {
    if (item && item.equipSlot) {
      this.inventoryComponent.equipItem(item);
    }
  }

  /**
   * 장비 슬롯 클릭 처리
   */
  private handleEquipSlotClick(slotId: string, item: Item | null): void {
    if (this.draggedItem) {
      // 드래그 중인 아이템 장착
      if (this.draggedFromInventory && this.draggedFromPos) {
        // 인벤토리에서 장비로
        if (this.inventoryComponent.equipment?.canEquipAt(this.draggedItem, slotId)) {
          this.inventoryComponent.inventory.removeItem(this.draggedItem);
          const swappedItem = this.inventoryComponent.equipment.equip(this.draggedItem, slotId);
          // 교환된 아이템이 있으면 인벤토리에 추가
          if (swappedItem) {
            this.inventoryComponent.inventory.addItem(swappedItem);
          }
        }
      } else if (this.draggedFromSlot && this.draggedFromSlot !== slotId) {
        // 장비 슬롯 간 교환 (같은 타입이면)
        if (this.inventoryComponent.equipment?.canEquipAt(this.draggedItem, slotId)) {
          this.inventoryComponent.equipment.unequip(this.draggedFromSlot);
          const swappedItem = this.inventoryComponent.equipment.equip(this.draggedItem, slotId);
          if (swappedItem) {
            this.inventoryComponent.equipment.equip(swappedItem, this.draggedFromSlot);
          }
        }
      }
      this.clearDrag();
    } else if (item) {
      // 아이템 드래그 시작
      this.startDrag(item, false, slotId, null);
    }
  }

  /**
   * 장비 슬롯 우클릭 처리 (빠른 해제)
   */
  private handleEquipSlotRightClick(slotId: string, item: Item | null): void {
    if (item) {
      this.inventoryComponent.unequipItem(slotId);
    }
  }

  private clearDrag(): void {
    this.draggedItem = null;
    this.draggedFromInventory = false;
    this.draggedFromSlot = null;
    this.draggedFromPos = null;
    this.inventoryUI.clearSelection();
    this.removeDragIcon();
  }

  /**
   * 드래그 아이콘 생성
   */
  private createDragIcon(item: Item): void {
    this.removeDragIcon();

    if (!item.icon) return;

    // 텍스처 로드
    let texture = textureCache.get(item.icon);
    if (!texture) {
      texture = textureLoader.load(item.icon, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        textureCache.set(item.icon!, tex);
      });
      textureCache.set(item.icon, texture);
    }

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.8,
    });
    this.dragIcon = new THREE.Sprite(spriteMaterial);
    this.dragIcon.scale.set(0.5, 0.5, 1);
    this.dragIcon.renderOrder = 200; // 다른 UI 위에 표시
    this.add(this.dragIcon);
  }

  /**
   * 드래그 아이콘 제거
   */
  private removeDragIcon(): void {
    if (this.dragIcon) {
      this.remove(this.dragIcon);
      this.dragIcon.material.dispose();
      this.dragIcon = null;
    }
  }

  /**
   * 드래그 아이콘 위치 업데이트 (월드 좌표)
   */
  updateDragPosition(worldX: number, worldY: number): void {
    if (this.dragIcon) {
      // InventoryScreen의 로컬 좌표로 변환
      const localX = worldX - this.position.x;
      const localY = worldY - this.position.y;
      this.dragIcon.position.set(localX, localY, 10);
    }
  }

  /**
   * 드래그 중인지 확인
   */
  isDragging(): boolean {
    return this.draggedItem !== null;
  }

  /**
   * 아이템 호버 처리
   */
  setHoveredItem(item: Item | null, localX: number, localY: number): void {
    // 드래그 중이면 툴팁 숨김
    if (this.draggedItem) {
      this.tooltip.hide();
      return;
    }

    if (item) {
      this.tooltip.setItem(item);
      // 툴팁 위치: 아이템 오른쪽 위에 배치 (아이콘을 가리지 않도록)
      const tooltipX = localX + 1.2; // 오른쪽으로 이동
      const tooltipY = localY + 0.5; // 약간 위로
      this.tooltip.setLocalPosition(tooltipX, tooltipY);
    } else {
      this.tooltip.hide();
    }
  }

  /**
   * 호버 해제
   */
  clearHover(): void {
    this.tooltip.hide();
  }

  /**
   * 화면 표시/숨김 토글
   */
  toggle(): void {
    this.setVisible(!this._visible);
  }

  setVisible(visible: boolean): void {
    this._visible = visible;
    this.visible = visible;
    if (visible) {
      // 표시될 때 renderOrder 재설정 (three-mesh-ui 내부 메시가 동적으로 생성되므로)
      this.setRenderOrder(100);
    } else {
      this.clearDrag();
      this.clearHover();
    }
  }

  isVisible(): boolean {
    return this._visible;
  }

  /**
   * 레이캐스트용 모든 인터랙티브 객체
   */
  getInteractiveObjects(): THREE.Object3D[] {
    const objects = this.inventoryUI.getInteractiveObjects();
    if (this.equipmentUI) {
      objects.push(...this.equipmentUI.getInteractiveObjects());
    }
    return objects;
  }

  /**
   * UI 업데이트 (매 프레임 호출)
   */
  update(): void {
    // troika-ui는 자동 업데이트
  }

  dispose(): void {
    this.inventoryUI.dispose();
    this.equipmentUI?.dispose();
    this.tooltip.dispose();
  }
}
