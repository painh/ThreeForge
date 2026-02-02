import { Texture, TextureLoader, SRGBColorSpace, AudioLoader } from 'three';

/**
 * 리소스 매니페스트 스키마
 */
export interface ResourceManifest {
  textures?: Record<string, string>;
  audio?: Record<string, string>;
  json?: Record<string, string>;
}

/**
 * 로딩 진행 상황
 */
export interface LoadingProgress {
  loaded: number;
  total: number;
  percentage: number;
  currentKey: string;
  currentPath: string;
}

export type ProgressCallback = (progress: LoadingProgress) => void;

/**
 * JSON 기반 리소스 매니저
 * - manifest.json에서 리소스 목록을 읽어 로드
 * - 키 기반으로 리소스에 접근
 * - 싱글톤 패턴
 */
export class ResourceManager {
  private static instance: ResourceManager | null = null;

  private manifest: ResourceManifest | null = null;
  private textures: Map<string, Texture> = new Map();
  private audio: Map<string, AudioBuffer> = new Map();
  private json: Map<string, unknown> = new Map();

  private textureLoader: TextureLoader;
  private audioLoader: AudioLoader;

  private constructor() {
    this.textureLoader = new TextureLoader();
    this.audioLoader = new AudioLoader();
  }

  /**
   * 싱글톤 인스턴스 반환
   */
  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  /**
   * 싱글톤 인스턴스 리셋 (테스트용)
   */
  static resetInstance(): void {
    if (ResourceManager.instance) {
      ResourceManager.instance.dispose();
      ResourceManager.instance = null;
    }
  }

