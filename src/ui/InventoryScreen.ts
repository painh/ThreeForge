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

  // 드롭 프리뷰 상태
  private previewSlot: { type: 'inventory'; x: number; y: number } | { type: 'equipment'; slotId: string } | null = null;
  private canDropAtPreview: boolean = false;

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

      // 장비창(위)과 인벤토리(아래) 세로 배치
      // 장비창: 위쪽, 인벤토리: 아래쪽
      this.equipmentUI.position.set(0, 2.8, 0);
      this.inventoryUI.position.set(0, -1.6, 0);

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
   * 인벤토리 슬롯 마우스 다운 처리 (드래그 시작)
   */
  handleInventorySlotMouseDown(x: number, y: number, item: Item | null): void {
    if (item && !this.draggedItem) {
      // 아이템 드래그 시작
      this.startDrag(item, true, null, { x, y });
    }
  }

  /**
   * 인벤토리 슬롯 클릭 처리 (호환성용 - 사용 안 함)
   */
  private handleInventorySlotClick(_x: number, _y: number, _item: Item | null): void {
    // 드래그앤드롭 방식으로 변경되어 사용 안 함
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
  private handleInventorySlotRightClick(x: number, y: number, item: Item | null): void {
    if (item && item.equipSlot) {
      this.inventoryComponent.equipItem(item);
      // 스왑 후 해당 슬롯의 새 아이템으로 툴팁 갱신
      const newItem = this.inventoryComponent.inventory.getItemAt(x, y);
      if (newItem) {
        this.tooltip.setItem(newItem);
      } else {
        this.tooltip.hide();
      }
    }
  }

  /**
   * 장비 슬롯 마우스 다운 처리 (드래그 시작)
   */
  handleEquipSlotMouseDown(slotId: string, item: Item | null): void {
    if (item && !this.draggedItem) {
      // 아이템 드래그 시작
      this.startDrag(item, false, slotId, null);
    }
  }

  /**
   * 장비 슬롯 클릭 처리 (호환성용 - 사용 안 함)
   */
  private handleEquipSlotClick(_slotId: string, _item: Item | null): void {
    // 드래그앤드롭 방식으로 변경되어 사용 안 함
  }

  /**
   * 장비 슬롯 우클릭 처리 (빠른 해제)
   */
  private handleEquipSlotRightClick(slotId: string, item: Item | null): void {
    if (item) {
      this.inventoryComponent.unequipItem(slotId);
      // 해제 후 장비 슬롯의 새 아이템으로 툴팁 갱신
      const newItem = this.inventoryComponent.equipment?.getEquippedItem(slotId) ?? null;
      if (newItem) {
        this.tooltip.setItem(newItem);
      } else {
        this.tooltip.hide();
      }
    }
  }

  /**
   * 마우스 업 처리 (드롭)
   */
  handleMouseUp(): void {
    if (!this.draggedItem) return;

    // 프리뷰 슬롯이 있고 드롭 가능하면 드롭 실행
    if (this.previewSlot && this.canDropAtPreview) {
      if (this.previewSlot.type === 'inventory') {
        this.dropAtInventory(this.previewSlot.x, this.previewSlot.y);
      } else if (this.previewSlot.type === 'equipment') {
        this.dropAtEquipment(this.previewSlot.slotId);
      }
    }

    this.clearDrag();
  }

  /**
   * 인벤토리에 드롭
   */
  private dropAtInventory(x: number, y: number): void {
    if (!this.draggedItem) return;

    if (this.draggedFromInventory && this.draggedFromPos) {
      // 인벤토리 내 이동
      this.inventoryComponent.inventory.placeAt(this.draggedItem, x, y);
    } else if (this.draggedFromSlot) {
      // 장비에서 인벤토리로
      if (this.inventoryComponent.inventory.canPlaceAt(this.draggedItem, x, y)) {
        this.inventoryComponent.equipment?.unequip(this.draggedFromSlot);
        this.inventoryComponent.inventory.placeAt(this.draggedItem, x, y);
      }
    }
  }

  /**
   * 장비 슬롯에 드롭
   */
  private dropAtEquipment(slotId: string): void {
    if (!this.draggedItem) return;

    if (this.draggedFromInventory && this.draggedFromPos) {
      // 인벤토리에서 장비로
      if (this.inventoryComponent.equipment?.canEquipAt(this.draggedItem, slotId)) {
        this.inventoryComponent.inventory.removeItem(this.draggedItem);
        const swappedItem = this.inventoryComponent.equipment.equip(this.draggedItem, slotId);
        if (swappedItem) {
          this.inventoryComponent.inventory.addItem(swappedItem);
        }
      }
    } else if (this.draggedFromSlot && this.draggedFromSlot !== slotId) {
      // 장비 슬롯 간 교환
      if (this.inventoryComponent.equipment?.canEquipAt(this.draggedItem, slotId)) {
        this.inventoryComponent.equipment.unequip(this.draggedFromSlot);
        const swappedItem = this.inventoryComponent.equipment.equip(this.draggedItem, slotId);
        if (swappedItem) {
          this.inventoryComponent.equipment.equip(swappedItem, this.draggedFromSlot);
        }
      }
    }
  }

  /**
   * 드롭 프리뷰 업데이트 (인벤토리 슬롯)
   */
  updateDropPreviewInventory(x: number, y: number): void {
    if (!this.draggedItem) {
      this.clearDropPreview();
      return;
    }

    // 드롭 가능 여부 확인
    let canDrop = false;
    if (this.draggedFromInventory) {
      // 인벤토리 내 이동: 자기 자신 위치는 허용, 다른 곳은 canPlaceAt 체크
      if (this.draggedFromPos && x === this.draggedFromPos.x && y === this.draggedFromPos.y) {
        canDrop = true;
      } else {
        canDrop = this.inventoryComponent.inventory.canPlaceAt(this.draggedItem, x, y);
      }
    } else if (this.draggedFromSlot) {
      // 장비에서 인벤토리로
      canDrop = this.inventoryComponent.inventory.canPlaceAt(this.draggedItem, x, y);
    }

    this.previewSlot = { type: 'inventory', x, y };
    this.canDropAtPreview = canDrop;

    // UI에 프리뷰 표시 (아이템 크기 전달)
    this.inventoryUI.setDropPreview(x, y, canDrop, this.draggedItem.width, this.draggedItem.height);
  }

  /**
   * 드롭 프리뷰 업데이트 (장비 슬롯)
   */
  updateDropPreviewEquipment(slotId: string): void {
    if (!this.draggedItem) {
      this.clearDropPreview();
      return;
    }

    // 드롭 가능 여부 확인
    let canDrop = false;
    if (this.draggedFromInventory) {
      canDrop = this.inventoryComponent.equipment?.canEquipAt(this.draggedItem, slotId) ?? false;
    } else if (this.draggedFromSlot) {
      // 같은 슬롯이면 허용 (취소), 다른 슬롯이면 canEquipAt 체크
      if (this.draggedFromSlot === slotId) {
        canDrop = true;
      } else {
        canDrop = this.inventoryComponent.equipment?.canEquipAt(this.draggedItem, slotId) ?? false;
      }
    }

    this.previewSlot = { type: 'equipment', slotId };
    this.canDropAtPreview = canDrop;

    // UI에 프리뷰 표시
    this.equipmentUI?.setDropPreview(slotId, canDrop);
  }

  /**
   * 드롭 프리뷰 초기화
   */
  clearDropPreview(): void {
    this.previewSlot = null;
    this.canDropAtPreview = false;
    this.inventoryUI.clearDropPreview();
    this.equipmentUI?.clearDropPreview();
  }

  private clearDrag(): void {
    this.draggedItem = null;
    this.draggedFromInventory = false;
    this.draggedFromSlot = null;
    this.draggedFromPos = null;
    this.inventoryUI.clearSelection();
    this.clearDropPreview();
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
    // 슬롯 크기에 맞게 아이콘 크기 설정 (slotSize=80, PX=0.01 -> 0.8)
    const iconSize = 0.72;
    this.dragIcon.scale.set(iconSize, iconSize, 1);
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
  setHoveredItem(item: Item | null, _localX: number, localY: number): void {
    // 드래그 중이면 툴팁 숨김
    if (this.draggedItem) {
      this.tooltip.hide();
      return;
    }

    if (item) {
      this.tooltip.setItem(item);
      // 인벤토리 왼쪽 경계 계산 (인벤토리 UI의 왼쪽 가장자리)
      const inventoryLeftEdge = this.inventoryUI.position.x - this.inventoryUI.getTotalWidth() / 2;
      this.tooltip.setLocalPosition(inventoryLeftEdge, localY);
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
   * 인벤토리 슬롯 우클릭 처리 (외부에서 호출)
   */
  handleInventoryRightClick(x: number, y: number): void {
    const item = this.inventoryComponent.inventory.getItemAt(x, y);
    this.handleInventorySlotRightClick(x, y, item);
  }

  /**
   * 장비 슬롯 우클릭 처리 (외부에서 호출)
   */
  handleEquipmentRightClick(slotId: string): void {
    const item = this.inventoryComponent.equipment?.getEquippedItem(slotId) ?? null;
    this.handleEquipSlotRightClick(slotId, item);
  }

  /**
   * 인벤토리 슬롯의 월드 위치 반환
   */
  getInventorySlotWorldPosition(x: number, y: number): THREE.Vector3 {
    return this.inventoryUI.getSlotWorldPosition(x, y);
  }

  /**
   * UI 업데이트 (매 프레임 호출)
   */
  update(deltaTime: number = 1 / 60): void {
    this.inventoryUI.update(deltaTime);
  }

  dispose(): void {
    this.inventoryUI.dispose();
    this.equipmentUI?.dispose();
    this.tooltip.dispose();
  }
}
