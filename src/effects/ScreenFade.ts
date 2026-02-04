import {
  Scene,
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  Color,
  ColorRepresentation,
} from 'three';

export interface ScreenFadeOptions {
  /** 페이드 색상 (기본: 검은색) */
  color?: ColorRepresentation;
  /** 초기 투명도 (0 = 투명, 1 = 불투명) */
  initialAmount?: number;
  /** 오버레이 크기 (기본: 100) */
  size?: number;
}

/**
 * 화면 페이드 인/아웃 효과를 위한 클래스
 * 별도의 Scene을 사용하여 모든 UI 위에 렌더링됨
 */
export class ScreenFade {
  /** 페이드 전용 씬 (가장 마지막에 렌더링해야 함) */
  readonly scene: Scene;

  private overlay: Mesh;
  private material: MeshBasicMaterial;

  private currentAmount: number = 0;
  private targetAmount: number = 0;
  private duration: number = 1.0;
  private callback: (() => void) | null = null;

  constructor(options: ScreenFadeOptions = {}) {
    const {
      color = 0x000000,
      initialAmount = 0,
      size = 100,
    } = options;

    // 페이드 전용 씬 생성
    this.scene = new Scene();

    // 페이드 오버레이 생성
    this.material = new MeshBasicMaterial({
      color: new Color(color),
      transparent: true,
      opacity: initialAmount,
      depthTest: false,
      depthWrite: false,
    });

    const geometry = new PlaneGeometry(size, size);
    this.overlay = new Mesh(geometry, this.material);
    this.overlay.position.z = 0;
    this.overlay.visible = initialAmount > 0;
    this.scene.add(this.overlay);

    this.currentAmount = initialAmount;
    this.targetAmount = initialAmount;
  }

  /**
   * 페이드 아웃 시작 (화면이 점점 어두워짐)
   * @param duration 페이드 지속 시간 (초)
   * @param onComplete 페이드 완료 시 콜백
   */
  fadeOut(duration: number = 1.0, onComplete?: () => void): void {
    this.targetAmount = 1;
    this.duration = duration;
    this.callback = onComplete ?? null;
    this.overlay.visible = true;
  }

  /**
   * 페이드 인 시작 (화면이 점점 밝아짐)
   * @param duration 페이드 지속 시간 (초)
   * @param onComplete 페이드 완료 시 콜백
   */
  fadeIn(duration: number = 1.0, onComplete?: () => void): void {
    this.targetAmount = 0;
    this.duration = duration;
    this.callback = onComplete ?? null;
    this.overlay.visible = true;
  }

  /**
   * 페이드 즉시 설정 (애니메이션 없이)
   * @param amount 0 = 투명, 1 = 불투명
   */
  setAmount(amount: number): void {
    this.currentAmount = amount;
    this.targetAmount = amount;
    this.material.opacity = amount;
    this.overlay.visible = amount > 0;
    this.callback = null;
  }

  /**
   * 페이드 색상 변경
   */
  setColor(color: ColorRepresentation): void {
    this.material.color.set(color);
  }

  /**
   * 현재 페이드 양 가져오기
   */
  getAmount(): number {
    return this.currentAmount;
  }

  /**
   * 페이드 애니메이션 중인지 확인
   */
  isFading(): boolean {
    return this.currentAmount !== this.targetAmount;
  }

  /**
   * 페이드 오버레이가 보이는지 확인
   */
  isVisible(): boolean {
    return this.overlay.visible;
  }

  /**
   * 매 프레임 업데이트
   * @param deltaTime 프레임 간격 (초)
   */
  update(deltaTime: number): void {
    if (this.currentAmount === this.targetAmount) return;

    // 선형 보간으로 정확한 시간 기반 페이드
    const fadeStep = deltaTime / this.duration;

    if (this.targetAmount > this.currentAmount) {
      // 페이드 아웃 (0 → 1)
      this.currentAmount = Math.min(this.targetAmount, this.currentAmount + fadeStep);
    } else {
      // 페이드 인 (1 → 0)
      this.currentAmount = Math.max(this.targetAmount, this.currentAmount - fadeStep);
    }

    // 페이드 아웃 완료 체크
    if (this.targetAmount === 1 && this.currentAmount >= 1) {
      this.currentAmount = 1;
      if (this.callback) {
        const callback = this.callback;
        this.callback = null;
        callback();
      }
    }

    // 페이드 인 완료 체크
    if (this.targetAmount === 0 && this.currentAmount <= 0) {
      this.currentAmount = 0;
      this.overlay.visible = false;
      if (this.callback) {
        const callback = this.callback;
        this.callback = null;
        callback();
      }
    }

    // 머티리얼 업데이트
    this.material.opacity = this.currentAmount;
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    this.overlay.geometry.dispose();
    this.material.dispose();
  }
}