  /**
   * manifest.json 로드
   */
  async loadManifest(url: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load manifest: ${url}`);
    }
    this.manifest = await response.json();
  }

  /**
   * manifest 직접 설정
   */
  setManifest(manifest: ResourceManifest): void {
    this.manifest = manifest;
  }

  /**
   * 모든 리소스 로드
   */
  async loadAll(onProgress?: ProgressCallback): Promise<void> {
    if (!this.manifest) {
      throw new Error('Manifest not loaded. Call loadManifest() first.');
    }

    const tasks: Array<{ type: 'texture' | 'audio' | 'json'; key: string; path: string }> = [];

    // 태스크 목록 생성
    if (this.manifest.textures) {
      for (const [key, path] of Object.entries(this.manifest.textures)) {
        tasks.push({ type: 'texture', key, path });
      }
    }
    if (this.manifest.audio) {
      for (const [key, path] of Object.entries(this.manifest.audio)) {
        tasks.push({ type: 'audio', key, path });
      }
    }
    if (this.manifest.json) {
      for (const [key, path] of Object.entries(this.manifest.json)) {
        tasks.push({ type: 'json', key, path });
      }
    }

    const total = tasks.length;
    let loaded = 0;

    // 순차 로드 (진행률 추적)
    for (const task of tasks) {
      onProgress?.({
        loaded,
        total,
        percentage: total > 0 ? (loaded / total) * 100 : 0,
        currentKey: task.key,
        currentPath: task.path,
      });

      try {
        switch (task.type) {
          case 'texture':
            await this.loadTexture(task.key, task.path);
            break;
          case 'audio':
            await this.loadAudio(task.key, task.path);
            break;
          case 'json':
            await this.loadJSON(task.key, task.path);
            break;
        }
      } catch (error) {
        console.warn(`Failed to load ${task.type} "${task.key}" from "${task.path}":`, error);
      }

      loaded++;
    }

    // 완료 콜백
    onProgress?.({
      loaded: total,
      total,
      percentage: 100,
      currentKey: '',
      currentPath: 'Complete',
    });
  }

  /**
   * 텍스처만 로드
   */
  async loadTextures(onProgress?: ProgressCallback): Promise<void> {
    if (!this.manifest?.textures) return;

    const entries = Object.entries(this.manifest.textures);
    const total = entries.length;
    let loaded = 0;

    for (const [key, path] of entries) {
      onProgress?.({
        loaded,
        total,
        percentage: total > 0 ? (loaded / total) * 100 : 0,
        currentKey: key,
        currentPath: path,
      });

      try {
        await this.loadTexture(key, path);
      } catch (error) {
        console.warn(`Failed to load texture "${key}" from "${path}":`, error);
      }

      loaded++;
    }

    onProgress?.({
      loaded: total,
      total,
      percentage: 100,
      currentKey: '',
      currentPath: 'Complete',
    });
  }

  /**
   * 오디오만 로드
   */
  async loadAudioFiles(onProgress?: ProgressCallback): Promise<void> {
    if (!this.manifest?.audio) return;

    const entries = Object.entries(this.manifest.audio);
    const total = entries.length;
    let loaded = 0;

    for (const [key, path] of entries) {
      onProgress?.({
        loaded,
        total,
        percentage: total > 0 ? (loaded / total) * 100 : 0,
        currentKey: key,
        currentPath: path,
      });

      try {
        await this.loadAudio(key, path);
      } catch (error) {
        console.warn(`Failed to load audio "${key}" from "${path}":`, error);
      }

      loaded++;
    }

    onProgress?.({
      loaded: total,
      total,
      percentage: 100,
      currentKey: '',
      currentPath: 'Complete',
    });
  }

  /**
   * 단일 텍스처 로드
   */
  private loadTexture(key: string, path: string): Promise<Texture> {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        path,
        (texture) => {
          texture.colorSpace = SRGBColorSpace;
          this.textures.set(key, texture);
          resolve(texture);
        },
        undefined,
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * 단일 오디오 로드
   */
  private loadAudio(key: string, path: string): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        path,
        (buffer) => {
          this.audio.set(key, buffer);
          resolve(buffer);
        },
        undefined,
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * 단일 JSON 로드
   */
  private async loadJSON(key: string, path: string): Promise<unknown> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load JSON: ${path}`);
    }
    const data = await response.json();
    this.json.set(key, data);
    return data;
  }

  // ==================== 리소스 접근 ====================

  /**
   * 텍스처 가져오기
   */
  getTexture(key: string): Texture | undefined {
    return this.textures.get(key);
  }

  /**
   * 오디오 가져오기
   */
  getAudio(key: string): AudioBuffer | undefined {
    return this.audio.get(key);
  }

  /**
   * JSON 가져오기
   */
  getJSON<T = unknown>(key: string): T | undefined {
    return this.json.get(key) as T | undefined;
  }

  // ==================== 유틸리티 ====================

  /**
   * 텍스처 존재 확인
   */
  hasTexture(key: string): boolean {
    return this.textures.has(key);
  }

  /**
   * 오디오 존재 확인
   */
  hasAudio(key: string): boolean {
    return this.audio.has(key);
  }

  /**
   * JSON 존재 확인
   */
  hasJSON(key: string): boolean {
    return this.json.has(key);
  }

  /**
   * 등록된 텍스처 키 목록
   */
  getTextureKeys(): string[] {
    return Array.from(this.textures.keys());
  }

  /**
   * 등록된 오디오 키 목록
   */
  getAudioKeys(): string[] {
    return Array.from(this.audio.keys());
  }

  /**
   * 등록된 JSON 키 목록
   */
  getJSONKeys(): string[] {
    return Array.from(this.json.keys());
  }

  /**
   * manifest에 정의된 텍스처 키 목록 (로드 여부 상관없이)
   */
  getManifestTextureKeys(): string[] {
    return this.manifest?.textures ? Object.keys(this.manifest.textures) : [];
  }

  /**
   * 리소스 수동 등록 (외부에서 로드한 경우)
   */
  registerTexture(key: string, texture: Texture): void {
    this.textures.set(key, texture);
  }

  registerAudio(key: string, buffer: AudioBuffer): void {
    this.audio.set(key, buffer);
  }

  registerJSON(key: string, data: unknown): void {
    this.json.set(key, data);
  }

  /**
   * 리소스 해제
   */
  dispose(): void {
    for (const texture of this.textures.values()) {
      texture.dispose();
    }
    this.textures.clear();
    this.audio.clear();
    this.json.clear();
    this.manifest = null;
  }
}
