import { EventEmitter } from '../utils/EventEmitter';
import { Item } from './Item';

export interface InventoryEvents {
  itemAdded: { item: Item; x: number; y: number };
  itemRemoved: { item: Item };
  itemMoved: { item: Item; fromX: number; fromY: number; toX: number; toY: number };
  changed: undefined;
}

export interface InventoryConfig {
  width: number;
  height: number;
}

/**
 * 디아블로 스타일 그리드 인벤토리
 * 아이템이 여러 칸을 차지할 수 있음
 */
export class Inventory extends EventEmitter<InventoryEvents> {
  readonly width: number;
  readonly height: number;

  // 그리드: 각 셀이 어떤 아이템을 참조하는지 (null = 빈칸)
  private grid: (Item | null)[][];
  // 인벤토리에 있는 모든 아이템 (중복 없음)
  private items: Set<Item> = new Set();

  constructor(config: InventoryConfig) {
    super();
    this.width = config.width;
    this.height = config.height;

    // 그리드 초기화
    this.grid = [];
    for (let y = 0; y < this.height; y++) {
      this.grid[y] = new Array(this.width).fill(null);
    }
  }

  /**
   * 특정 위치에 아이템 배치 가능한지 확인
   */
  canPlaceAt(item: Item, x: number, y: number): boolean {
    // 범위 체크
    if (x < 0 || y < 0 || x + item.width > this.width || y + item.height > this.height) {
      return false;
    }

    // 해당 영역이 비어있거나 같은 아이템인지 확인
    for (let dy = 0; dy < item.height; dy++) {
      for (let dx = 0; dx < item.width; dx++) {
        const cell = this.grid[y + dy][x + dx];
        if (cell !== null && cell !== item) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * 아이템을 특정 위치에 배치
   */
  placeAt(item: Item, x: number, y: number): boolean {
    if (!this.canPlaceAt(item, x, y)) return false;

    // 기존 위치에서 제거 (이동인 경우)
    if (this.items.has(item)) {
      this.clearItemFromGrid(item);
    }

    // 새 위치에 배치
    for (let dy = 0; dy < item.height; dy++) {
      for (let dx = 0; dx < item.width; dx++) {
        this.grid[y + dy][x + dx] = item;
      }
    }

    const wasNew = !this.items.has(item);
    const oldX = item.gridX;
    const oldY = item.gridY;

    item.gridX = x;
    item.gridY = y;
    this.items.add(item);

    if (wasNew) {
      this.emit('itemAdded', { item, x, y });
    } else {
      this.emit('itemMoved', { item, fromX: oldX, fromY: oldY, toX: x, toY: y });
    }
    this.emit('changed', undefined);

    return true;
  }

  /**
   * 아이템을 인벤토리에 자동 배치 (빈 공간 찾기)
   * 스택 가능한 아이템은 기존 스택에 먼저 추가 시도
   */
  addItem(item: Item): boolean {
    // 스택 가능한 아이템이면 기존 스택에 추가 시도
    if (item.isStackable) {
      for (const existingItem of this.items) {
        if (existingItem.canStackWith(item) && existingItem.canAddMore) {
          const added = existingItem.addQuantity(item.quantity);
          item.removeQuantity(added);

          if (item.quantity === 0) {
            this.emit('changed', undefined);
            return true;
          }
        }
      }
    }

    // 남은 수량이 있으면 새 위치에 배치
    if (item.quantity > 0) {
      const pos = this.findEmptySpace(item.width, item.height);
      if (pos) {
        return this.placeAt(item, pos.x, pos.y);
      }
      return false; // 공간 없음
    }

    return true;
  }

  /**
   * 아이템 제거
   */
  removeItem(item: Item): boolean {
    if (!this.items.has(item)) return false;

    this.clearItemFromGrid(item);
    this.items.delete(item);
    item.gridX = -1;
    item.gridY = -1;

    this.emit('itemRemoved', { item });
    this.emit('changed', undefined);
    return true;
  }

  /**
   * 특정 위치의 아이템 가져오기
   */
  getItemAt(x: number, y: number): Item | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return null;
    }
    return this.grid[y][x];
  }

  /**
   * 모든 아이템 가져오기
   */
  getItems(): Item[] {
    return Array.from(this.items);
  }

  /**
   * 아이템 개수
   */
  get itemCount(): number {
    return this.items.size;
  }

  /**
   * 인벤토리가 비어있는지
   */
  get isEmpty(): boolean {
    return this.items.size === 0;
  }

  /**
   * 특정 ID의 아이템 찾기
   */
  findItemById(id: string): Item | null {
    for (const item of this.items) {
      if (item.id === id) return item;
    }
    return null;
  }

  /**
   * 특정 ID의 모든 아이템 찾기
   */
  findAllItemsById(id: string): Item[] {
    return Array.from(this.items).filter(item => item.id === id);
  }

  /**
   * 빈 공간 찾기 (좌상단부터 검색)
   */
  findEmptySpace(width: number, height: number): { x: number; y: number } | null {
    for (let y = 0; y <= this.height - height; y++) {
      for (let x = 0; x <= this.width - width; x++) {
        if (this.isAreaEmpty(x, y, width, height)) {
          return { x, y };
        }
      }
    }
    return null;
  }

  /**
   * 특정 영역이 비어있는지 확인
   */
  private isAreaEmpty(x: number, y: number, width: number, height: number): boolean {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        if (this.grid[y + dy][x + dx] !== null) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * 그리드에서 아이템 영역 비우기
   */
  private clearItemFromGrid(item: Item): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] === item) {
          this.grid[y][x] = null;
        }
      }
    }
  }

  /**
   * 인벤토리 비우기
   */
  clear(): void {
    const itemsToRemove = Array.from(this.items);
    for (const item of itemsToRemove) {
      this.removeItem(item);
    }
  }

  /**
   * 아이템을 다른 인벤토리로 이동
   */
  transferTo(item: Item, targetInventory: Inventory, x?: number, y?: number): boolean {
    if (!this.items.has(item)) return false;

    // 위치가 지정되지 않으면 자동 배치
    if (x === undefined || y === undefined) {
      if (!targetInventory.addItem(item)) return false;
    } else {
      if (!targetInventory.placeAt(item, x, y)) return false;
    }

    // 원본에서 제거 (이미 target에 추가됨)
    this.clearItemFromGrid(item);
    this.items.delete(item);
    this.emit('itemRemoved', { item });
    this.emit('changed', undefined);

    return true;
  }
}
