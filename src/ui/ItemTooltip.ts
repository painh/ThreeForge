import * as THREE from 'three';
import { Item } from '../inventory/Item';
import { UITheme, DEFAULT_UI_THEME, mergeTheme } from './UITheme';
import { UITooltip, TooltipLine } from '../../../three-troika-ui/src';

export interface ItemTooltipConfig {
  theme?: Partial<UITheme>;
  /** 화면 경계 (카메라 뷰 크기) */
  viewBounds?: { width: number; height: number };
  /** 슬롯으로부터 떨어질 거리 */
  offset?: { x: number; y: number };
}

// 픽셀을 UI 단위로 변환
const PX = 0.01;
// 툴팁 크기 배율
const TOOLTIP_SCALE = 3;
// 툴팁 Z 인덱스
const TOOLTIP_Z_INDEX = 10;

/**
 * 디아블로 스타일 아이템 툴팁 (UITooltip 기반)
 */
export class ItemTooltip extends THREE.Object3D {
  private theme: UITheme;
  private tooltip: UITooltip;
  private currentItem: Item | null = null;

  constructor(config: ItemTooltipConfig = {}) {
    super();

    this.theme = mergeTheme(DEFAULT_UI_THEME, config.theme ?? {});

    this.tooltip = new UITooltip({
      backgroundColor: 0x1a1a1a,
      backgroundOpacity: 0.95,
      borderColor: 0x444444,
      borderWidth: 2 * PX * TOOLTIP_SCALE,
      borderRadius: 4 * PX * TOOLTIP_SCALE,
      padding: 10 * PX * TOOLTIP_SCALE,
      maxWidth: 250 * PX * TOOLTIP_SCALE,
      fontSize: 12 * PX * TOOLTIP_SCALE,
      textColor: 0xffffff,
      // viewBounds 비활성화 - 직접 위치 설정
      offset: config.offset ?? { x: 0.3, y: 0.3 },
    });
    this.add(this.tooltip);

    // renderOrder 설정
    this.setRenderOrder(300);
  }

  /**
   * 렌더 순서 설정
   */
  private setRenderOrder(order: number): void {
    // UITooltip의 setRenderOrder 호출
    this.tooltip.setRenderOrder(order);
  }

  /**
   * 화면 경계 설정
   */
  setViewBounds(width: number, height: number): this {
    this.tooltip.setViewBounds(width, height);
    return this;
  }

  /**
   * 아이템 정보로 툴팁 업데이트
   */
  setItem(item: Item | null): void {
    if (!item) {
      this.hide();
      return;
    }

    // 같은 아이템이면 스킵
    if (this.currentItem === item) return;

    this.currentItem = item;

    // 레어리티 색상
    const rarityColor = this.theme.rarityColors[item.rarity] ?? this.theme.rarityColors.common;

    // 툴팁 라인 생성
    const lines: TooltipLine[] = [];

    // 이름
    lines.push({
      text: item.name,
      color: rarityColor,
      fontSize: 14 * PX * TOOLTIP_SCALE,
    });

    // 타입
    const typeStr = this.getItemTypeString(item);
    lines.push({
      text: typeStr,
      color: 0x888888,
      fontSize: 10 * PX * TOOLTIP_SCALE,
    });

    // 구분선
    lines.push({ text: '─────────────', color: 0x444444, fontSize: 8 * PX * TOOLTIP_SCALE });

    // 스탯
    const statLines = this.getStatLines(item);
    lines.push(...statLines);

    // 설명
    if (item.description) {
      lines.push({ text: '', fontSize: 6 * PX * TOOLTIP_SCALE }); // 간격
      lines.push({
        text: item.description,
        color: 0xaaaaaa,
        fontSize: 10 * PX * TOOLTIP_SCALE,
      });
    }

    // 테두리 색상 변경
    this.tooltip.setBorderColor(rarityColor);
    this.tooltip.setContent(lines);
    this.visible = true;
    this.setRenderOrder(300);
  }

  /**
   * 아이템 타입 문자열 생성
   */
  private getItemTypeString(item: Item): string {
    if (item.equipSlot) {
      const slotNames: Record<string, string> = {
        head: 'Head',
        chest: 'Chest',
        hands: 'Hands',
        legs: 'Legs',
        feet: 'Feet',
        mainHand: 'Main Hand',
        offHand: 'Off Hand',
        ring: 'Ring',
        amulet: 'Amulet',
        rangedWeapon: 'Ranged Weapon',
        meleeWeapon: 'Melee Weapon',
      };
      return slotNames[item.equipSlot] || item.equipSlot;
    }
    if (item.isStackable) {
      return 'Consumable';
    }
    return 'Item';
  }

