import * as THREE from 'three';

/**
 * RibbonTrail 옵션 인터페이스
 */
export interface RibbonTrailOptions {
  /** 리본 세그먼트 수 (기본값: 20) */
  segments?: number;
  /** 리본 너비 (기본값: 1) */
  width?: number;
  /** 리본 색상 (기본값: 0xffffff) */
  color?: number | THREE.Color;
  /** 텍스처 (제공하지 않으면 기본 그라디언트 생성) */
  texture?: THREE.Texture;
  /** 투명도 (기본값: 1) */
  opacity?: number;
  /** 양면 렌더링 (기본값: true) */
  doubleSide?: boolean;
  /** 깊이 쓰기 (기본값: false) */
  depthWrite?: boolean;
  /** 블렌딩 모드 (기본값: NormalBlending) */
  blending?: THREE.Blending;
  /** 텍스처 타일링 (기본값: 1) - 텍스처가 리본을 따라 몇 번 반복될지 */
  textureTiling?: number;
}

/**
 * 리본 형태의 트레일 이펙트
 *
 * PlaneGeometry의 정점을 직접 조작하여 부드러운 리본 트레일을 생성합니다.
 *
 * @example
 * ```typescript
 * const trail = new RibbonTrail({ segments: 30, width: 0.5, color: 0xff0000 });
 * scene.add(trail);
 *
 * // 애니메이션 루프에서
 * function animate() {
 *   trail.pushPoint(player.position.clone());
 *   // 또는 카메라를 향하도록
 *   trail.pushPoint(player.position.clone(), camera);
 * }
 * ```
 */
export class RibbonTrail extends THREE.Mesh {
  private segments: number;
  private ribbonWidth: number;
  private points: THREE.Vector3[];
  private positionAttribute: THREE.BufferAttribute;

  constructor(options: RibbonTrailOptions = {}) {
    const {
      segments = 20,
      width = 1,
      color = 0xffffff,
      texture,
      opacity = 1,
      doubleSide = true,
      depthWrite = false,
      blending = THREE.NormalBlending,
      textureTiling = 1,
    } = options;

    // PlaneGeometry 생성: (segments + 1) * 2 개의 정점
    const geometry = new THREE.PlaneGeometry(1, 1, segments, 1);

    // UV 재설정 (텍스처 타일링 적용)
    const uvAttribute = geometry.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i <= segments; i++) {
      const u = (i / segments) * textureTiling;
      // 상단 정점
      uvAttribute.setXY(i * 2, u, 0);
      // 하단 정점
      uvAttribute.setXY(i * 2 + 1, u, 1);
    }
    uvAttribute.needsUpdate = true;

    // 텍스처 생성 또는 사용
    const finalTexture = texture || RibbonTrail.createDefaultTexture();

    // 머티리얼 생성
    const material = new THREE.MeshBasicMaterial({
      map: finalTexture,
      color: new THREE.Color(color),
      side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      transparent: true,
      opacity,
      depthWrite,
      blending,
    });

    super(geometry, material);

    this.segments = segments;
    this.ribbonWidth = width;
    this.points = [];
    this.positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;

    // frustumCulled를 false로 설정하여 정점이 변경되어도 항상 렌더링
    this.frustumCulled = false;

