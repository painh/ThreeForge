import { EventEmitter } from '../utils/EventEmitter';
import { Item } from './Item';

export interface EquipmentSlotConfig {
  id: string;
  name: string;
  acceptedTypes: string[];  // 이 슬롯에 장착 가능한 equipSlot 타입들
}

export interface EquipmentEvents {
  equipped: { slot: string; item: Item };
  unequipped: { slot: string; item: Item };
  changed: undefined;
}

/**
 * 장비 슬롯 시스템
 * 디아블로 스타일의 캐릭터 장비 관리
 */
export class Equipment extends EventEmitter<EquipmentEvents> {
  private slots: Map<string, EquipmentSlotConfig> = new Map();
  private equipped: Map<string, Item | null> = new Map();

  constructor(slotConfigs: EquipmentSlotConfig[] = []) {
    super();
    for (const config of slotConfigs) {
      this.addSlot(config);
    }
  }

  /**
   * 장비 슬롯 추가
   */
  addSlot(config: EquipmentSlotConfig): void {
    this.slots.set(config.id, config);
    this.equipped.set(config.id, null);
  }

  /**
   * 슬롯 정보 가져오기
   */
  getSlotConfig(slotId: string): EquipmentSlotConfig | undefined {
    return this.slots.get(slotId);
  }

  /**
   * 모든 슬롯 ID 가져오기
   */
  getSlotIds(): string[] {
    return Array.from(this.slots.keys());
  }

  /**
   * 아이템이 특정 슬롯에 장착 가능한지 확인
   */
  canEquipAt(item: Item, slotId: string): boolean {
    const slotConfig = this.slots.get(slotId);
    if (!slotConfig) return false;

    if (!item.equipSlot) return false;

    return slotConfig.acceptedTypes.includes(item.equipSlot);
  }

  /**
   * 아이템을 특정 슬롯에 장착
   * 기존 장착 아이템이 있으면 반환
   */
  equip(item: Item, slotId: string): Item | null {
    if (!this.canEquipAt(item, slotId)) return null;

    const previousItem = this.equipped.get(slotId) ?? null;
    this.equipped.set(slotId, item);

    if (previousItem) {
      this.emit('unequipped', { slot: slotId, item: previousItem });
    }
    this.emit('equipped', { slot: slotId, item });
    this.emit('changed', undefined);

    return previousItem;
  }

  /**
   * 특정 슬롯의 장비 해제
   */
  unequip(slotId: string): Item | null {
    const item = this.equipped.get(slotId);
    if (!item) return null;

    this.equipped.set(slotId, null);
    this.emit('unequipped', { slot: slotId, item });
    this.emit('changed', undefined);

    return item;
  }

  /**
   * 특정 슬롯의 장착 아이템 가져오기
   */
  getEquipped(slotId: string): Item | null {
    return this.equipped.get(slotId) ?? null;
  }

  /**
   * 모든 장착 아이템 가져오기
   */
  getAllEquipped(): Map<string, Item | null> {
    return new Map(this.equipped);
  }

  /**
   * 장착된 아이템 목록 (null 제외)
   */
  getEquippedItems(): Item[] {
    const items: Item[] = [];
    for (const item of this.equipped.values()) {
      if (item) items.push(item);
    }
    return items;
  }

  /**
   * 특정 아이템이 장착 가능한 슬롯 찾기
   */
  findCompatibleSlots(item: Item): string[] {
    const compatible: string[] = [];
    for (const [slotId, config] of this.slots) {
      if (item.equipSlot && config.acceptedTypes.includes(item.equipSlot)) {
        compatible.push(slotId);
      }
    }
    return compatible;
  }

  /**
   * 특정 아이템이 장착되어 있는지 확인
   */
  isEquipped(item: Item): boolean {
    for (const equippedItem of this.equipped.values()) {
      if (equippedItem === item) return true;
    }
    return false;
  }

  /**
   * 특정 아이템이 장착된 슬롯 찾기
   */
  findSlotOf(item: Item): string | null {
    for (const [slotId, equippedItem] of this.equipped) {
      if (equippedItem === item) return slotId;
    }
    return null;
  }

  /**
   * 모든 장비 해제
   */
  unequipAll(): Item[] {
    const items: Item[] = [];
    for (const slotId of this.slots.keys()) {
      const item = this.unequip(slotId);
      if (item) items.push(item);
    }
    return items;
  }
}

/**
 * 기본 RPG 장비 슬롯 프리셋
 */
export const DEFAULT_EQUIPMENT_SLOTS: EquipmentSlotConfig[] = [
  { id: 'head', name: 'Head', acceptedTypes: ['helmet', 'hat', 'head'] },
  { id: 'chest', name: 'Chest', acceptedTypes: ['armor', 'chest', 'body'] },
  { id: 'legs', name: 'Legs', acceptedTypes: ['pants', 'legs', 'leggings'] },
  { id: 'feet', name: 'Feet', acceptedTypes: ['boots', 'shoes', 'feet'] },
  { id: 'hands', name: 'Hands', acceptedTypes: ['gloves', 'gauntlets', 'hands'] },
  { id: 'mainHand', name: 'Main Hand', acceptedTypes: ['weapon', 'sword', 'axe', 'mace', 'staff', 'mainHand'] },
  { id: 'offHand', name: 'Off Hand', acceptedTypes: ['shield', 'offhand', 'offHand'] },
  { id: 'ring1', name: 'Ring 1', acceptedTypes: ['ring', 'accessory'] },
  { id: 'ring2', name: 'Ring 2', acceptedTypes: ['ring', 'accessory'] },
  { id: 'amulet', name: 'Amulet', acceptedTypes: ['amulet', 'necklace', 'accessory'] },
];
