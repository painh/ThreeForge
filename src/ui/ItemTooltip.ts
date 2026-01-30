import * as THREE from 'three';
import { Item } from '../inventory/Item';
import { UITheme, DEFAULT_UI_THEME, mergeTheme } from './UITheme';
import { UIPanel, UIText, UIBox } from '../../../three-troika-ui/src';

// 픽셀을 UI 단위로 변환
const PX = 0.01;
const TOOLTIP_WIDTH = 200 * PX;

export interface ItemTooltipConfig {
  theme?: Partial<UITheme>;
}

/**
 * 디아블로 스타일 아이템 툴팁 (troika-ui 기반)
 */
export class ItemTooltip extends THREE.Object3D {
  private theme: UITheme;
  private container: UIPanel;
  private borderBox: UIBox;
  private currentItem: Item | null = null;

  // 툴팁 내부 요소들
  private nameText: UIText;
  private typeText: UIText;
  private statsContainer: UIPanel;
  private statTexts: UIText[] = [];
  private descText: UIText;
  private divider: UIBox;

  private static readonly MAX_STATS = 6;

  constructor(config: ItemTooltipConfig = {}) {
    super();

    this.theme = mergeTheme(DEFAULT_UI_THEME, config.theme ?? {});

    // 테두리 박스 (별도로 관리해서 색상 변경 가능)
    this.borderBox = new UIBox({
      width: TOOLTIP_WIDTH,
      height: 180 * PX,
      color: 0x1a1a1a,
      opacity: 0.95,
      borderRadius: 4 * PX,
      borderWidth: 2 * PX,
      borderColor: 0x444444,
    });
    this.add(this.borderBox);

    // 메인 컨테이너
    this.container = new UIPanel({
      width: TOOLTIP_WIDTH - 20 * PX,
      height: 160 * PX,
      padding: 5 * PX,
      gap: 3 * PX,
      direction: 'vertical',
      justify: 'start',
      align: 'center',
    });
    this.container.position.z = 0.01;
    this.add(this.container);

    // 아이템 이름
    this.nameText = new UIText({
      text: '',
      fontSize: 14 * PX,
      color: 0xffffff,
      anchorX: 'center',
      anchorY: 'middle',
    });
    this.container.addChild(this.nameText);

    // 아이템 타입/슬롯
    this.typeText = new UIText({
      text: '',
      fontSize: 10 * PX,
      color: 0x888888,
      anchorX: 'center',
      anchorY: 'middle',
    });
    this.container.addChild(this.typeText);

    // 구분선
    this.divider = new UIBox({
      width: TOOLTIP_WIDTH - 30 * PX,
      height: 1 * PX,
      color: 0x444444,
      opacity: 1,
    });
    this.container.addChild(this.divider);

    // 스탯 컨테이너
    this.statsContainer = new UIPanel({
      width: TOOLTIP_WIDTH - 30 * PX,
      height: 80 * PX,
      gap: 2 * PX,
      direction: 'vertical',
      justify: 'start',
      align: 'start',
    });
    this.container.addChild(this.statsContainer);

    // 스탯 텍스트 미리 생성
    this.createStatTexts();

    // 설명
    this.descText = new UIText({
      text: '',
      fontSize: 10 * PX,
      color: 0xaaaaaa,
      anchorX: 'center',
      anchorY: 'middle',
    });
    this.container.addChild(this.descText);

    // 기본적으로 숨김
    this.visible = false;

    // renderOrder 설정
    this.setRenderOrder(300);
  }

  /**
   * 렌더 순서 설정
   */
  private setRenderOrder(order: number): void {
    this.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.renderOrder = order;
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
   * 스탯 텍스트 미리 생성
   */
  private createStatTexts(): void {
    for (let i = 0; i < ItemTooltip.MAX_STATS; i++) {
      const statText = new UIText({
        text: ' ',
        fontSize: 11 * PX,
        color: 0xffffff,
        anchorX: 'left',
        anchorY: 'middle',
      });
      this.statsContainer.addChild(statText);
      this.statTexts.push(statText);
    }
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

    // 이름 업데이트
    this.nameText.setText(item.name);
    this.nameText.setColor(rarityColor);

    // 타입 업데이트
    const typeStr = this.getItemTypeString(item);
    this.typeText.setText(typeStr);

    // 스탯 업데이트
    this.updateStats(item);

    // 설명 업데이트
    this.descText.setText(item.description || '');

    // 테두리 색상을 레어리티에 맞게
    this.borderBox.setBorder(2 * PX, rarityColor);

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
   * 스탯 표시 업데이트
   */
  private updateStats(item: Item): void {
    const statNames: Record<string, { name: string; color: number }> = {
      attack: { name: '+{value} Attack', color: 0xff6666 },
      defense: { name: '+{value} Defense', color: 0x6666ff },
      health: { name: '+{value} Health', color: 0x66ff66 },
      speed: { name: '+{value}% Speed', color: 0xffff66 },
      critChance: { name: '+{value}% Crit Chance', color: 0xff9966 },
      critDamage: { name: '+{value}% Crit Damage', color: 0xff6699 },
    };

    // 스탯 정보 수집
    const stats: { content: string; color: number }[] = [];
    if (item.stats) {
      for (const [stat, value] of Object.entries(item.stats)) {
        if (value === undefined || value === 0) continue;
        const statInfo = statNames[stat];
        if (!statInfo) continue;
        stats.push({
          content: statInfo.name.replace('{value}', value.toString()),
          color: statInfo.color,
        });
      }
    }

    // 모든 스탯 텍스트 업데이트
    for (let i = 0; i < this.statTexts.length; i++) {
      const statText = this.statTexts[i];
      if (i < stats.length) {
        statText.setText(stats[i].content);
        statText.setColor(stats[i].color);
      } else {
        // 사용하지 않는 슬롯은 공백으로 설정
        statText.setText(' ');
        statText.setColor(0x000000);
      }
    }
  }

  /**
   * 툴팁 숨기기
   */
  hide(): void {
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
   * 툴팁 위치 설정 (로컬 좌표)
   */
  setLocalPosition(x: number, y: number): void {
    this.position.set(x, y, 15);
  }

  /**
   * UI 업데이트
   */
  update(): void {
    // troika-ui는 자동 업데이트되므로 별도 작업 불필요
  }

  dispose(): void {
    this.nameText.dispose();
    this.typeText.dispose();
    this.descText.dispose();
    this.divider.dispose();
    for (const statText of this.statTexts) {
      statText.dispose();
    }
    this.statsContainer.dispose();
    this.container.dispose();
    this.borderBox.dispose();
  }
}
