import * as THREE from 'three';
import ThreeMeshUI from 'three-mesh-ui';
import { Equipment } from '../inventory/Equipment';
import { Item } from '../inventory/Item';
import { UITheme, DEFAULT_UI_THEME, mergeTheme } from './UITheme';

// 텍스처 캐시
const textureCache: Map<string, THREE.Texture> = new Map();
const textureLoader = new THREE.TextureLoader();
const pendingLoads: Set<string> = new Set();

function loadTexture(url: string, onLoaded?: () => void): THREE.Texture | null {
  // 이미 캐시에 있으면 바로 반환 (콜백 호출 안 함)
  if (textureCache.has(url)) {
    return textureCache.get(url)!;
  }

  // 이미 로드 중이면 스킵
  if (pendingLoads.has(url)) {
    return null;
  }
  pendingLoads.add(url);

  textureLoader.load(
    url,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      textureCache.set(url, texture);
      pendingLoads.delete(url);
      // 로드 완료 시 콜백 호출 (한 번만)
      if (onLoaded) {
        onLoaded();
      }
    },
    undefined,
    () => {
      console.warn('Failed to load texture:', url);
      pendingLoads.delete(url);
    }
  );

  return null;
}

export interface EquipmentSlotPosition {
  slotId: string;
  row: number;  // 행 (0부터)
  col: number;  // 열 (0부터)
  width?: number;  // 슬롯 크기 배율 (기본 1)
  height?: number;
}

export interface EquipmentUIConfig {
  equipment: Equipment;
  layout: EquipmentSlotPosition[];
  cols: number;  // 열 개수
  rows: number;  // 행 개수
  theme?: Partial<UITheme>;
  onSlotClick?: (slotId: string, item: Item | null) => void;
  onSlotRightClick?: (slotId: string, item: Item | null) => void;
}

interface EquipSlotUI {
  slotId: string;
  container: ThreeMeshUI.Block;
  background: ThreeMeshUI.Block;
  labelText: ThreeMeshUI.Text;
  itemIcon?: THREE.Sprite;
}

// three-mesh-ui Block set 메서드 타입 헬퍼
type BlockWithSet = ThreeMeshUI.Block & { set: (props: Record<string, unknown>) => void };

// 픽셀을 three-mesh-ui 단위로 변환 (1 unit = 100px 기준)
const PX = 0.01;

/**
 * 장비 UI (디아블로 스타일 캐릭터 장비창)
 */
export class EquipmentUI extends THREE.Object3D {
  private equipment: Equipment;
  private theme: UITheme;
  private container: ThreeMeshUI.Block;
  private slotUIs: Map<string, EquipSlotUI> = new Map();

  private onSlotClick?: (slotId: string, item: Item | null) => void;
  private onSlotRightClick?: (slotId: string, item: Item | null) => void;

  private hoveredSlot: string | null = null;

  constructor(config: EquipmentUIConfig) {
    super();

    this.equipment = config.equipment;
    this.theme = mergeTheme(DEFAULT_UI_THEME, config.theme ?? {});
    this.onSlotClick = config.onSlotClick;
    this.onSlotRightClick = config.onSlotRightClick;

    this.container = this.createContainer(config.cols, config.rows);
    this.add(this.container);

    this.createSlots(config.layout, config.cols, config.rows);
    this.refresh();

    // 장비 변경 이벤트 구독
    this.equipment.on('changed', () => this.refresh());
  }

  private createContainer(cols: number, rows: number): ThreeMeshUI.Block {
    const { backgroundColor, backgroundOpacity, borderRadius, padding, slotSize, slotGap } = this.theme;

    const totalWidth = cols * slotSize + (cols + 1) * slotGap + padding * 2;
    const totalHeight = rows * slotSize + (rows + 1) * slotGap + padding * 2;

    return new ThreeMeshUI.Block({
      width: totalWidth * PX,
      height: totalHeight * PX,
      padding: padding * PX,
      backgroundColor: new THREE.Color(backgroundColor),
      backgroundOpacity,
      borderRadius: borderRadius * PX,
      fontFamily: '/fonts/Roboto-msdf.json',
      fontTexture: '/fonts/Roboto-msdf.png',
      justifyContent: 'center',
      alignItems: 'center',
      contentDirection: 'column',
    });
  }

