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

## Tech Stack
- TypeScript
- Three.js
- Vite

## License
MIT