    // 초기에는 보이지 않도록 모든 정점을 원점에 배치
    this.clearTrail();
  }

  /**
   * 기본 그라디언트 텍스처 생성
   * 양 끝이 투명하고 가운데가 불투명한 가로 그라디언트
   */
  static createDefaultTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 8;

    const context = canvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, 64, 0);
    gradient.addColorStop(0.0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,255)');
    gradient.addColorStop(1.0, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 8);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * 세로 그라디언트 텍스처 생성 (꼬리가 페이드 아웃)
   */
  static createFadeOutTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 64;

    const context = canvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0.0, 'rgba(255,255,255,255)');
    gradient.addColorStop(1.0, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 8, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * 트레일에 새 포인트 추가
   * @param position 새 위치
   * @param camera 카메라 (빌보딩용, 선택적)
   */
  pushPoint(position: THREE.Vector3, camera?: THREE.Camera): void {
    // 새 포인트를 앞에 추가
    this.points.unshift(position.clone());

    // segments + 1 개 이상이면 마지막 포인트 제거
    if (this.points.length > this.segments + 1) {
      this.points.pop();
    }

    this.updateGeometry(camera);
  }

  /**
   * 특정 위치들로 트레일 설정
   * @param positions 위치 배열
   * @param camera 카메라 (빌보딩용, 선택적)
   */
  setPoints(positions: THREE.Vector3[], camera?: THREE.Camera): void {
    this.points = positions.map(p => p.clone());

    // segments + 1 개로 제한
    if (this.points.length > this.segments + 1) {
      this.points.length = this.segments + 1;
    }

    this.updateGeometry(camera);
  }

  /**
   * 트레일 클리어
   */
  clearTrail(): void {
    this.points = [];

    // 모든 정점을 원점에 배치
    const vertexCount = (this.segments + 1) * 2;
    for (let i = 0; i < vertexCount; i++) {
      this.positionAttribute.setXYZ(i, 0, 0, 0);
    }
    this.positionAttribute.needsUpdate = true;
  }

  /**
   * 지오메트리 업데이트
   */
  private updateGeometry(camera?: THREE.Camera): void {
    if (this.points.length < 2) {
      return;
    }

    const up = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const cameraPosition = camera ? camera.position.clone() : null;

    for (let i = 0; i <= this.segments; i++) {
      // 포인트 인덱스 계산 (보간)
      const t = i / this.segments;
      const pointIndex = t * (this.points.length - 1);
      const index0 = Math.floor(pointIndex);
      const index1 = Math.min(index0 + 1, this.points.length - 1);
      const alpha = pointIndex - index0;

      // 현재 위치 보간
      const pos = new THREE.Vector3().lerpVectors(
        this.points[index0],
        this.points[index1],
        alpha
      );

      // 방향 계산
      if (index1 < this.points.length - 1) {
        forward.subVectors(this.points[index1 + 1], this.points[index0]).normalize();
      } else if (index0 > 0) {
        forward.subVectors(this.points[index1], this.points[index0 - 1]).normalize();
      } else {
        forward.subVectors(this.points[index1], this.points[index0]).normalize();
      }

      // 리본 너비 방향 계산
      if (cameraPosition) {
        // 카메라 빌보딩: 카메라를 향하도록
        const toCamera = new THREE.Vector3().subVectors(cameraPosition, pos).normalize();
        right.crossVectors(forward, toCamera).normalize();
      } else {
        // 기본: Y축 기준
        up.set(0, 1, 0);
        right.crossVectors(forward, up).normalize();
        if (right.lengthSq() < 0.001) {
          up.set(0, 0, 1);
          right.crossVectors(forward, up).normalize();
        }
      }

      // 너비 페이드 (끝으로 갈수록 좁아짐)
      const widthFade = 1 - (i / this.segments) * 0.5;
      const halfWidth = (this.ribbonWidth * widthFade) / 2;

      // 정점 설정 (상단, 하단)
      const topVertex = pos.clone().addScaledVector(right, halfWidth);
      const bottomVertex = pos.clone().addScaledVector(right, -halfWidth);

      this.positionAttribute.setXYZ(i * 2, topVertex.x, topVertex.y, topVertex.z);
      this.positionAttribute.setXYZ(i * 2 + 1, bottomVertex.x, bottomVertex.y, bottomVertex.z);
    }

    this.positionAttribute.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  /**
   * 리본 너비 설정
   */
  setWidth(width: number): void {
    this.ribbonWidth = width;
    if (this.points.length >= 2) {
      this.updateGeometry();
    }
  }

  /**
   * 색상 설정
   */
  setColor(color: number | THREE.Color): void {
    const material = this.material as THREE.MeshBasicMaterial;
    material.color.set(color);
  }

  /**
   * 투명도 설정
   */
  setOpacity(opacity: number): void {
    const material = this.material as THREE.MeshBasicMaterial;
    material.opacity = opacity;
  }

  /**
   * 현재 포인트 수 반환
   */
  getPointCount(): number {
    return this.points.length;
  }

  /**
   * 리소스 해제
   */
  dispose(): void {
    this.geometry.dispose();
    const material = this.material as THREE.MeshBasicMaterial;
    if (material.map) {
      material.map.dispose();
    }
    material.dispose();
  }
}