  // 비교용 스탯 정의
  private static readonly STAT_DEFS: Record<string, { label: string; color: number }> = {
    physicalAttack: { label: 'Physical ATK', color: 0xff6666 },
    shieldAttack: { label: 'Shield ATK', color: 0x66aaff },
    wep_pierce: { label: 'Pierce', color: 0xff99cc },
    wep_fireRate: { label: 'Fire Rate', color: 0xffcc33 },
    mel_atkRate: { label: 'Attack Rate', color: 0xffcc33 },
    mel_range: { label: 'Range', color: 0xff8844 },
    defense: { label: 'Defense', color: 0x6666ff },
    health: { label: 'Health', color: 0x66ff66 },
    speed: { label: 'Speed', color: 0xffff66 },
    critChance: { label: 'Crit Chance', color: 0xff9966 },
    critDamage: { label: 'Crit Damage', color: 0xff6699 },
    attackSpeed: { label: 'ATK Speed', color: 0xffcc33 },
    shotSpeed: { label: 'Shot Speed', color: 0x66ffcc },
    bulletSize: { label: 'Bullet Size', color: 0xcc99ff },
    bulletLifetime: { label: 'Bullet Life', color: 0x99ccff },
    piercing: { label: 'Piercing', color: 0xff99cc },
    meleeRange: { label: 'Melee Range', color: 0xff8844 },
    meleeAttackSize: { label: 'Melee Size', color: 0xffaa66 },
  };

  /**
   * 아이템에서 비교 가능한 스탯 추출
   */
  private extractComparableStats(item: Item): Map<string, number> {
    const stats = new Map<string, number>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = item.config as any;

    // 무기 기본 데미지를 ATK에 합산
    if (cfg.weaponConfig) {
      const wc = cfg.weaponConfig;
      if (wc.physicalDamage != null) stats.set('physicalAttack', (stats.get('physicalAttack') ?? 0) + wc.physicalDamage);
      if (wc.shieldDamage != null) stats.set('shieldAttack', (stats.get('shieldAttack') ?? 0) + wc.shieldDamage);
      if (wc.pierce != null && wc.pierce > 1) stats.set('wep_pierce', wc.pierce);
      if (wc.interval != null) stats.set('wep_fireRate', parseFloat((1 / wc.interval).toFixed(1)));
    }
    if (cfg.meleeWeaponConfig) {
      const mc = cfg.meleeWeaponConfig;
      if (mc.physicalDamage != null) stats.set('physicalAttack', (stats.get('physicalAttack') ?? 0) + mc.physicalDamage);
      if (mc.shieldDamage != null) stats.set('shieldAttack', (stats.get('shieldAttack') ?? 0) + mc.shieldDamage);
      if (mc.attackInterval != null) stats.set('mel_atkRate', parseFloat((1 / mc.attackInterval).toFixed(1)));
      if (mc.range != null) stats.set('mel_range', mc.range);
    }

    // 장비 스탯 (ItemStats) - 무기 기본 데미지와 합산
    if (item.stats) {
      for (const [stat, value] of Object.entries(item.stats)) {
        if (value === undefined || value === 0) continue;
        if (ItemTooltip.STAT_DEFS[stat]) {
          stats.set(stat, (stats.get(stat) ?? 0) + value);
        }
      }
    }

    return stats;
  }

  /**
   * 스탯 라인 생성
   */
  private getStatLines(item: Item): TooltipLine[] {
    const lines: TooltipLine[] = [];
    const fontSize = 11 * PX * TOOLTIP_SCALE;

    const itemStats = this.extractComparableStats(item);

    for (const [key, value] of itemStats) {
      const def = ItemTooltip.STAT_DEFS[key];
      if (!def) continue;

      const isPercent = ['speed', 'critChance', 'critDamage', 'attackSpeed', 'shotSpeed',
        'bulletSize', 'bulletLifetime', 'meleeRange', 'meleeAttackSize'].includes(key);
      const isRate = key === 'wep_fireRate' || key === 'mel_atkRate';
      const isPlus = !isRate && !key.startsWith('wep_') && !key.startsWith('mel_');

      let text: string;
      if (isRate) {
        text = `${def.label}: ${value}/s`;
      } else if (isPlus) {
        text = `+${value}${isPercent ? '%' : ''} ${def.label}`;
      } else {
        text = `${def.label}: ${value}`;
      }

      lines.push({ text, color: def.color, fontSize });
    }

    return lines;
  }

  /**
   * 툴팁 숨기기
   */
  hide(): void {
    this.tooltip.hide();
    this.visible = false;
    this.currentItem = null;
  }

  /**
   * 현재 표시 중인 아이템
   */
  getItem(): Item | null {
    return this.currentItem;
  }

  /**
   * 툴팁 위치 설정 (인벤토리 왼쪽 바깥에 배치)
   * @param inventoryLeftEdge 인벤토리 왼쪽 경계 X 좌표
   * @param slotY 슬롯 Y 좌표 (툴팁 Y 위치 참조용)
   */
  setLocalPosition(inventoryLeftEdge: number, slotY: number): void {
    // 툴팁 콘텐츠 크기
    const tooltipHalfWidth = this.tooltip.getContentWidth() / 2;

    // 인벤토리 왼쪽 바깥에 배치
    // 툴팁의 오른쪽 면이 인벤토리 왼쪽 면에 닿도록
    const gap = 0.1; // 약간의 간격
    const tooltipX = inventoryLeftEdge - tooltipHalfWidth - gap;
    const tooltipY = slotY;

    this.position.set(tooltipX, tooltipY, TOOLTIP_Z_INDEX);
  }

  /**
   * UI 업데이트
   */
  update(): void {
    // 자동 업데이트
  }

  dispose(): void {
    this.tooltip.dispose();
  }
}
