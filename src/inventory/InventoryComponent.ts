import { Component } from '../core/Component';
import { Inventory, InventoryConfig } from './Inventory';
import { Equipment, EquipmentSlotConfig, DEFAULT_EQUIPMENT_SLOTS } from './Equipment';
import { Item } from './Item';

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

  constructor(config: InventoryComponentConfig = {}) {
    super();

    // 인벤토리 설정 (기본값: 0x0 크기)
    this.inventory = new Inventory(config.inventory ?? { width: 0, height: 0 });

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
   */
  equipItem(item: Item, slotId?: string): boolean {
    if (!this.equipment) return false;

    // 슬롯이 지정되지 않으면 첫 번째 호환 슬롯 사용
    const targetSlot = slotId ?? this.equipment.findCompatibleSlots(item)[0];
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
}
