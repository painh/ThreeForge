import { Component } from '../core/Component';
import { Inventory, InventoryConfig } from './Inventory';
import { Equipment, EquipmentSlotConfig, DEFAULT_EQUIPMENT_SLOTS } from './Equipment';
import { Item } from './Item';
import { StatValue } from '../core/StatModifier';

export interface InventoryComponentConfig {
  inventory?: InventoryConfig;
  equipment?: EquipmentSlotConfig[] | boolean;  // true면 기본 슬롯 사용
}

/**
 * Entity에 부착 가능한 인벤토리 컴포넌트
 * 인벤토리 + 장비 시스템을 하나로 관리
 */
export class InventoryComponent extends Component {
  readonly inventory: Inventory;
  readonly equipment: Equipment | null;

  /** 인벤토리 슬롯 수 스탯 (modifier로 증감 가능) */
  private _inventorySlotsStat: StatValue;

  get inventorySlotsStat(): StatValue { return this._inventorySlotsStat; }

  constructor(config: InventoryComponentConfig = {}) {
    super();

    const invConfig = config.inventory ?? { width: 0, height: 0 };

    // 인벤토리 설정
    this.inventory = new Inventory(invConfig);

    // 슬롯 수 스탯 (base = 초기 슬롯 수)
    const initialSlots = invConfig.width * invConfig.height;
    this._inventorySlotsStat = new StatValue(initialSlots);
    this._inventorySlotsStat.setOnChange((newValue: number) => {
      const totalSlots = Math.floor(newValue);
      if (totalSlots !== this.inventory.totalSlots) {
        this.inventory.resizeBySlots(totalSlots);
      }
    });

    // 장비 설정
    if (config.equipment === true) {
      this.equipment = new Equipment(DEFAULT_EQUIPMENT_SLOTS);
    } else if (Array.isArray(config.equipment)) {
      this.equipment = new Equipment(config.equipment);
    } else {
      this.equipment = null;
    }
  }

  /**
   * 아이템 추가 (인벤토리에 자동 배치)
   */
  addItem(item: Item): boolean {
    return this.inventory.addItem(item);
  }

  /**
   * 아이템 제거
   */
  removeItem(item: Item): boolean {
    // 장착 중이면 먼저 해제
    if (this.equipment?.isEquipped(item)) {
      const slot = this.equipment.findSlotOf(item);
      if (slot) this.equipment.unequip(slot);
    }
    return this.inventory.removeItem(item);
  }

  /**
   * 아이템 장착 (인벤토리에서 장비 슬롯으로)
   * 디아블로 스타일: 빈 슬롯 우선, 없으면 첫 번째 슬롯과 교체
   */
  equipItem(item: Item, slotId?: string): boolean {
    if (!this.equipment) return false;

    let targetSlot: string | undefined;

    if (slotId) {
      // 슬롯이 지정된 경우
      targetSlot = slotId;
    } else {
      // 슬롯이 지정되지 않은 경우: 빈 슬롯 우선, 없으면 첫 번째 슬롯
      const compatibleSlots = this.equipment.findCompatibleSlots(item);
      if (compatibleSlots.length === 0) return false;

      // 빈 슬롯 찾기
      const emptySlot = compatibleSlots.find(
        (slot) => this.equipment!.getEquipped(slot) === null
      );

      targetSlot = emptySlot ?? compatibleSlots[0];
    }

    if (!targetSlot) return false;
    if (!this.equipment.canEquipAt(item, targetSlot)) return false;

    // 인벤토리에서 제거
    const wasInInventory = this.inventory.removeItem(item);

    // 기존 장착 아이템을 인벤토리로 이동
    const previousItem = this.equipment.equip(item, targetSlot);
    if (previousItem) {
      if (!this.inventory.addItem(previousItem)) {
        // 인벤토리에 공간이 없으면 롤백
        this.equipment.equip(previousItem, targetSlot);
        if (wasInInventory) {
          this.inventory.addItem(item);
        }
        return false;
      }
    }

    return true;
  }

  /**
   * 장비 해제 (장비 슬롯에서 인벤토리로)
   */
  unequipItem(slotId: string): boolean {
    if (!this.equipment) return false;

    const item = this.equipment.getEquipped(slotId);
    if (!item) return false;

    // 인벤토리에 공간이 있는지 확인
    const pos = this.inventory.findEmptySpace(item.width, item.height);
    if (!pos) return false;

    this.equipment.unequip(slotId);
    this.inventory.placeAt(item, pos.x, pos.y);

    return true;
  }

  /**
   * 인벤토리와 장비 모두에서 아이템 찾기
   */
  findItem(id: string): Item | null {
    const invItem = this.inventory.findItemById(id);
    if (invItem) return invItem;

    if (this.equipment) {
      for (const item of this.equipment.getEquippedItems()) {
        if (item.id === id) return item;
      }
    }

    return null;
  }

  /**
   * 모든 아이템 가져오기 (인벤토리 + 장비)
   */
  getAllItems(): Item[] {
    const items = this.inventory.getItems();
    if (this.equipment) {
      items.push(...this.equipment.getEquippedItems());
    }
    return items;
  }

  /**
   * 아이템 사용 (소모품)
   * @returns 사용 성공 여부
   */
  useItem(item: Item): boolean {
    // 스택 가능한 아이템만 사용 가능 (소모품)
    if (!item.isStackable) return false;

    // onUse 효과 실행
    item.triggerEffect('onUse', this.entity);

    // 수량 감소
    item.removeQuantity(1);

    // 수량이 0이면 인벤토리에서 제거
    if (item.quantity <= 0) {
      this.inventory.removeItem(item);
    }

    return true;
  }

  /**
   * 아이템 존재 여부 확인 (인벤토리 + 장비)
   */
  hasItem(item: Item): boolean {
    // 인벤토리에서 찾기
    if (this.inventory.findItemById(item.id)) return true;

    // 장비에서 찾기
    if (this.equipment) {
      for (const equipped of this.equipment.getEquippedItems()) {
        if (equipped.id === item.id) return true;
      }
    }

    return false;
  }

  /**
   * 인벤토리와 장비 모두 초기화
   */
  clear(): void {
    this.inventory.clear();
    if (this.equipment) {
      this.equipment.unequipAll();
    }
  }
}
