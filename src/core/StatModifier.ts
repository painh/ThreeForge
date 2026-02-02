/**
 * 스탯 모디파이어 타입
 * - flat: 고정값 추가 (base + flat)
 * - multiply: 배율 적용 (base * multiply)
 */
export type ModifierType = 'flat' | 'multiply';

/**
 * 개별 모디파이어
 */
export interface Modifier {
  id: string;
  type: ModifierType;
  value: number;
  priority?: number; // 낮을수록 먼저 적용 (기본: 0)
}

/**
 * 스탯 값 클래스
 * base 값에 여러 모디파이어를 적용하여 최종 값을 계산
 *
 * 계산 순서:
 * 1. flat 모디파이어 합산 (base + sum(flat))
 * 2. multiply 모디파이어 곱셈 (result * product(multiply))
 *
 * @example
 * const attackSpeed = new StatValue(1.0);
 * attackSpeed.addModifier({ id: 'buff-speed', type: 'multiply', value: 1.5 });
 * console.log(attackSpeed.value); // 1.5
 * attackSpeed.removeModifier('buff-speed');
 * console.log(attackSpeed.value); // 1.0
 */
export class StatValue {
  private _base: number;
  private modifiers: Map<string, Modifier> = new Map();
  private _cachedValue: number | null = null;
  private _onChange: ((newValue: number) => void) | null = null;

  constructor(base: number = 0) {
    this._base = base;
    this._cachedValue = base;
  }

  /**
   * 기본값 설정
   */
  get base(): number {
    return this._base;
  }

  set base(value: number) {
    if (this._base !== value) {
      this._base = value;
      this.invalidateCache();
    }
  }

  /**
   * 최종 계산된 값
   */
  get value(): number {
    if (this._cachedValue === null) {
      this._cachedValue = this.calculate();
    }
    return this._cachedValue;
  }

  /**
   * 모디파이어 추가
   */
  addModifier(modifier: Modifier): void {
    this.modifiers.set(modifier.id, modifier);
    this.invalidateCache();
  }

  /**
   * 모디파이어 제거
   */
  removeModifier(id: string): boolean {
    const removed = this.modifiers.delete(id);
    if (removed) {
      this.invalidateCache();
    }
    return removed;
  }

  /**
   * 특정 모디파이어 존재 여부
   */
  hasModifier(id: string): boolean {
    return this.modifiers.has(id);
  }

  /**
   * 모든 모디파이어 제거
   */
  clearModifiers(): void {
    if (this.modifiers.size > 0) {
      this.modifiers.clear();
      this.invalidateCache();
    }
  }

  /**
   * 모디파이어 개수
   */
  get modifierCount(): number {
    return this.modifiers.size;
  }

  /**
   * 값 변경 콜백 설정
   */
  setOnChange(callback: ((newValue: number) => void) | null): void {
    this._onChange = callback;
  }

  /**
   * 최종 값 계산
   */
  private calculate(): number {
    // 모디파이어를 priority 순으로 정렬
    const sorted = Array.from(this.modifiers.values()).sort(
      (a, b) => (a.priority ?? 0) - (b.priority ?? 0)
    );

    // flat 모디파이어 합산
    let flatSum = 0;
    for (const mod of sorted) {
      if (mod.type === 'flat') {
        flatSum += mod.value;
      }
    }

    // multiply 모디파이어 곱셈
    let multiplyProduct = 1;
    for (const mod of sorted) {
      if (mod.type === 'multiply') {
        multiplyProduct *= mod.value;
      }
    }

    return (this._base + flatSum) * multiplyProduct;
  }

  /**
   * 캐시 무효화 및 콜백 호출
   */
  private invalidateCache(): void {
    this._cachedValue = null;
    if (this._onChange) {
      this._onChange(this.value);
    }
  }

  /**
   * 디버그용 문자열
   */
  toString(): string {
    const mods = Array.from(this.modifiers.values())
      .map((m) => `${m.id}(${m.type}:${m.value})`)
      .join(', ');
    return `StatValue(base=${this._base}, value=${this.value}, mods=[${mods}])`;
  }
}

/**
 * 여러 스탯을 관리하는 컨테이너
 *
 * @example
 * const stats = new StatContainer();
 * stats.define('attackSpeed', 1.0);
 * stats.define('moveSpeed', 5.0);
 *
 * stats.addModifier('attackSpeed', { id: 'buff', type: 'multiply', value: 1.5 });
 * console.log(stats.get('attackSpeed')); // 1.5
 */
export class StatContainer {
  private stats: Map<string, StatValue> = new Map();

  /**
   * 스탯 정의
   */
  define(name: string, baseValue: number = 0): StatValue {
    let stat = this.stats.get(name);
    if (!stat) {
      stat = new StatValue(baseValue);
      this.stats.set(name, stat);
    } else {
      stat.base = baseValue;
    }
    return stat;
  }

  /**
   * 스탯 값 가져오기
   */
  get(name: string): number {
    const stat = this.stats.get(name);
    return stat?.value ?? 0;
  }

  /**
   * StatValue 객체 가져오기
   */
  getStat(name: string): StatValue | undefined {
    return this.stats.get(name);
  }

  /**
   * 스탯에 모디파이어 추가
   */
  addModifier(statName: string, modifier: Modifier): boolean {
    const stat = this.stats.get(statName);
    if (stat) {
      stat.addModifier(modifier);
      return true;
    }
    return false;
  }

  /**
   * 스탯에서 모디파이어 제거
   */
  removeModifier(statName: string, modifierId: string): boolean {
    const stat = this.stats.get(statName);
    if (stat) {
      return stat.removeModifier(modifierId);
    }
    return false;
  }

  /**
   * 특정 ID의 모디파이어를 모든 스탯에서 제거
   */
  removeModifierFromAll(modifierId: string): void {
    for (const stat of this.stats.values()) {
      stat.removeModifier(modifierId);
    }
  }

  /**
   * 모든 스탯의 모디파이어 제거
   */
  clearAllModifiers(): void {
    for (const stat of this.stats.values()) {
      stat.clearModifiers();
    }
  }
}
