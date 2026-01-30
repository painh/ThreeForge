import { Component } from '../core/Component';
import { StateMachine } from './StateMachine';
import type { StateContext, StateMachineConfig } from '../types/state.types';

export class StateMachineComponent<
  TContext extends StateContext = StateContext,
> extends Component {
  readonly stateMachine: StateMachine<TContext>;

  constructor(config?: StateMachineConfig<TContext>) {
    super();
    this.stateMachine = new StateMachine<TContext>(config);
  }

  get currentState(): string | null {
    return this.stateMachine.currentState;
  }

  get previousState(): string | null {
    return this.stateMachine.previousState;
  }

  get context(): TContext {
    return this.stateMachine.context;
  }

  transition(to: string, force?: boolean): boolean {
    return this.stateMachine.transition(to, force);
  }

  set<K extends keyof TContext>(key: K, value: TContext[K]): void {
    this.stateMachine.set(key, value);
  }

  get<K extends keyof TContext>(key: K): TContext[K] {
    return this.stateMachine.get(key);
  }

  override update(deltaTime: number): void {
    this.stateMachine.update(deltaTime);
  }
}
