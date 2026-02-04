import * as THREE from 'three';

/**
 * FlowingLines 옵션 인터페이스
 */
export interface FlowingLinesOptions {
  /** 각 라인의 정점 수 (기본값: 20) */
  verticesPerLine?: number;
  /** 라인 개수 (기본값: 150) */
  lineCount?: number;
  /** 색상 Hue (0~1, 기본값: 0.6 - 파란색) */
  hue?: number;
  /** 색상 Saturation (0~1, 기본값: 1) */
  saturation?: number;
  /** 스케일 (기본값: 1) */
  scale?: number;
  /** 속도 (기본값: 1) */
  speed?: number;
}

/**
 * 흐르는 라인 이펙트 (파티클 라인)
 *
 * 여러 라인이 3D 공간에서 유기적으로 흐르는 효과.
 * 각 라인은 고유한 랜덤 패턴으로 움직임.
 *
 * @example
 * ```typescript
 * const lines = new FlowingLines({ lineCount: 100, hue: 0.6 });
 * scene.add(lines);
 *
 * // 애니메이션 루프에서
 * function animate(time) {
 *   lines.update(time); // time은 ms 단위
 * }
 * ```
 */
export class FlowingLines extends THREE.Group {
  private lines: THREE.Line[] = [];
  private verticesPerLine: number;
  private effectScale: number;
  private effectSpeed: number;

  constructor(options: FlowingLinesOptions = {}) {
    super();

    const {
      verticesPerLine = 20,
      lineCount = 150,
      hue = 0.6,
      saturation = 1,
      scale = 1,
      speed = 1,
    } = options;

    this.verticesPerLine = verticesPerLine;
    this.effectScale = scale;
    this.effectSpeed = speed;

    // 색상 배열 생성 (밝기 그라디언트)
    const colors: number[] = [];
    const color = new THREE.Color();
    for (let i = 0; i < verticesPerLine; i++) {
      // 머리 부분이 밝고 꼬리로 갈수록 어두워짐
      const lightness = Math.pow(1 - i / (verticesPerLine - 1), 4);
      color.setHSL(hue, saturation, lightness);
      colors.push(color.r, color.g, color.b);
    }

    // 머티리얼 (모든 라인 공유)
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });

    // 라인 생성
    for (let i = 0; i < lineCount; i++) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Array(verticesPerLine * 3).fill(0), 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const line = new THREE.Line(geometry, material);
      (line as any).rnd = Math.random(); // 랜덤 시드
      (line as any).posAttr = geometry.getAttribute('position');

      this.lines.push(line);
      this.add(line);
    }
  }

  /**
   * 3D 경로 계산 (원본 공식)
   */
  private computePath(t: number, rnd: number): THREE.Vector3 {
    t += 10 * rnd;

    const x = (0.1 + 3 * rnd) * Math.sin(t + 13 * rnd) + 2 * rnd * Math.cos(3.2 * t + 3);
    const y = (3 - 3 * rnd) * Math.cos(t) + 2 * rnd * Math.cos(4.5 * t - 7 * rnd);
    const z = (3 * rnd * rnd) * Math.sin(2.7 * t - 4 * rnd);

    return new THREE.Vector3(x * this.effectScale, y * this.effectScale, z * this.effectScale);
  }

  /**
   * 업데이트
   * @param time 시간 (밀리초)
   */
  update(time: number): void {
    const t = (time / 3000) * this.effectSpeed;

    for (const line of this.lines) {
      const rnd = (line as any).rnd;
      const posAttr = (line as any).posAttr as THREE.BufferAttribute;

      for (let i = 0; i < this.verticesPerLine; i++) {
        const pos = this.computePath(t - i / 50, rnd);
        posAttr.setXYZ(i, pos.x, pos.y, pos.z);
      }

      posAttr.needsUpdate = true;
    }
  }

  /**
   * 색상 변경
   * @param hue Hue 값 (0~1)
   * @param saturation Saturation 값 (0~1)
   */
  setColor(hue: number, saturation: number = 1): void {
    const colors: number[] = [];
    const color = new THREE.Color();

    for (let i = 0; i < this.verticesPerLine; i++) {
      const lightness = Math.pow(1 - i / (this.verticesPerLine - 1), 4);
      color.setHSL(hue, saturation, lightness);
      colors.push(color.r, color.g, color.b);
    }

    for (const line of this.lines) {
      const colorAttr = line.geometry.getAttribute('color');
      for (let i = 0; i < this.verticesPerLine; i++) {
        colorAttr.setXYZ(i, colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
      }
      colorAttr.needsUpdate = true;
    }
  }

  /**
   * 리소스 해제
   */
  dispose(): void {
    for (const line of this.lines) {
      line.geometry.dispose();
    }
    // 머티리얼은 공유되므로 첫 번째 것만 해제
    if (this.lines.length > 0) {
      (this.lines[0].material as THREE.Material).dispose();
    }
    this.lines = [];
  }
}
