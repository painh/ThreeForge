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
      borderWidth: 2 * PX,
      borderRadius: 4 * PX,
      padding: 10 * PX,
      maxWidth: 250 * PX,
      fontSize: 12 * PX,
      textColor: 0xffffff,
      viewBounds: config.viewBounds ?? { width: 20, height: 15 },
      offset: config.offset ?? { x: 0.6, y: 0.3 },
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

    this.currentItem = item;

    // 레어리티 색상
    const rarityColor = this.theme.rarityColors[item.rarity] ?? this.theme.rarityColors.common;

    // 툴팁 라인 생성
    const lines: TooltipLine[] = [];

    // 이름
    lines.push({
      text: item.name,
      color: rarityColor,
      fontSize: 14 * PX,
    });

    // 타입
    const typeStr = this.getItemTypeString(item);
    lines.push({
      text: typeStr,
      color: 0x888888,
      fontSize: 10 * PX,
    });

    // 구분선
    lines.push({ text: '─────────────', color: 0x444444, fontSize: 8 * PX });

    // 스탯
    const statLines = this.getStatLines(item);
    lines.push(...statLines);

    // 설명
    if (item.description) {
      lines.push({ text: '', fontSize: 6 * PX }); // 간격
      lines.push({
        text: item.description,
        color: 0xaaaaaa,
        fontSize: 10 * PX,
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
      };
      return slotNames[item.equipSlot] || item.equipSlot;
    }
    if (item.isStackable) {
      return 'Consumable';
    }
    return 'Item';
  }

  /**
   * 스탯 라인 생성
   */
  private getStatLines(item: Item): TooltipLine[] {
    const statNames: Record<string, { name: string; color: number }> = {
      attack: { name: '+{value} Attack', color: 0xff6666 },
      defense: { name: '+{value} Defense', color: 0x6666ff },
      health: { name: '+{value} Health', color: 0x66ff66 },
      speed: { name: '+{value}% Speed', color: 0xffff66 },
      critChance: { name: '+{value}% Crit Chance', color: 0xff9966 },
      critDamage: { name: '+{value}% Crit Damage', color: 0xff6699 },
    };

    const lines: TooltipLine[] = [];
    if (item.stats) {
      for (const [stat, value] of Object.entries(item.stats)) {
        if (value === undefined || value === 0) continue;
        const statInfo = statNames[stat];
        if (!statInfo) continue;
        lines.push({
          text: statInfo.name.replace('{value}', value.toString()),
          color: statInfo.color,
          fontSize: 11 * PX,
        });
      }
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
   * 툴팁 위치 설정 (슬롯 위치 기준 - 로컬 좌표)
   * 화면 경계를 고려하여 자동 조절됨
   */
  setLocalPosition(x: number, y: number): void {
    this.tooltip.setAnchorPosition(x, y);
    this.position.z = 15;
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