  private createSlots(layout: EquipmentSlotPosition[], cols: number, rows: number): void {
    const { slotSize, slotGap, slotEmptyColor, borderRadius, fontColor, fontSize } = this.theme;

    // 그리드 기반으로 행별 Block 생성
    const grid: (EquipmentSlotPosition | null)[][] = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        grid[r][c] = null;
      }
    }

    // 레이아웃에서 슬롯 위치 할당
    for (const pos of layout) {
      if (pos.row < rows && pos.col < cols) {
        grid[pos.row][pos.col] = pos;
      }
    }

    // 행별로 Block 생성
    for (let r = 0; r < rows; r++) {
      const rowBlock = new ThreeMeshUI.Block({
        width: (cols * slotSize + (cols + 1) * slotGap) * PX,
        height: (slotSize + slotGap) * PX,
        contentDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundOpacity: 0,
      });

      for (let c = 0; c < cols; c++) {
        const pos = grid[r][c];

        if (pos) {
          const slotConfig = this.equipment.getSlotConfig(pos.slotId);
          if (!slotConfig) {
            // 빈 슬롯 공간
            const emptySpace = new ThreeMeshUI.Block({
              width: slotSize * PX,
              height: slotSize * PX,
              margin: (slotGap / 2) * PX,
              backgroundOpacity: 0,
            });
            rowBlock.add(emptySpace);
            continue;
          }

          // 슬롯 컨테이너 (라벨 + 배경)
          const slotContainer = new ThreeMeshUI.Block({
            width: slotSize * PX,
            height: slotSize * PX,
            margin: (slotGap / 2) * PX,
            backgroundColor: new THREE.Color(slotEmptyColor),
            backgroundOpacity: 1,
            borderRadius: borderRadius * PX,
            justifyContent: 'center',
            alignItems: 'center',
            contentDirection: 'column',
          });

          // 슬롯 ID 저장 (인터랙션용)
          /* eslint-disable @typescript-eslint/no-explicit-any */
          (slotContainer as any).slotId = pos.slotId;
          (slotContainer as any).isEquipSlot = true;
          /* eslint-enable @typescript-eslint/no-explicit-any */

          // 슬롯 라벨 (슬롯 이름 전체 표시)
          const labelText = new ThreeMeshUI.Text({
            content: slotConfig.name,
            fontSize: (fontSize - 6) * PX,
            fontColor: new THREE.Color(fontColor),
          });

          slotContainer.add(labelText);

          this.slotUIs.set(pos.slotId, {
            slotId: pos.slotId,
            container: slotContainer,
            background: slotContainer,
            labelText,
          });

          rowBlock.add(slotContainer);
        } else {
          // 빈 슬롯 공간
          const emptySpace = new ThreeMeshUI.Block({
            width: slotSize * PX,
            height: slotSize * PX,
            margin: (slotGap / 2) * PX,
            backgroundOpacity: 0,
          });
          rowBlock.add(emptySpace);
        }
      }

      this.container.add(rowBlock);
    }
  }

  /**
   * UI 새로고침
   */
  refresh(): void {
    const { slotSize, slotColor, slotEmptyColor, rarityColors, fontColor } = this.theme;

    for (const [slotId, slotUI] of this.slotUIs) {
      const item = this.equipment.getEquipped(slotId);

      // 기존 아이템 아이콘 제거
      if (slotUI.itemIcon) {
        slotUI.background.remove(slotUI.itemIcon);
        slotUI.itemIcon.material.dispose();
        slotUI.itemIcon = undefined;
      }

      // 라벨 다시 추가 (아이콘 제거 시 같이 제거될 수 있음)
      const slotConfig = this.equipment.getSlotConfig(slotId);

      if (item) {
        const rarityColor = rarityColors[item.rarity] ?? rarityColors.common;

        (slotUI.background as BlockWithSet).set({
          backgroundColor: new THREE.Color(slotColor),
          borderWidth: 2 * PX,
          borderColor: new THREE.Color(rarityColor),
        });

        // 아이콘 텍스처 로드 (로드 완료 시 refresh 콜백)
        const iconUrl = item.icon;
        const texture = iconUrl ? loadTexture(iconUrl, () => this.refresh()) : null;

        // THREE.Sprite로 아이콘 표시
        if (texture) {
          const iconSize = (slotSize - 12) * PX;
          const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
          });
          const sprite = new THREE.Sprite(spriteMaterial);
          sprite.scale.set(iconSize, iconSize, 1);
          sprite.position.set(0, 0, 0.01);
          slotUI.itemIcon = sprite;
          slotUI.background.add(sprite);
        }

        // 라벨은 빈 문자열로 (아이콘이 대신함)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (slotUI.labelText as any).set({
          content: '',
        });
      } else {
        (slotUI.background as BlockWithSet).set({
          backgroundColor: new THREE.Color(slotEmptyColor),
          borderWidth: 0,
        });

        // 슬롯 이름으로 복원
        if (slotConfig) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (slotUI.labelText as any).set({
            content: slotConfig.name,
            fontColor: new THREE.Color(fontColor),
          });
        }
      }
    }
  }

  /**
   * 슬롯 호버 처리
   */
  setHoveredSlot(slotId: string): void {
    if (this.hoveredSlot) {
      this.updateSlotState(this.hoveredSlot);
    }

    this.hoveredSlot = slotId;
    const slotUI = this.slotUIs.get(slotId);
    if (slotUI) {
      (slotUI.background as BlockWithSet).set({
        backgroundColor: new THREE.Color(this.theme.slotHoverColor),
      });
    }
  }

  clearHover(): void {
    if (this.hoveredSlot) {
      this.updateSlotState(this.hoveredSlot);
      this.hoveredSlot = null;
    }
  }

  private updateSlotState(slotId: string): void {
    const item = this.equipment.getEquipped(slotId);
    const slotUI = this.slotUIs.get(slotId);
    if (!slotUI) return;

    if (item) {
      (slotUI.background as BlockWithSet).set({
        backgroundColor: new THREE.Color(this.theme.slotColor),
      });
    } else {
      (slotUI.background as BlockWithSet).set({
        backgroundColor: new THREE.Color(this.theme.slotEmptyColor),
      });
    }
  }

  /**
   * 클릭 이벤트 처리
   */
  handleClick(slotId: string): void {
    const item = this.equipment.getEquipped(slotId);
    this.onSlotClick?.(slotId, item);
  }

  handleRightClick(slotId: string): void {
    const item = this.equipment.getEquipped(slotId);
    this.onSlotRightClick?.(slotId, item);
  }

  /**
   * 레이캐스트용 객체 반환
   */
  getInteractiveObjects(): THREE.Object3D[] {
    const objects: THREE.Object3D[] = [];
    for (const slotUI of this.slotUIs.values()) {
      objects.push(slotUI.background);
    }
    return objects;
  }

  /**
   * UI 업데이트
   */
  update(): void {
    ThreeMeshUI.update();
  }

  dispose(): void {
    this.equipment.off('changed', () => this.refresh());
    this.container.clear();
    this.remove(this.container);
  }
}

/**
 * 기본 디아블로 스타일 장비 레이아웃 (3x4 그리드)
 *
 *     [Head]  [Amulet]  [    ]
 *     [Main]  [Chest]   [Off ]
 *     [Hand]  [Legs]    [Ring]
 *     [    ]  [Feet]    [Ring]
 */
export const DEFAULT_EQUIPMENT_LAYOUT: EquipmentSlotPosition[] = [
  { slotId: 'head', row: 0, col: 0 },
  { slotId: 'amulet', row: 0, col: 1 },
  { slotId: 'mainHand', row: 1, col: 0 },
  { slotId: 'chest', row: 1, col: 1 },
  { slotId: 'offHand', row: 1, col: 2 },
  { slotId: 'hands', row: 2, col: 0 },
  { slotId: 'legs', row: 2, col: 1 },
  { slotId: 'ring1', row: 2, col: 2 },
  { slotId: 'feet', row: 3, col: 1 },
  { slotId: 'ring2', row: 3, col: 2 },
];

export const DEFAULT_EQUIPMENT_COLS = 3;
export const DEFAULT_EQUIPMENT_ROWS = 4;
