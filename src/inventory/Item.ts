/**
 * 아이템 스탯 정의
 */
export interface ItemStats {
  attack?: number;
  defense?: number;
  health?: number;
  speed?: number;
  critChance?: number;
  critDamage?: number;
  [key: string]: number | undefined;  // 커스텀 스탯 허용
}

/**
 * 아이템 효과 컨텍스트 (효과 함수에 전달되는 정보)
 */
export interface ItemEffectContext {
  item: Item;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  owner?: any;  // 아이템 소유자 (Entity 등)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;  // 추가 컨텍스트
}

/**
 * 아이템 효과 함수 타입
 */
export type ItemEffectFunction = (context: ItemEffectContext) => void;

/**
 * 아이템 효과 정의
 */
export interface ItemEffects {
  onEquip?: ItemEffectFunction;    // 장착 시
  onUnequip?: ItemEffectFunction;  // 해제 시
  onUse?: ItemEffectFunction;      // 사용 시 (소비 아이템)
  onPickup?: ItemEffectFunction;   // 획득 시
  onDrop?: ItemEffectFunction;     // 버릴 때
}

/**
 * 아이템 기본 타입 정의
 */
export interface ItemConfig {
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  maxStack?: number;
  icon?: string;
  rarity?: ItemRarity;
  equipSlot?: string;  // 장착 가능한 슬롯 타입
  stats?: ItemStats;   // 아이템 스탯
  effects?: ItemEffects;  // 특수 효과 함수
}

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * 아이템 인스턴스
 * 실제 인벤토리에 들어가는 아이템 객체
 */
export class Item {
  readonly config: ItemConfig;
  private _quantity: number = 1;

  // 인벤토리 내 위치 (인벤토리가 관리)
  gridX: number = -1;
  gridY: number = -1;

  constructor(config: ItemConfig, quantity: number = 1) {
    this.config = config;
    this._quantity = Math.min(quantity, config.maxStack ?? 1);
  }

  get id(): string { return this.config.id; }
  get name(): string { return this.config.name; }
  get description(): string { return this.config.description ?? ''; }
  get width(): number { return this.config.width; }
  get height(): number { return this.config.height; }
  get maxStack(): number { return this.config.maxStack ?? 1; }
  get icon(): string | undefined { return this.config.icon; }
  get rarity(): ItemRarity { return this.config.rarity ?? 'common'; }
  get equipSlot(): string | undefined { return this.config.equipSlot; }
  get stats(): ItemStats { return this.config.stats ?? {}; }
  get effects(): ItemEffects { return this.config.effects ?? {}; }

  get quantity(): number { return this._quantity; }

  get isStackable(): boolean { return this.maxStack > 1; }
  get canAddMore(): boolean { return this._quantity < this.maxStack; }

  /**
   * 특정 스탯 값 가져오기
   */
  getStat(statName: string): number {
    return this.stats[statName] ?? 0;
  }

  /**
   * 수량 추가, 추가된 양 반환 (넘치면 일부만 추가됨)
   */
  addQuantity(amount: number): number {
    const canAdd = this.maxStack - this._quantity;
    const added = Math.min(amount, canAdd);
    this._quantity += added;
    return added;
  }

  /**
   * 수량 감소, 실제 감소된 양 반환
   */
  removeQuantity(amount: number): number {
    const removed = Math.min(amount, this._quantity);
    this._quantity -= removed;
    return removed;
  }

  /**
   * 아이템 분할 (새 아이템 인스턴스 반환)
   */
  split(amount: number): Item | null {
    if (amount <= 0 || amount >= this._quantity) return null;

    this._quantity -= amount;
    return new Item(this.config, amount);
  }

  /**
   * 동일 아이템인지 확인 (스택 가능 여부)
   */
  canStackWith(other: Item): boolean {
    return this.id === other.id && this.isStackable;
  }

  /**
   * 아이템 복제
   */
  clone(): Item {
    const cloned = new Item(this.config, this._quantity);
    cloned.gridX = this.gridX;
    cloned.gridY = this.gridY;
    return cloned;
  }

  /**
   * 스탯 설명 문자열 생성
   */
  getStatsDescription(): string {
    const lines: string[] = [];
    const stats = this.stats;

    if (stats.attack) lines.push(`Attack: +${stats.attack}`);
    if (stats.defense) lines.push(`Defense: +${stats.defense}`);
    if (stats.health) lines.push(`Health: +${stats.health}`);
    if (stats.speed) lines.push(`Speed: +${stats.speed}`);
    if (stats.critChance) lines.push(`Crit Chance: +${stats.critChance}%`);
    if (stats.critDamage) lines.push(`Crit Damage: +${stats.critDamage}%`);

    return lines.join('\n');
  }

  /**
   * 효과 함수 실행
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  triggerEffect(effectName: keyof ItemEffects, owner?: any, extraContext?: Record<string, any>): void {
    const effectFn = this.effects[effectName];
    if (effectFn) {
      effectFn({
        item: this,
        owner,
        ...extraContext,
      });
    }
  }

  /**
   * 장착 효과 실행
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEquip(owner?: any): void {
    this.triggerEffect('onEquip', owner);
  }

  /**
   * 해제 효과 실행
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUnequip(owner?: any): void {
    this.triggerEffect('onUnequip', owner);
  }

  /**
   * 사용 효과 실행
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUse(owner?: any): void {
    this.triggerEffect('onUse', owner);
  }
}
