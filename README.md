# ThreeForge

Three.js + TypeScript 기반 RPG 게임 프레임워크

## 설치

```bash
npm install threeforge
```

## 주요 기능

### Entity System
Three.js Object3D를 확장한 Entity 클래스로 게임 오브젝트 관리

```typescript
import { Entity, EntityManager, Component } from 'threeforge';

// 커스텀 컴포넌트 생성
class HealthComponent extends Component {
  health = 100;

  update(deltaTime: number) {
    // 컴포넌트 로직
  }
}

// Entity 생성 및 컴포넌트 추가
const player = new Entity({ name: 'player', tags: ['player', 'character'] });
player.addComponent(new HealthComponent());

// EntityManager로 관리
const manager = new EntityManager(scene);
manager.add(player);

// 태그로 조회
const enemies = manager.getByTag('enemy');
```

### State Machine
상태 기반 로직을 위한 StateMachine 시스템

```typescript
import { StateMachine, StateMachineComponent } from 'threeforge';

interface PlayerContext {
  isMoving: boolean;
  isAttacking: boolean;
}

const stateMachine = new StateMachine<PlayerContext>({
  initialState: 'idle',
  context: { isMoving: false, isAttacking: false },
  states: [
    {
      name: 'idle',
      onEnter: (ctx) => console.log('Idle 진입'),
      transitions: [
        { to: 'walk', condition: (ctx) => ctx.isMoving },
        { to: 'attack', condition: (ctx) => ctx.isAttacking },
      ],
    },
    {
      name: 'walk',
      onUpdate: (ctx, dt) => console.log('Walking...'),
      transitions: [
        { to: 'idle', condition: (ctx) => !ctx.isMoving },
      ],
    },
    {
      name: 'attack',
      onExit: (ctx) => { ctx.isAttacking = false; },
      transitions: [
        { to: 'idle', condition: (ctx) => !ctx.isAttacking },
      ],
    },
  ],
});

// 상태 변경
stateMachine.set('isMoving', true);
stateMachine.update(deltaTime);
```

### Event System
타입 안전한 이벤트 시스템

```typescript
import { EventEmitter } from 'threeforge';

interface GameEvents {
  playerDamaged: { damage: number; source: string };
  levelUp: { level: number };
}

const events = new EventEmitter<GameEvents>();

events.on('playerDamaged', ({ damage, source }) => {
  console.log(`${source}로부터 ${damage} 피해`);
});

events.emit('playerDamaged', { damage: 10, source: 'enemy' });
```

### Screen Fade
화면 페이드 인/아웃 효과를 위한 ScreenFade 클래스

```typescript
import { ScreenFade } from 'threeforge';

// ScreenFade 인스턴스 생성
const screenFade = new ScreenFade({
  color: 0x000000,      // 페이드 색상 (기본: 검은색)
  initialAmount: 0,     // 초기 투명도 (0 = 투명, 1 = 불투명)
});

// 렌더 루프에서
function render() {
  // 게임 씬 렌더링
  renderer.render(gameScene, camera);

  // UI 씬 렌더링
  renderer.render(uiScene, uiCamera);

  // 페이드 씬은 가장 마지막에 렌더링 (모든 UI 위에 표시)
  screenFade.update(deltaTime);
  if (screenFade.isVisible()) {
    renderer.render(screenFade.scene, uiCamera);
  }
}

// 페이드 아웃 (화면이 점점 어두워짐)
screenFade.fadeOut(2.0, () => {
  console.log('페이드 아웃 완료');
  // 씬 전환 등의 작업
});

// 페이드 인 (화면이 점점 밝아짐)
screenFade.fadeIn(2.0, () => {
  console.log('페이드 인 완료');
});

// 즉시 설정 (애니메이션 없이)
screenFade.setAmount(1);  // 완전 검은색
screenFade.setAmount(0);  // 완전 투명

// 페이드 색상 변경
screenFade.setColor(0xff0000);  // 빨간색으로 페이드
```

## API

### Entity
- `addComponent<T>(component: T): T` - 컴포넌트 추가
- `removeComponent<T>(componentClass): boolean` - 컴포넌트 제거
- `getComponent<T>(componentClass): T | undefined` - 컴포넌트 조회
- `hasComponent<T>(componentClass): boolean` - 컴포넌트 존재 확인
- `addTag(tag: string): void` - 태그 추가
- `hasTag(tag: string): boolean` - 태그 확인
- `update(deltaTime: number): void` - 업데이트

### EntityManager
- `add(entity: Entity): Entity` - Entity 등록
- `remove(entityId: string): boolean` - Entity 제거
- `get(entityId: string): Entity | undefined` - ID로 조회
- `getByTag(tag: string): Entity[]` - 태그로 조회
- `query(query: EntityQuery): Entity[]` - 쿼리로 조회
- `update(deltaTime: number): void` - 전체 업데이트

### StateMachine
- `transition(to: string, force?: boolean): boolean` - 상태 전환
- `set<K>(key: K, value): void` - context 속성 설정
- `get<K>(key: K): value` - context 속성 조회
- `update(deltaTime: number): void` - 업데이트 (자동 전환 체크)
- `addGlobalTransition(transition): void` - 글로벌 전환 추가

### ScreenFade
- `fadeOut(duration: number, onComplete?: () => void): void` - 페이드 아웃 시작
- `fadeIn(duration: number, onComplete?: () => void): void` - 페이드 인 시작
- `setAmount(amount: number): void` - 즉시 페이드 설정 (0~1)
- `setColor(color: ColorRepresentation): void` - 페이드 색상 변경
- `getAmount(): number` - 현재 페이드 양 조회
- `isFading(): boolean` - 페이드 애니메이션 중인지 확인
- `isVisible(): boolean` - 오버레이가 보이는지 확인
- `update(deltaTime: number): void` - 매 프레임 업데이트
- `dispose(): void` - 리소스 정리
- `scene: Scene` - 렌더링할 페이드 씬 (readonly)

## Tech Stack
- TypeScript
- Three.js
- Vite

## License
MIT
