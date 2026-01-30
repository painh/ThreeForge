import * as THREE from 'three';
import ThreeMeshUI from 'three-mesh-ui';
import { Item } from '../inventory/Item';
import { UITheme, DEFAULT_UI_THEME, mergeTheme } from './UITheme';

// 픽셀을 three-mesh-ui 단위로 변환
const PX = 0.01;
const TOOLTIP_WIDTH = 200 * PX;

export interface ItemTooltipConfig {
  theme?: Partial<UITheme>;
}

/**
 * 디아블로 스타일 아이템 툴팁
 */
export class ItemTooltip extends THREE.Object3D {
  private theme: UITheme;
  private container: ThreeMeshUI.Block;
  private currentItem: Item | null = null;

  // 툴팁 내부 요소들
  private nameText: ThreeMeshUI.Text;
  private typeText: ThreeMeshUI.Text;
  private statsContainer: ThreeMeshUI.Block;
  private descText: ThreeMeshUI.Text;

  constructor(config: ItemTooltipConfig = {}) {
    super();

    this.theme = mergeTheme(DEFAULT_UI_THEME, config.theme ?? {});

    // 메인 컨테이너
    this.container = new ThreeMeshUI.Block({
      width: TOOLTIP_WIDTH,
      padding: 10 * PX,
      backgroundColor: new THREE.Color(0x1a1a1a),
      backgroundOpacity: 0.95,
      borderRadius: 4 * PX,
      borderWidth: 2 * PX,
      borderColor: new THREE.Color(0x444444),
      fontFamily: '/fonts/Roboto-msdf.json',
      fontTexture: '/fonts/Roboto-msdf.png',
      justifyContent: 'start',
      alignItems: 'start',
      contentDirection: 'column',
    });

    // 아이템 이름
    this.nameText = new ThreeMeshUI.Text({
      content: '',
      fontSize: 14 * PX,
      fontColor: new THREE.Color(0xffffff),
    });

    const nameBlock = new ThreeMeshUI.Block({
      width: TOOLTIP_WIDTH - 20 * PX,
      backgroundOpacity: 0,
      justifyContent: 'center',
      alignItems: 'center',
      margin: [0, 0, 5 * PX, 0],
    });
    nameBlock.add(this.nameText);
    this.container.add(nameBlock);

    // 아이템 타입/슬롯
    this.typeText = new ThreeMeshUI.Text({
      content: '',
      fontSize: 10 * PX,
      fontColor: new THREE.Color(0x888888),
    });

    const typeBlock = new ThreeMeshUI.Block({
      width: TOOLTIP_WIDTH - 20 * PX,
      backgroundOpacity: 0,
      justifyContent: 'center',
      alignItems: 'center',
      margin: [0, 0, 8 * PX, 0],
    });
    typeBlock.add(this.typeText);
    this.container.add(typeBlock);

    // 구분선
    const divider = new ThreeMeshUI.Block({
      width: TOOLTIP_WIDTH - 20 * PX,
      height: 1 * PX,
      backgroundColor: new THREE.Color(0x444444),
      margin: [0, 0, 8 * PX, 0],
    });
    this.container.add(divider);

    // 스탯 컨테이너
    this.statsContainer = new ThreeMeshUI.Block({
      width: TOOLTIP_WIDTH - 20 * PX,
      backgroundOpacity: 0,
      contentDirection: 'column',
      justifyContent: 'start',
      alignItems: 'start',
    });
    this.container.add(this.statsContainer);

    // 설명
    this.descText = new ThreeMeshUI.Text({
      content: '',
      fontSize: 10 * PX,
      fontColor: new THREE.Color(0xaaaaaa),
    });

    const descBlock = new ThreeMeshUI.Block({
      width: TOOLTIP_WIDTH - 20 * PX,
      backgroundOpacity: 0,
      margin: [8 * PX, 0, 0, 0],
      justifyContent: 'start',
      alignItems: 'start',
    });
    descBlock.add(this.descText);
    this.container.add(descBlock);

    this.add(this.container);

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
    (this.nameText as any).set({
      content: item.name,
      fontColor: new THREE.Color(rarityColor),
    });

    // 타입 업데이트
    const typeStr = this.getItemTypeString(item);
    (this.typeText as any).set({
      content: typeStr,
    });

    // 스탯 업데이트
    this.updateStats(item);

    // 설명 업데이트
    (this.descText as any).set({
      content: item.description || '',
    });

    // 테두리 색상을 레어리티에 맞게
    (this.container as any).set({
      borderColor: new THREE.Color(rarityColor),
    });

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
    // 기존 스탯 제거
    while (this.statsContainer.children.length > 0) {
      this.statsContainer.remove(this.statsContainer.children[0]);
    }

    if (!item.stats) return;

    const statNames: Record<string, { name: string; color: number }> = {
      attack: { name: '+{value} Attack', color: 0xff6666 },
      defense: { name: '+{value} Defense', color: 0x6666ff },
      health: { name: '+{value} Health', color: 0x66ff66 },
      speed: { name: '+{value}% Speed', color: 0xffff66 },
      critChance: { name: '+{value}% Crit Chance', color: 0xff9966 },
      critDamage: { name: '+{value}% Crit Damage', color: 0xff6699 },
    };

    for (const [stat, value] of Object.entries(item.stats)) {
      if (value === undefined || value === 0) continue;

      const statInfo = statNames[stat];
      if (!statInfo) continue;

      const statBlock = new ThreeMeshUI.Block({
        width: TOOLTIP_WIDTH - 20 * PX,
        backgroundOpacity: 0,
        justifyContent: 'start',
        alignItems: 'start',
        margin: [2 * PX, 0, 2 * PX, 0],
      });

      const statText = new ThreeMeshUI.Text({
        content: statInfo.name.replace('{value}', value.toString()),
        fontSize: 11 * PX,
        fontColor: new THREE.Color(statInfo.color),
      });

      statBlock.add(statText);
      this.statsContainer.add(statBlock);
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
    if (this.visible) {
      ThreeMeshUI.update();
    }
  }

  dispose(): void {
    this.container.clear();
    this.remove(this.container);
  }
}
